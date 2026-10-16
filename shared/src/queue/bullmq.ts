import { Queue, QueueScheduler, QueueEvents } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';
import * as promClient from 'prom-client';

export interface BullMQConfig {
	connection: RedisOptions;
	defaultJobOptions?: any;
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
		maxRetriesPerRequest: 3,
		enableReadyCheck: true,
		connectTimeout: 5_000,
		commandTimeout: 5_000,
		...(options || {}),
	});

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
	private connection = createBullMQConnection();

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

		// Scheduler for delayed / repeatable jobs
		const scheduler = new QueueScheduler(name, { connection: this.connection });
		const queueEvents = new QueueEvents(name, { connection: this.connection });

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
		this.schedulers.set(name, scheduler);
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
			...Array.from(this.queues.values()).map((q) => q.close()),
			this.connection.quit(),
		]);
	}
}

export const bullMQRegistry = new BullMQRegistry();
