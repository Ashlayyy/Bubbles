import { Queue, QueueEvents } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';
import * as promClient from 'prom-client';

export interface BullMQConfig {
	connection: RedisOptions;
	defaultJobOptions?: any;
}

// Add simple logging for ioredis events
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
	connection.on('wait', () => {
		console.log(`[${label}] Redis event: wait`);
	});
	connection.on('select', (db: number) => {
		console.log(`[${label}] Redis event: select db ${db}`);
	});
	connection.on('auth', () => {
		console.log(`[${label}] Redis event: auth`);
	});
	connection.on('authError', (err: Error) => {
		console.error(`[${label}] Redis event: authError`, err);
	});
}

/**
 * Create a Redis connection for BullMQ that auto-reconnects with sensible defaults.
 */
export function createBullMQConnection(options?: Partial<RedisOptions>) {
	console.log('[BullMQ] Creating main connection with config:', {
		host: process.env.REDIS_HOST || '127.0.0.1',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]',
		db: 0,
		lazyConnect: false,
	});

	const connection = new IORedis({
		host: process.env.REDIS_HOST || '127.0.0.1',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+
		enableReadyCheck: true,
		connectTimeout: 100_000, // Increased for Docker environments
		commandTimeout: 60_000,
		enableOfflineQueue: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		lazyConnect: false, // Force immediate connection
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ Main');

	// Force connection establishment with better error handling
	console.log('[BullMQ] Forcing main connection establishment...');
	connection.connect().catch((err) => {
		console.error('[BullMQ] Failed to connect main connection:', err);
	});

	// Add a timeout to detect if connection is stuck
	setTimeout(() => {
		if (connection.status === 'wait') {
			console.warn(
				'[BullMQ] Main connection still in wait state after 5 seconds, forcing reconnect...'
			);
			connection.disconnect();
			setTimeout(() => {
				connection.connect().catch((err) => {
					console.error('[BullMQ] Failed to reconnect main connection:', err);
				});
			}, 100);
		}
	}, 5000);

	return connection;
}

/**
 * Create a Redis connection specifically for QueueEvents with long-running blocking commands.
 * QueueEvents use blocking Redis commands (BLPOP, BRPOP) and need different timeout settings.
 */
export function createBullMQEventsConnection(options?: Partial<RedisOptions>) {
	console.log('[BullMQ Events] Creating events connection with config:', {
		host: process.env.REDIS_HOST || '127.0.0.1',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD ? '[SET]' : '[NOT SET]',
		db: 0,
		lazyConnect: false,
	});

	const connection = new IORedis({
		host: process.env.REDIS_HOST || '127.0.0.1',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: 0,
		maxRetriesPerRequest: null, // Required by BullMQ v5+
		enableReadyCheck: true,
		connectTimeout: 100_000, // Increased for Docker environments
		commandTimeout: 30_000, // Use a reasonable timeout instead of 0 to avoid hanging
		enableOfflineQueue: true,
		keepAlive: 30000,
		family: 4, // Force IPv4 for WSL compatibility
		showFriendlyErrorStack: true,
		lazyConnect: false, // Force immediate connection
		...(options || {}),
	});

	attachRedisLogging(connection, 'BullMQ Events');

	// Force connection establishment with better error handling
	console.log('[BullMQ Events] Forcing events connection establishment...');
	connection.connect().catch((err) => {
		console.error('[BullMQ Events] Failed to connect events connection:', err);
	});

	// Add a timeout to detect if connection is stuck
	setTimeout(() => {
		if (connection.status === 'wait') {
			console.warn(
				'[BullMQ Events] Events connection still in wait state after 5 seconds, forcing reconnect...'
			);
			connection.disconnect();
			setTimeout(() => {
				connection.connect().catch((err) => {
					console.error(
						'[BullMQ Events] Failed to reconnect events connection:',
						err
					);
				});
			}, 100);
		}
	}, 5000);

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
		console.log('[BullMQ] Registry initialized');
	}

	private initializeConnections(): void {
		if (this.initialized) {
			console.log('[BullMQ] Connections already initialized');
			return;
		}

		console.log('[BullMQ] Initializing connections...');
		console.log('[BullMQ] Environment check:');
		console.log('  - REDIS_HOST:', process.env.REDIS_HOST || '127.0.0.1');
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

		// Mark as initialized
		this.initialized = true;

		// Availability check - main connection must be ready, events connection can be connecting or even failed
		const checkAvailability = () => {
			const mainStatus = this.connection.status;
			const eventsStatus = this.eventsConnection.status;

			console.log(
				`[BullMQ] Connection status check - Main: ${mainStatus}, Events: ${eventsStatus}`
			);
			console.log(
				`[BullMQ] Connection objects - Main: ${
					this.connection ? 'exists' : 'null'
				}, Events: ${this.eventsConnection ? 'exists' : 'null'}`
			);

			const mainReady = mainStatus === 'ready';
			const eventsReady = eventsStatus === 'ready';
			const eventsConnecting = eventsStatus === 'connecting';
			const mainFailed = mainStatus === 'end';
			const eventsFailed = eventsStatus === 'end';

			console.log(
				`[BullMQ] Status analysis - Main ready: ${mainReady}, Events ready: ${eventsReady}, Events connecting: ${eventsConnecting}, Main failed: ${mainFailed}, Events failed: ${eventsFailed}`
			);

			// Main connection must be ready, but events connection can be more flexible
			if (mainReady && (eventsReady || eventsConnecting)) {
				this.isRedisAvailable = true;
				console.log(
					'[BullMQ] Redis connections ready (main ready, events connecting/ready)'
				);
			} else if (mainReady && eventsFailed) {
				// If main is ready but events failed, we can still operate (just without event monitoring)
				this.isRedisAvailable = true;
				console.log(
					'[BullMQ] Redis connections ready (main ready, events failed - limited functionality)'
				);
			} else if (mainFailed) {
				this.isRedisAvailable = false;
				console.warn(
					'[BullMQ] Redis connections failed (main connection failed)'
				);
			} else if (mainStatus === 'connecting') {
				console.log(
					'[BullMQ] Main connection still connecting, will check again...'
				);
				// Still connecting, check again in a moment
				setTimeout(checkAvailability, 1000);
			} else {
				console.log(
					`[BullMQ] Unexpected connection states - Main: ${mainStatus}, Events: ${eventsStatus}, will check again...`
				);
				// Still connecting or in unexpected state, check again in a moment
				setTimeout(checkAvailability, 1000);
			}
		};

		// Start checking availability after a longer delay to allow connections to establish
		setTimeout(checkAvailability, 2000);

		// Also check immediately and then periodically
		checkAvailability();
		setInterval(checkAvailability, 5000); // Check every 5 seconds
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

		// If connections aren't initialized yet, return false
		if (!this.initialized) {
			console.log('[BullMQ] Connections not yet initialized');
			return false;
		}

		// If explicitly disabled, return false
		if (process.env.DISABLE_QUEUES === 'true') {
			console.log('[BullMQ] Queues explicitly disabled');
			return false;
		}

		// Check if connections exist and are in a good state
		if (!this.connection || !this.eventsConnection) {
			console.log('[BullMQ] Connections not created');
			return false;
		}

		// Check connection status
		const mainStatus = this.connection.status;
		const eventsStatus = this.eventsConnection.status;

		console.log(
			`[BullMQ] isAvailable check - Main: ${mainStatus}, Events: ${eventsStatus}, isRedisAvailable: ${this.isRedisAvailable}`
		);

		// Main connection must be ready, events can be connecting or ready
		const mainReady = mainStatus === 'ready';
		const eventsAcceptable =
			eventsStatus === 'ready' || eventsStatus === 'connecting';

		const available = mainReady && eventsAcceptable;

		if (!available) {
			console.log(
				`[BullMQ] Not available - Main ready: ${mainReady}, Events acceptable: ${eventsAcceptable}`
			);
		}

		return available;
	}

	/**
	 * Force reconnection of Redis connections
	 */
	public async forceReconnect(): Promise<void> {
		console.log('[BullMQ] Forcing reconnection...');

		if (this.connection) {
			try {
				await this.connection.disconnect();
			} catch (error) {
				console.warn('[BullMQ] Error disconnecting main connection:', error);
			}
		}

		if (this.eventsConnection) {
			try {
				await this.eventsConnection.disconnect();
			} catch (error) {
				console.warn('[BullMQ] Error disconnecting events connection:', error);
			}
		}

		// Reset state
		this.isRedisAvailable = false;
		this.initialized = false;

		// Re-initialize
		this.initializeConnections();

		console.log('[BullMQ] Reconnection initiated');
	}

	/**
	 * Get detailed connection status for debugging
	 */
	public getConnectionStatus(): any {
		return {
			isAvailable: this.isRedisAvailable,
			initialized: this.initialized,
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
