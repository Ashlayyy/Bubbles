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
	let reconnectAttempts = 0;
	let backoff = 1000;
	const maxBackoff = 30000;

	connection.on('connect', () => {
		reconnectAttempts = 0;
		backoff = 1000;
		console.log(`[${label}] Redis event: connect`);
	});
	connection.on('ready', () => {
		reconnectAttempts = 0;
		backoff = 1000;
		console.log(`[${label}] Redis event: ready`);
	});
	connection.on('error', (err: Error) => {
		console.error(`[${label}] Redis event: error`, err);
		if (
			err.message.includes('Command timed out') ||
			err.message.includes('Connection is closed')
		) {
			reconnectAttempts++;
			setTimeout(() => {
				if (typeof connection.connect === 'function') {
					console.warn(
						`[${label}] Attempting to reconnect to Redis (attempt ${reconnectAttempts})...`
					);
					connection.connect().catch((e: any) => {
						console.error(`[${label}] Reconnect failed:`, e);
					});
				}
			}, backoff);
			backoff = Math.min(backoff * 2, maxBackoff);
			if (reconnectAttempts >= 5) {
				console.error(
					`[${label}] Max reconnect attempts reached. Queue system may be degraded.`
				);
				// Optionally emit an event or call a callback here
			}
		}
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
// Global max attempts
const maxConnectionAttempts = 5;
const CONNECTION_ATTEMPTS = Symbol('connectionAttempts');

export function createBullMQConnection(options?: Partial<RedisOptions>) {
	const connection = new IORedis({
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined, // Use undefined instead of empty string to avoid NOAUTH errors
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+ to avoid deprecation warnings
		enableReadyCheck: true,
		connectTimeout: 60_000, // Increased for better reliability
		commandTimeout: 60_000, // Timeout for regular commands
		enableOfflineQueue: true,
		lazyConnect: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ');

	(connection as any)[CONNECTION_ATTEMPTS] = 0;

	connection.on('error', (err: Error) => {
		(connection as any)[CONNECTION_ATTEMPTS] =
			((connection as any)[CONNECTION_ATTEMPTS] || 0) + 1;
		console.warn(
			`[BullMQ] Redis error (attempt ${
				(connection as any)[CONNECTION_ATTEMPTS]
			}/${maxConnectionAttempts}): ${err.message}`
		);

		if ((connection as any)[CONNECTION_ATTEMPTS] >= maxConnectionAttempts) {
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
		(connection as any)[CONNECTION_ATTEMPTS] = 0; // Reset on successful connection
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
		password: process.env.REDIS_PASSWORD || undefined, // Use undefined instead of empty string to avoid NOAUTH errors
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+ to avoid deprecation warnings
		enableReadyCheck: true,
		connectTimeout: 30_000,
		commandTimeout: 0, // No timeout for blocking commands used by QueueEvents
		enableOfflineQueue: true,
		lazyConnect: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ Events');

	(connection as any)[CONNECTION_ATTEMPTS] = 0;

	connection.on('error', (err: Error) => {
		(connection as any)[CONNECTION_ATTEMPTS] =
			((connection as any)[CONNECTION_ATTEMPTS] || 0) + 1;
		console.warn(
			`[BullMQ Events] Redis error (attempt ${
				(connection as any)[CONNECTION_ATTEMPTS]
			}/${maxConnectionAttempts}): ${err.message}`
		);

		if ((connection as any)[CONNECTION_ATTEMPTS] >= maxConnectionAttempts) {
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
		(connection as any)[CONNECTION_ATTEMPTS] = 0; // Reset on successful connection
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
	private connectionAttempts = 0;
	private maxConnectionAttempts = 5;
	private lastError: Error | null = null;

	constructor() {
		// Don't initialize connections in constructor - do it lazily
		console.log('[BullMQ] Registry initialized');
	}

	private initializeConnections(): void {
		if (this.initialized) {
			console.log('[BullMQ] Connections already initialized');
			return;
		}

		console.log('[BullMQ] Initializing connections...');
		console.log('[BullMQ] Environment check:');
		console.log('  - REDIS_HOST:', process.env.REDIS_HOST || 'localhost');
		console.log('  - REDIS_PORT:', process.env.REDIS_PORT || '6379');
		console.log(
			'  - REDIS_PASSWORD:',
			process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]'
		);
		console.log('  - DISABLE_QUEUES:', process.env.DISABLE_QUEUES);
		console.log('  - NODE_ENV:', process.env.NODE_ENV);

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
		console.log('[BullMQ] Creating Redis connections...');
		this.connection = createBullMQConnection();
		this.eventsConnection = createBullMQEventsConnection();

		// Test Redis availability on startup
		this.testRedisConnection();
		this.initialized = true;
	}

	private async testRedisConnection(): Promise<void> {
		try {
			console.log('[BullMQ] Testing Redis connections...');
			console.log('[BullMQ] Main connection status:', this.connection.status);
			console.log(
				'[BullMQ] Events connection status:',
				this.eventsConnection.status
			);

			// Give the connections a moment to establish, then connect
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Test main connection
			console.log('[BullMQ] Testing main connection...');
			if (
				this.connection.status !== 'ready' &&
				this.connection.status !== 'connecting'
			) {
				console.log('[BullMQ] Connecting main connection...');
				await this.connection.connect();
			}
			await this.connection.ping();
			console.log('[BullMQ] Main connection ping successful');

			// Test events connection
			console.log('[BullMQ] Testing events connection...');
			if (
				this.eventsConnection.status !== 'ready' &&
				this.eventsConnection.status !== 'connecting'
			) {
				console.log('[BullMQ] Connecting events connection...');
				await this.eventsConnection.connect();
			}
			await this.eventsConnection.ping();
			console.log('[BullMQ] Events connection ping successful');

			this.isRedisAvailable = true;
			this.connectionAttempts = 0;
			this.lastError = null;
			console.log('[BullMQ] Redis connection tests successful (main + events)');
		} catch (error) {
			this.connectionAttempts++;
			this.lastError = error as Error;
			this.isRedisAvailable = false;

			console.error('[BullMQ] Redis connection test failed:', error);
			console.error(
				'[BullMQ] Connection attempts:',
				this.connectionAttempts,
				'/',
				this.maxConnectionAttempts
			);
			console.error(
				'[BullMQ] Main connection status:',
				this.connection?.status
			);
			console.error(
				'[BullMQ] Events connection status:',
				this.eventsConnection?.status
			);

			if (this.connectionAttempts >= this.maxConnectionAttempts) {
				console.error(
					'[BullMQ] Max connection attempts reached. Queue system will be disabled.'
				);
			} else {
				console.warn(
					'[BullMQ] Redis not available. Queue operations will be disabled.'
				);
				console.warn(
					'[BullMQ] To enable queues, ensure Redis is running on localhost:6379'
				);
			}
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
	 * Get detailed connection status for debugging
	 */
	public getConnectionStatus(): any {
		return {
			isAvailable: this.isRedisAvailable,
			initialized: this.initialized,
			connectionAttempts: this.connectionAttempts,
			maxConnectionAttempts: this.maxConnectionAttempts,
			lastError: this.lastError?.message || null,
			mainConnectionStatus: this.connection?.status || 'not created',
			eventsConnectionStatus: this.eventsConnection?.status || 'not created',
			queueCount: this.queues.size,
			eventsCount: this.events.size,
		};
	}

	/**
	 * Return (and lazily create) a Queue instance for the given name.
	 */
	getQueue(name: string, opts: Partial<BullMQConfig> = {}): any {
		this.initializeConnections();

		console.log(`[BullMQ] Getting queue: ${name}`);
		console.log(`[BullMQ] Redis available: ${this.isRedisAvailable}`);
		console.log(`[BullMQ] Connection status:`, this.getConnectionStatus());

		if (!this.isRedisAvailable) {
			console.warn(
				`[BullMQ] Cannot create queue '${name}' - Redis not available`
			);
			return null;
		}

		if (this.queues.has(name)) {
			console.log(`[BullMQ] Returning existing queue: ${name}`);
			return this.queues.get(name)!;
		}

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
				timeout: 10000, // 10 seconds timeout for all jobs
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
