// @ts-expect-error - path alias resolution handled by tsconfig paths
import { bullMQRegistry } from '@shared/queue';
import { createLogger } from '../types/shared.js';

const logger = createLogger('bullmq-manager');

export class BullMQManager {
	/** List of canonical queue names */
	static readonly QUEUE_NAMES = {
		CRITICAL: 'critical-operations',
		BOT_COMMANDS: 'bot-commands',
		BOT_EVENTS: 'bot-events',
		BACKGROUND: 'background-tasks',
		NOTIFICATIONS: 'notifications',
		DISCORD_EVENTS: 'discord-events',
	} as const;

	/** Get queue instance */
	getQueue(name: string) {
		return bullMQRegistry.getQueue(name);
	}

	/** Get job status */
	async getJobStatus(queueName: string, jobId: string) {
		const queue = bullMQRegistry.getQueue(queueName);
		const job = await queue.getJob(jobId);
		if (!job) return { status: 'not_found' };

		return {
			id: job.id,
			status: await job.getState(),
			progress: job.progress,
			data: job.data,
			createdAt: new Date(job.timestamp),
			processedAt: job.processedOn ? new Date(job.processedOn) : null,
			finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
			error: job.failedReason,
		};
	}

	/** Add an immediate job */
	async addJob<T = any>(
		queueName: string,
		data: T,
		opts: any = {}
	): Promise<string> {
		const queue = bullMQRegistry.getQueue(queueName);
		const job = await queue.add(queueName, data, opts);
		logger.debug(`Queued job ${job.id} in ${queueName}`);
		return job.id as string;
	}

	/** Add a delayed / repeatable job */
	async scheduleJob<T = any>(
		queueName: string,
		data: T,
		delayMs: number,
		opts: any = {}
	): Promise<string> {
		const queue = bullMQRegistry.getQueue(queueName);
		const job = await queue.add(queueName, data, { ...opts, delay: delayMs });
		logger.debug(`Scheduled job ${job.id} in ${queueName} after ${delayMs}ms`);
		return job.id as string;
	}

	async getQueueMetrics(queueName: string) {
		const queue = bullMQRegistry.getQueue(queueName);
		return {
			waiting: await queue.getWaitingCount(),
			active: await queue.getActiveCount(),
			completed: await queue.getCompletedCount(),
			failed: await queue.getFailedCount(),
			delayed: await queue.getDelayedCount(),
		};
	}

	/** Process dead letter queue */
	async processDeadLetterQueue(queueName: string, limit = 100) {
		const queue = bullMQRegistry.getQueue(queueName);
		const deadLetterQueue = await queue.getDeadLetterQueue();

		if (!deadLetterQueue) {
			logger.warn(`No dead letter queue found for ${queueName}`);
			return [];
		}

		const failedJobs = await deadLetterQueue.getJobs(['failed'], 0, limit);
		logger.info(
			`Found ${failedJobs.length} failed jobs in dead letter queue for ${queueName}`
		);

		return failedJobs.map((job: any) => ({
			id: job.id,
			data: job.data,
			failedReason: job.failedReason,
			timestamp: job.timestamp,
			processedOn: job.processedOn,
			finishedOn: job.finishedOn,
		}));
	}

	/** Retry failed job from dead letter queue */
	async retryFailedJob(queueName: string, jobId: string) {
		const queue = bullMQRegistry.getQueue(queueName);
		const deadLetterQueue = await queue.getDeadLetterQueue();

		if (!deadLetterQueue) {
			throw new Error(`No dead letter queue found for ${queueName}`);
		}

		const failedJob = await deadLetterQueue.getJob(jobId);
		if (!failedJob) {
			throw new Error(`Failed job ${jobId} not found in dead letter queue`);
		}

		// Move job back to main queue
		await failedJob.moveToActive();
		logger.info(`Retried failed job ${jobId} from dead letter queue`);

		return jobId;
	}

	/** Get dead letter queue metrics */
	async getDeadLetterQueueMetrics(queueName: string) {
		const queue = bullMQRegistry.getQueue(queueName);
		const deadLetterQueue = await queue.getDeadLetterQueue();

		if (!deadLetterQueue) {
			return { count: 0, oldestJob: null, newestJob: null };
		}

		const failedJobs = await deadLetterQueue.getJobs(['failed'], 0, 1000);
		const timestamps = failedJobs.map((job: any) => job.timestamp).sort();

		return {
			count: failedJobs.length,
			oldestJob: timestamps.length > 0 ? new Date(timestamps[0]) : null,
			newestJob:
				timestamps.length > 0
					? new Date(timestamps[timestamps.length - 1])
					: null,
		};
	}
}

export const bullMQManager = new BullMQManager();
