import { Queue, QueueEvents } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';
import * as promClient from 'prom-client';

export interface BullMQConfig {
	connection: RedisOptions;
	defaultJobOptions?: any;
}

// Add detailed logging for ioredis events
function attachRedisLogging(connection: any, label: string) {
	connection.on('connect', () => {
		console.log(`[${label}] Redis event: connect`);
	});
	connection.on('ready', () => {
		console.log(`[${label}] Redis event: ready`);
	});
	connection.on('error', (err: Error) => {
		console.error(`[${label}] Redis event: error`, err);
	});
	connection.on('close', () => {
		console.warn(`[${label}] Redis event: close`);
	});
	connection.on('reconnecting', (delay: number) => {
		console.log(`[${label}] Redis event: reconnecting in ${delay}ms`);
	});
	connection.on('end', () => {
		console.warn(`[${label}] Redis event: end`);
	});
}

/**
 * Create a Redis connection for BullMQ that auto-reconnects with sensible defaults.
 */
export function createBullMQConnection(options?: Partial<RedisOptions>) {
	const connection = new IORedis({
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+ to avoid deprecation warnings
		enableReadyCheck: true,
		connectTimeout: 60_000, // Increased for better reliability
		commandTimeout: 60_000, // Timeout for regular commands
		enableOfflineQueue: false,
		lazyConnect: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ');

	let connectionAttempts = 0;
	const maxConnectionAttempts = 5;

	connection.on('error', (err: Error) => {
		connectionAttempts++;
		console.warn(
			`[BullMQ] Redis error (attempt ${connectionAttempts}/${maxConnectionAttempts}): ${err.message}`
		);

		if (connectionAttempts >= maxConnectionAttempts) {
			console.error(
				'[BullMQ] Max Redis connection attempts reached. Queue system will be disabled.'
			);
			connection.disconnect();
		}
	});

	connection.on('close', () => {
		console.warn('[BullMQ] Redis connection closed');
	});

	connection.on('connect', () => {
		connectionAttempts = 0; // Reset on successful connection
		console.log('[BullMQ] Redis connected successfully');
	});

	connection.on('ready', () => {
		console.log('[BullMQ] Redis ready for commands');
	});

	return connection;
}

/**
 * Create a Redis connection specifically for QueueEvents with long-running blocking commands.
 * QueueEvents use blocking Redis commands (BLPOP, BRPOP) and need different timeout settings.
 */
export function createBullMQEventsConnection(options?: Partial<RedisOptions>) {
	const connection = new IORedis({
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+ to avoid deprecation warnings
		enableReadyCheck: true,
		connectTimeout: 10_000,
		commandTimeout: 0, // No timeout for blocking commands used by QueueEvents
		enableOfflineQueue: false,
		lazyConnect: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ Events');

	let connectionAttempts = 0;
	const maxConnectionAttempts = 5;

	connection.on('error', (err: Error) => {
		connectionAttempts++;
		console.warn(
			`[BullMQ Events] Redis error (attempt ${connectionAttempts}/${maxConnectionAttempts}): ${err.message}`
		);

		if (connectionAttempts >= maxConnectionAttempts) {
			console.error(
				'[BullMQ Events] Max Redis connection attempts reached. QueueEvents will be disabled.'
			);
			connection.disconnect();
		}
	});

	connection.on('close', () => {
		console.warn('[BullMQ Events] Redis connection closed');
	});

	connection.on('connect', () => {
		connectionAttempts = 0; // Reset on successful connection
		console.log('[BullMQ Events] Redis connected successfully');
	});

	connection.on('ready', () => {
		console.log('[BullMQ Events] Redis ready for commands');
	});

	return connection;
}

/**
 * Registry that holds a single Queue + accompanying QueueEvents per queue name.
 * This singleton helps ensure all services share the same Redis connection pool.
 * Note: QueueScheduler was deprecated in BullMQ v4.0.0 - delayed jobs are now handled automatically by Workers.
 */
export class BullMQRegistry {
	private queues = new Map<string, any>();
	private events = new Map<string, any>();
	private connection: any;
	private eventsConnection: any;
	private isRedisAvailable = false;
	private initialized = false;

	constructor() {
		// Don't initialize connections in constructor - do it lazily
	}

	private initializeConnections(): void {
		if (this.initialized) return;

		// Skip Redis connection if queues are explicitly disabled
		if (process.env.DISABLE_QUEUES === 'true') {
			this.isRedisAvailable = false;
			console.log(
				'[BullMQ] Queue system disabled via DISABLE_QUEUES environment variable'
			);
			this.initialized = true;
			return;
		}

		// Initialize connections
		this.connection = createBullMQConnection();
		this.eventsConnection = createBullMQEventsConnection();

		// Test Redis availability on startup
		this.testRedisConnection();
		this.initialized = true;
	}

	private async testRedisConnection(): Promise<void> {
		try {
			// Give the connections a moment to establish, then connect
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Test main connection
			if (
				this.connection.status !== 'ready' &&
				this.connection.status !== 'connecting'
			) {
				await this.connection.connect();
			}
			await this.connection.ping();

			// Test events connection
			if (
				this.eventsConnection.status !== 'ready' &&
				this.eventsConnection.status !== 'connecting'
			) {
				await this.eventsConnection.connect();
			}
			await this.eventsConnection.ping();

			this.isRedisAvailable = true;
			console.log('[BullMQ] Redis connection tests successful (main + events)');
		} catch (error) {
			this.isRedisAvailable = false;
			console.warn(
				'[BullMQ] Redis not available. Queue operations will be disabled.'
			);
			console.warn(
				'[BullMQ] To enable queues, ensure Redis is running on localhost:6379'
			);
		}
	}

	// Prometheus metrics
	private jobTotal = new promClient.Counter({
		name: 'queue_jobs_total',
		help: 'Total jobs queued',
		labelNames: ['queue'] as const,
	});

	private jobCompleted = new promClient.Counter({
		name: 'queue_jobs_completed_total',
		help: 'Total jobs completed',
		labelNames: ['queue'] as const,
	});

	private jobFailed = new promClient.Counter({
		name: 'queue_jobs_failed_total',
		help: 'Total jobs failed',
		labelNames: ['queue'] as const,
	});

	private jobDuration = new promClient.Histogram({
		name: 'queue_job_duration_ms',
		help: 'Job processing duration in milliseconds',
		labelNames: ['queue'] as const,
		buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
	});

	/**
	 * Check if Redis is available
	 */
	public isAvailable(): boolean {
		this.initializeConnections();
		return this.isRedisAvailable;
	}

	/**
	 * Return (and lazily create) a Queue instance for the given name.
	 */
	getQueue(name: string, opts: Partial<BullMQConfig> = {}): any {
		this.initializeConnections();

		if (!this.isRedisAvailable) {
			console.warn(
				`[BullMQ] Cannot create queue '${name}' - Redis not available`
			);
			return null;
		}

		if (this.queues.has(name)) return this.queues.get(name)!;

		const queue = new Queue(name, {
			connection: this.connection,
			defaultJobOptions: {
				removeOnComplete: 100,
				removeOnFail: 50,
				attempts: 3,
				backoff: {
					type: 'exponential',
					delay: 2_000,
				},
				...(opts.defaultJobOptions || {}),
			},
		});
		console.log(`[BullMQ] Created queue: ${name}`);

		// QueueEvents for monitoring job state changes - use separate connection for blocking commands
		const queueEvents = new QueueEvents(name, {
			connection: this.eventsConnection,
		});
		console.log(`[BullMQ] Created queue events: ${name}`);

		// Metrics instrumentation
		queueEvents.on('completed', (evt: any) => {
			const { processedOn, finishedOn } = evt;
			this.jobCompleted.inc({ queue: name });
			if (processedOn && finishedOn) {
				this.jobDuration.observe({ queue: name }, finishedOn - processedOn);
			}
			console.log(`[BullMQ] Job completed in queue '${name}':`, evt);
		});

		queueEvents.on('failed', (evt: any) => {
			this.jobFailed.inc({ queue: name });
			console.warn(`[BullMQ] Job failed in queue '${name}':`, evt);
		});

		queueEvents.on('stalled', (evt: any) => {
			console.warn(`[BullMQ] Job stalled in queue '${name}':`, evt);
		});

		queueEvents.on('waiting', (evt: any) => {
			console.log(`[BullMQ] Job waiting in queue '${name}':`, evt);
		});

		queueEvents.on('active', (evt: any) => {
			console.log(`[BullMQ] Job active in queue '${name}':`, evt);
		});

		queueEvents.on('progress', (evt: any) => {
			console.log(`[BullMQ] Job progress in queue '${name}':`, evt);
		});

		queueEvents.on('paused', () => {
			console.log(`[BullMQ] Queue paused: ${name}`);
		});
		queueEvents.on('resumed', () => {
			console.log(`[BullMQ] Queue resumed: ${name}`);
		});

		this.queues.set(name, queue);
		this.events.set(name, queueEvents);

		return queue;
	}

	/**
	 * Get QueueEvents instance for a given queue name
	 */
	getQueueEvents(name: string) {
		this.initializeConnections();

		if (!this.isRedisAvailable) {
			return null;
		}

		return this.events.get(name) ?? null;
	}

	/**
	 * Shutdown all queues and connections
	 */
	async shutdown(): Promise<void> {
		this.initializeConnections();

		if (!this.isRedisAvailable) {
			return;
		}

		// Close all queues
		for (const queue of this.queues.values()) {
			await queue.close();
		}

		// Close all events
		for (const events of this.events.values()) {
			await events.close();
		}

		// Close Redis connections
		if (this.connection) {
			this.connection.disconnect();
		}
		if (this.eventsConnection) {
			this.eventsConnection.disconnect();
		}

		console.log('[BullMQ] All queues and connections shut down');
	}
}

export const bullMQRegistry = new BullMQRegistry();
