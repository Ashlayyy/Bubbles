import * as IORedis from 'ioredis';
import type { Redis } from 'ioredis';
import { Queue as BullQueue, Worker as BullWorker } from 'bullmq';
import type { QueueName, QUEUE_NAMES } from '../types/queue.js';

export interface QueueConfig {
	redis: {
		host: string;
		port: number;
		password?: string;
		db?: number;
	};
	defaultJobOptions: any;
}

export const getQueueConfig = (): QueueConfig => {
	return {
		redis: {
			host: process.env.REDIS_HOST || 'localhost',
			port: parseInt(process.env.REDIS_PORT || '6379'),
			password: process.env.REDIS_PASSWORD || undefined,
			db: 0,
		},
		defaultJobOptions: {
			removeOnComplete: 100,
			removeOnFail: 50,
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 2000,
			},
		},
	};
};

export function createRedisConnection(): Redis {
	// Using the default export of the ioredis namespace for proper constructor typing
	// eslint-disable-next-line new-cap
	return new (IORedis.default as unknown as {
		new (options: any): Redis;
	})({
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: parseInt(process.env.REDIS_DB || '0', 10),
		maxRetriesPerRequest: null, // Required for BullMQ compatibility - prevents deprecation warnings
		enableReadyCheck: true,
		connectTimeout: 30_000,
		commandTimeout: 30_000,
		enableOfflineQueue: false,
		lazyConnect: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
	});
}

export const createQueue = (name: QueueName, redisConnection?: Redis): any => {
	const config = getQueueConfig();
	const redis = redisConnection || createRedisConnection();

	const bullQueue = new BullQueue(name, {
		connection: {
			port: config.redis.port,
			host: config.redis.host,
			password: config.redis.password,
			db: config.redis.db,
		},
		defaultJobOptions: config.defaultJobOptions,
	});

	// Monkey-patch .process for backward compatibility
	(bullQueue as any).process = (
		processor?: any,
		callback?: (job: any) => Promise<unknown>
	) => {
		const handler = typeof processor === 'function' ? processor : callback;
		const worker = new BullWorker(name, handler, {
			connection: redis,
		});
		return worker;
	};

	return bullQueue as unknown as any; // keep return type compatible
};

export class QueueManager {
	private queues: Map<QueueName, any> = new Map();
	private redisConnection: Redis;
	private connectionHealthy = false;
	private hasGivenUpReconnecting = false;

	constructor(redisConnection?: Redis) {
		this.redisConnection = redisConnection || createRedisConnection();
		this.setupConnectionMonitoring();
	}

	private setupConnectionMonitoring(): void {
		this.redisConnection.on('ready', () => {
			this.connectionHealthy = true;
			this.hasGivenUpReconnecting = false;
			console.log('Queue Redis connection is healthy');
		});

		this.redisConnection.on('error', (err: Error) => {
			this.connectionHealthy = false;
			if (!this.hasGivenUpReconnecting) {
				console.warn('Queue Redis connection unhealthy:', err.message);
			}
		});

		this.redisConnection.on('close', () => {
			this.connectionHealthy = false;
			if (!this.hasGivenUpReconnecting) {
				console.warn('Queue Redis connection closed');
			}
		});

		this.redisConnection.on('end', () => {
			this.connectionHealthy = false;
			this.hasGivenUpReconnecting = true;
			console.warn(
				'Queue Redis has given up reconnecting - switching to fallback mode permanently'
			);
		});
	}

	getQueue(name: QueueName): any {
		if (!this.queues.has(name)) {
			this.queues.set(name, createQueue(name, this.redisConnection));
		}
		return this.queues.get(name)!;
	}

	async closeAll(): Promise<void> {
		for (const queue of this.queues.values()) {
			await queue.close();
		}
		this.queues.clear();
		this.redisConnection.disconnect();
	}

	async getQueueStats(name: QueueName) {
		if (!this.connectionHealthy || this.hasGivenUpReconnecting) {
			throw new Error(
				'Redis connection is not healthy or has given up reconnecting'
			);
		}

		const queue = this.getQueue(name);
		return {
			waiting: await queue.getWaiting(),
			active: await queue.getActive(),
			completed: await queue.getCompleted(),
			failed: await queue.getFailed(),
			delayed: await queue.getDelayed(),
		};
	}

	/**
	 * Check if Redis connection is healthy
	 */
	isConnectionHealthy(): boolean {
		return this.connectionHealthy && !this.hasGivenUpReconnecting;
	}

	/**
	 * Test Redis connection by performing a simple operation
	 */
	async testConnection(): Promise<boolean> {
		if (this.hasGivenUpReconnecting) {
			return false;
		}

		try {
			await this.redisConnection.ping();
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Check if Redis has given up reconnecting
	 */
	hasStoppedReconnecting(): boolean {
		return this.hasGivenUpReconnecting;
	}
}
