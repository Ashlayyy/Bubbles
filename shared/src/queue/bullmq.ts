import { Queue, QueueEvents } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';
import * as promClient from 'prom-client';

export interface BullMQConfig {
	connection: RedisOptions;
	defaultJobOptions?: any;
}

/**
 * Redis options for BullMQ.
 * Do not set commandTimeout: workers and QueueEvents use blocking commands
 * that wait until a job/event arrives.
 */
export function getBullMQRedisOptions(
	options?: Partial<RedisOptions>
): RedisOptions {
	return {
		host: process.env.REDIS_HOST || 'localhost',
		port: parseInt(process.env.REDIS_PORT || '6379', 10),
		password: process.env.REDIS_PASSWORD || undefined,
		db: 0,
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
		connectTimeout: 10_000,
		...(options || {}),
	};
}

/**
 * Create a Redis connection for BullMQ that auto-reconnects with sensible defaults.
 */
export function createBullMQConnection(options?: Partial<RedisOptions>) {
	const connection = new IORedis(getBullMQRedisOptions(options));

	connection.on('error', (err: Error) => {
		console.warn(`[BullMQ] Redis error: ${err.message}`);
	});

	connection.on('close', () => {
		console.warn('[BullMQ] Redis connection closed');
	});

	return connection;
}

/**
 * Registry that holds a single Queue + accompanying QueueScheduler & QueueEvents per queue name.
 * This singleton helps ensure all services share the same Redis connection pool.
 */
export class BullMQRegistry {
	private queues = new Map<string, any>();
	private schedulers = new Map<string, any>();
	private events = new Map<string, any>();
	private connectionOptions = getBullMQRedisOptions();

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
	 * Return (and lazily create) a Queue instance for the given name.
	 */
	getQueue(name: string, opts: Partial<BullMQConfig> = {}): any {
		if (this.queues.has(name)) return this.queues.get(name)!;

		const queue = new Queue(name, {
			connection: this.connectionOptions,
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

		const queueEvents = new QueueEvents(name, {
			connection: this.connectionOptions,
		});
		queue.on('error', (err: Error) => {
			console.warn(`[BullMQ] Queue ${name} error: ${err.message}`);
		});
		queueEvents.on('error', (err: Error) => {
			console.warn(`[BullMQ] QueueEvents ${name} error: ${err.message}`);
		});

		// Metrics instrumentation
		queueEvents.on('completed', (evt: any) => {
			const { processedOn, finishedOn } = evt;
			this.jobCompleted.inc({ queue: name });
			if (processedOn && finishedOn) {
				this.jobDuration.observe({ queue: name }, finishedOn - processedOn);
			}
		});

		queueEvents.on('failed', () => {
			this.jobFailed.inc({ queue: name });
		});

		this.queues.set(name, queue);
		this.events.set(name, queueEvents);

		return queue;
	}

	/** Return the QueueEvents instance (for pub/sub) */
	getQueueEvents(name: string) {
		return this.events.get(name) || null;
	}

	/** Clean shutdown for workers & schedulers */
	async shutdown(): Promise<void> {
		await Promise.all([
			...Array.from(this.schedulers.values()).map((s) => s.close()),
			...Array.from(this.events.values()).map((e) => e.close()),
			...Array.from(this.queues.values()).map((q) => q.close()),
		]);
	}
}

export const bullMQRegistry = new BullMQRegistry();
