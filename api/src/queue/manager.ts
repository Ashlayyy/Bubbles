// Queue manager implementation
// TODO: Implement actual queue management system

import Bull from 'bull';
import { createLogger } from '../types/shared.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('queue-manager');

// Import types from relative path instead of @shared
interface QueueJob {
	id: string;
	type: string;
	data?: any;
	guildId?: string;
}

interface QueueName {
	BOT_COMMANDS: string;
	BOT_EVENTS: string;
	NOTIFICATIONS: string;
}

export interface QueueJobOptions extends Bull.JobOptions {
	priority?: number; // Changed from string to number (1-10)
	notifyWebSocket?: boolean;
	fallbackFromWebSocket?: boolean;
	guildId?: string; // Added missing guildId property
}

export interface HybridOptions {
	preferWebSocket?: boolean;
	requireReliability?: boolean;
	notifyCompletion?: boolean;
	guildId?: string;
}

export class EnhancedQueueManager {
	private queues = new Map<string, Bull.Queue>();
	private redisConnection: any;
	private isRedisConnected = false;
	private connectionAttempts = 0;
	private readonly maxConnectionAttempts = 5;
	// Base delay for the first reconnect attempt (ms) – doubles each retry until capped
	private static readonly BASE_RETRY_DELAY_MS = 1_000; // 1 second
	private static readonly MAX_RETRY_DELAY_MS = 30_000; // 30 seconds

	// Queue priority levels
	static readonly PRIORITY_LEVELS = {
		HIGH: 10,
		NORMAL: 5,
		LOW: 1,
	} as const;

	// Queue names with priorities
	static readonly QUEUE_NAMES = {
		// High priority - Critical operations
		CRITICAL: 'critical-operations',
		// Normal priority - Standard operations
		BOT_COMMANDS: 'bot-commands',
		BOT_EVENTS: 'bot-events',
		// Low priority - Background tasks
		BACKGROUND: 'background-tasks',
		NOTIFICATIONS: 'notifications',
	} as const;

	constructor() {
		this.initializeRedis();
		this.setupQueues();
	}

	private async initializeRedis(): Promise<void> {
		try {
			const Redis = (await import('ioredis')).default;
			this.redisConnection = new Redis({
				host: process.env.REDIS_HOST || 'localhost',
				port: parseInt(process.env.REDIS_PORT || '6379'),
				password: process.env.REDIS_PASSWORD,
				db: 0,
				lazyConnect: true,
				maxRetriesPerRequest: 3,
				enableReadyCheck: true,
				connectTimeout: 5000,
				commandTimeout: 5000,
				/*
				 * Custom retry strategy – exponential back-off capped at 5 attempts.
				 * Returning `null` tells ioredis to stop trying and emit an error.
				 */
				retryStrategy: (attempt: number) => {
					// track attempts for health reporting
					this.connectionAttempts = attempt;

					if (attempt > this.maxConnectionAttempts) {
						logger.error(
							`Redis: exceeded ${this.maxConnectionAttempts} reconnection attempts – giving up.`
						);
						return null; // stop reconnecting
					}

					const delay = Math.min(
						EnhancedQueueManager.BASE_RETRY_DELAY_MS * 2 ** (attempt - 1),
						EnhancedQueueManager.MAX_RETRY_DELAY_MS
					);

					logger.warn(`Redis reconnect attempt #${attempt} in ${delay} ms`);
					return delay;
				},
			});

			this.redisConnection.on('connect', () => {
				logger.info('Redis connected successfully');
				this.isRedisConnected = true;
				this.connectionAttempts = 0;
			});

			this.redisConnection.on('error', (error: Error) => {
				logger.warn('Redis connection error:', error.message);
				this.isRedisConnected = false;
			});

			this.redisConnection.on('close', () => {
				logger.warn('Redis connection closed');
				this.isRedisConnected = false;
			});

			// Test the connection
			await this.redisConnection.ping();
			logger.info('Redis connection tested successfully');
		} catch (error) {
			logger.error('Failed to initialize Redis:', error);
			this.isRedisConnected = false;
		}
	}

	private setupQueues(): void {
		if (!this.isRedisConnected) {
			logger.warn('Redis not connected, queues will be unavailable');
			return;
		}

		const queueOptions = {
			redis: {
				host: process.env.REDIS_HOST || 'localhost',
				port: parseInt(process.env.REDIS_PORT || '6379'),
				password: process.env.REDIS_PASSWORD,
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

		// Create priority queues
		Object.values(EnhancedQueueManager.QUEUE_NAMES).forEach((queueName) => {
			const queue = new Bull(queueName, queueOptions);
			this.queues.set(queueName, queue);

			// Add basic error handling
			queue.on('error', (error) => {
				logger.error(`Queue ${queueName} error:`, error);
			});

			queue.on('stalled', (job) => {
				logger.warn(`Job ${job.id} in queue ${queueName} stalled`);
			});

			queue.on('failed', (job, error) => {
				logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
				// Notify via WebSocket if job had notifyWebSocket flag
				if (job.data.notifyWebSocket) {
					this.notifyJobFailed(String(job.id), job.data, error.message);
				}
			});

			queue.on('completed', (job) => {
				logger.info(`Job ${job.id} in queue ${queueName} completed`);
				// Notify via WebSocket if job had notifyWebSocket flag
				if (job.data.notifyWebSocket) {
					this.notifyJobCompleted(String(job.id), job.data);
				}
			});
		});

		logger.info(`Initialized ${this.queues.size} priority queues`);
	}

	/**
	 * Hybrid command execution - tries WebSocket first, falls back to queue
	 */
	async executeHybridCommand(
		command: any,
		options: HybridOptions = {}
	): Promise<{
		method: 'websocket' | 'queue';
		jobId?: string;
		success: boolean;
	}> {
		const {
			preferWebSocket = true,
			requireReliability = false,
			guildId,
		} = options;

		// If reliability is required, use queue directly
		if (requireReliability) {
			const jobId = await this.addReliableJob(
				EnhancedQueueManager.QUEUE_NAMES.BOT_COMMANDS,
				command,
				{ notifyWebSocket: true, guildId }
			);
			return { method: 'queue', jobId, success: true };
		}

		// Try WebSocket first if preferred and available
		if (preferWebSocket && this.isWebSocketAvailable(guildId)) {
			try {
				const success = await this.sendViaWebSocket(command, guildId);
				if (success) {
					return { method: 'websocket', success: true };
				}
			} catch (error) {
				logger.warn('WebSocket failed, falling back to queue:', error);
			}
		}

		// Fallback to queue
		const jobId = await this.addReliableJob(
			EnhancedQueueManager.QUEUE_NAMES.BOT_COMMANDS,
			{ ...command, fallbackFromWebSocket: true },
			{ notifyWebSocket: true, guildId }
		);

		return { method: 'queue', jobId, success: true };
	}

	/**
	 * Add a job with priority and reliability options
	 */
	async addReliableJob(
		queueName: string,
		jobData: any,
		options: QueueJobOptions = {}
	): Promise<string> {
		if (!this.isRedisConnected) {
			throw new Error('Redis not connected - cannot add job to queue');
		}

		const queue = this.queues.get(queueName);
		if (!queue) {
			throw new Error(`Queue ${queueName} not found`);
		}

		// Set priority based on options
		const priority = this.getPriorityValue(options.priority || 5);

		// Enhanced job options
		const jobOptions: Bull.JobOptions = {
			priority,
			attempts: options.priority === 10 ? 5 : 3,
			backoff: {
				type: 'exponential',
				delay: options.priority === 10 ? 1000 : 2000,
			},
			removeOnComplete: options.priority === 10 ? 200 : 100,
			removeOnFail: options.priority === 10 ? 100 : 50,
			...options,
		};

		// Add metadata
		const enhancedJobData = {
			...jobData,
			id:
				jobData.id ||
				`job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			priority: options.priority || 5,
			notifyWebSocket: options.notifyWebSocket || false,
			fallbackFromWebSocket: options.fallbackFromWebSocket || false,
		};

		const job = await queue.add(enhancedJobData, jobOptions);

		logger.info(
			`Added ${options.priority || 5} priority job ${
				job.id
			} to queue ${queueName}`
		);

		// Notify via WebSocket that job was queued
		if (options.notifyWebSocket) {
			this.notifyJobQueued(String(job.id), enhancedJobData, options.guildId);
		}

		return String(job.id);
	}

	/**
	 * Add a scheduled job for delayed execution
	 */
	async addScheduledJob(
		queueName: string,
		jobData: any,
		delay: number,
		options: QueueJobOptions = {}
	): Promise<string> {
		if (!this.isRedisConnected) {
			throw new Error('Redis not connected - cannot schedule job');
		}

		const queue = this.queues.get(queueName);
		if (!queue) {
			throw new Error(`Queue ${queueName} not found`);
		}

		const jobOptions: Bull.JobOptions = {
			delay,
			priority: this.getPriorityValue(options.priority || 5),
			attempts: 3,
			backoff: {
				type: 'exponential',
				delay: 2000,
			},
			...options,
		};

		const enhancedJobData = {
			...jobData,
			id:
				jobData.id ||
				`scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			scheduledFor: Date.now() + delay,
			priority: options.priority || 5,
		};

		const job = await queue.add(enhancedJobData, jobOptions);

		logger.info(`Scheduled job ${job.id} for execution in ${delay}ms`);

		return String(job.id);
	}

	/**
	 * Get comprehensive queue statistics
	 */
	async getQueueStats() {
		const stats: Record<string, any> = {
			redisConnected: this.isRedisConnected,
			totalQueues: this.queues.size,
			queues: {},
		};

		if (!this.isRedisConnected) {
			return stats;
		}

		for (const [queueName, queue] of this.queues) {
			try {
				const [waiting, active, completed, failed, delayed] = await Promise.all(
					[
						queue.getWaiting(),
						queue.getActive(),
						queue.getCompleted(),
						queue.getFailed(),
						queue.getDelayed(),
					]
				);

				stats.queues[queueName] = {
					waiting: waiting.length,
					active: active.length,
					completed: completed.length,
					failed: failed.length,
					delayed: delayed.length,
				};
			} catch (error) {
				logger.error(`Failed to get stats for queue ${queueName}:`, error);
				stats.queues[queueName] = {
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		}

		return stats;
	}

	/**
	 * Get status of a specific job
	 */
	async getJobStatus(queueName: string, jobId: string) {
		const queue = this.queues.get(queueName);
		if (!queue) {
			throw new Error(`Queue "${queueName}" not found`);
		}

		try {
			// Convert jobId to string if needed
			const jobIdStr = String(jobId);
			const job = await queue.getJob(jobIdStr);
			if (!job) {
				return { status: 'not_found' };
			}

			return {
				id: String(job.id),
				status: await job.getState(),
				progress: job.progress(),
				data: job.data,
				createdAt: new Date(job.timestamp),
				processedAt: job.processedOn ? new Date(job.processedOn) : null,
				finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
				error: job.failedReason,
			};
		} catch (error) {
			logger.error('Error getting job status:', error);
			throw new Error(
				`Failed to get job status: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			);
		}
	}

	/**
	 * Check if WebSocket is available for a guild
	 */
	private isWebSocketAvailable(guildId?: string): boolean {
		if (!wsManager) return false;

		// Check if there are any bot connections
		const stats = wsManager.getConnectionStats();
		if (stats.botConnections === 0) return false;

		// If guildId is specified, check if there's a bot for that guild
		if (guildId) {
			// This would need to be implemented in the WebSocket manager
			// For now, assume available if any bot is connected
			return true;
		}

		return true;
	}

	/**
	 * Send command via WebSocket
	 */
	private async sendViaWebSocket(
		command: any,
		guildId?: string
	): Promise<boolean> {
		if (!wsManager) return false;

		try {
			const message = {
				type: 'BOT_COMMAND',
				event: 'EXECUTE_COMMAND',
				data: command,
				guildId,
				timestamp: Date.now(),
				messageId: `ws_${Date.now()}_${Math.random()
					.toString(36)
					.substr(2, 9)}`,
			};

			// Send to bot connections
			wsManager.broadcastToAll(message, (connection) => {
				return (
					connection.type === 'BOT' &&
					connection.authenticated &&
					(connection.guildId === guildId || !connection.guildId)
				);
			});

			return true;
		} catch (error) {
			logger.error('Failed to send via WebSocket:', error);
			return false;
		}
	}

	/**
	 * Get priority value for Bull queue
	 */
	private getPriorityValue(priority: number): number {
		switch (priority) {
			case 10:
				return EnhancedQueueManager.PRIORITY_LEVELS.HIGH;
			case 5:
				return EnhancedQueueManager.PRIORITY_LEVELS.NORMAL;
			case 1:
				return EnhancedQueueManager.PRIORITY_LEVELS.LOW;
			default:
				return EnhancedQueueManager.PRIORITY_LEVELS.NORMAL;
		}
	}

	/**
	 * WebSocket notification methods
	 */
	private notifyJobQueued(jobId: string, jobData: any, guildId?: string): void {
		const message = {
			type: 'JOB_QUEUED',
			event: 'JOB_STATUS_UPDATE',
			data: {
				jobId,
				status: 'queued',
				jobType: jobData.type || 'unknown',
				timestamp: Date.now(),
			},
			guildId,
			timestamp: Date.now(),
			messageId: `notify_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`,
		};

		wsManager?.broadcast(message, ['CLIENT', 'ADMIN']);
	}

	private notifyJobCompleted(jobId: string, jobData: any): void {
		const message = {
			type: 'JOB_COMPLETED',
			event: 'JOB_STATUS_UPDATE',
			data: {
				jobId,
				status: 'completed',
				jobType: jobData.type || 'unknown',
				timestamp: Date.now(),
			},
			guildId: jobData.guildId,
			timestamp: Date.now(),
			messageId: `notify_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`,
		};

		wsManager?.broadcast(message, ['CLIENT', 'ADMIN']);
	}

	private notifyJobFailed(jobId: string, jobData: any, error: string): void {
		const message = {
			type: 'JOB_FAILED',
			event: 'JOB_STATUS_UPDATE',
			data: {
				jobId,
				status: 'failed',
				jobType: jobData.type || 'unknown',
				error,
				timestamp: Date.now(),
			},
			guildId: jobData.guildId,
			timestamp: Date.now(),
			messageId: `notify_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`,
		};

		wsManager?.broadcast(message, ['CLIENT', 'ADMIN']);
	}

	/**
	 * Health check methods
	 */
	isHealthy(): boolean {
		return (
			this.isRedisConnected &&
			this.connectionAttempts < this.maxConnectionAttempts
		);
	}

	async disconnect(): Promise<void> {
		logger.info('Disconnecting queue manager...');

		// Close all queues
		for (const [queueName, queue] of this.queues) {
			try {
				await queue.close();
				logger.info(`Closed queue: ${queueName}`);
			} catch (error) {
				logger.error(`Error closing queue ${queueName}:`, error);
			}
		}

		// Disconnect Redis
		if (this.redisConnection) {
			this.redisConnection.disconnect();
		}

		this.queues.clear();
		this.isRedisConnected = false;
		logger.info('Queue manager disconnected');
	}

	// Legacy methods for backward compatibility
	async addJob(queueName: string, data: any): Promise<void> {
		await this.addReliableJob(queueName, data);
	}

	async getQueueStatus(queueName: string) {
		const stats = await this.getQueueStats();
		return (
			stats.queues[queueName] || {
				active: 0,
				waiting: 0,
				completed: 0,
				failed: 0,
			}
		);
	}
}

// Create singleton instance
const enhancedQueueManager = new EnhancedQueueManager();

export default enhancedQueueManager;
