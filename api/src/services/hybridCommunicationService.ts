import { createLogger } from '../types/shared.js';
import { bullMQManager } from '../queue/bullmqManager.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('hybrid-communication');

export interface OperationResult {
	success: boolean;
	method: 'websocket' | 'queue' | 'hybrid';
	jobId?: string;
	error?: string;
	executionTime?: number;
}

export interface BulkOperationOptions {
	batchSize?: number;
	delayBetweenBatches?: number;
	priority?: 'high' | 'normal' | 'low';
	notifyProgress?: boolean;
}

// HybridOptions type moved to BullMQManager
interface HybridOptions {
	preferWebSocket?: boolean;
	requireReliability?: boolean;
	notifyCompletion?: boolean;
	guildId?: string;
}

/**
 * Hybrid Communication Service
 *
 * Intelligently routes operations between WebSocket (real-time) and Queue (reliable) systems
 * based on operation type, current system load, and reliability requirements.
 */
export class HybridCommunicationService {
	private static instance?: HybridCommunicationService;

	// Operation classifications for smart routing
	private readonly WEBSOCKET_OPERATIONS = new Set([
		// Real-time interactions
		'PLAY_MUSIC',
		'PAUSE_MUSIC',
		'SKIP_MUSIC',
		'SET_VOLUME',
		'GET_ONLINE_MEMBERS',
		'GET_VOICE_STATUS',
		'GET_MEMBER_COUNT',
		// Interactive moderation
		'QUICK_BAN',
		'INSTANT_KICK',
		'IMMEDIATE_TIMEOUT',
		// Reaction roles and interactive components
		'REACTION_ROLE_ADD',
		'BUTTON_CLICK',
		'MODAL_SUBMIT',
		// Live data requests
		'GET_QUEUE_STATUS',
		'GET_NOW_PLAYING',
		'GET_ACTIVE_POLLS',
	]);

	private readonly QUEUE_OPERATIONS = new Set([
		// Bulk operations
		'BULK_BAN',
		'BULK_KICK',
		'BULK_DELETE_MESSAGES',
		'MASS_ROLE_UPDATE',
		// Scheduled operations
		'SCHEDULED_UNBAN',
		'SCHEDULED_MESSAGE',
		'REMINDER',
		'TIMED_ROLE_REMOVE',
		// Data processing
		'ANALYTICS_UPDATE',
		'LOG_CLEANUP',
		'BACKUP_CREATION',
		'EXPORT_DATA',
		// Configuration changes
		'SETTINGS_SYNC',
		'PERMISSION_UPDATE',
		'FEATURE_TOGGLE',
		'CONFIG_BACKUP',
		// Long-running tasks
		'SERVER_MIGRATION',
		'ROLE_HIERARCHY_UPDATE',
		'CHANNEL_REORGANIZATION',
	]);

	private readonly HYBRID_OPERATIONS = new Set([
		// Operations that benefit from both systems
		'BAN_USER',
		'KICK_USER',
		'TIMEOUT_USER',
		'UNBAN_USER',
		'SEND_MESSAGE',
		'DELETE_MESSAGE',
		'EDIT_MESSAGE',
		'CREATE_MODERATION_CASE',
		'UPDATE_MODERATION_CASE',
		'GUILD_CONFIG_UPDATE',
		'ROLE_ASSIGNMENT',
	]);

	static getInstance(): HybridCommunicationService {
		if (!HybridCommunicationService.instance) {
			HybridCommunicationService.instance = new HybridCommunicationService();
		}
		return HybridCommunicationService.instance;
	}

	/**
	 * Main execution method - automatically chooses best communication method
	 */
	async execute(
		operation: string,
		data: any,
		options: HybridOptions & { timeout?: number } = {}
	): Promise<OperationResult> {
		const startTime = Date.now();

		try {
			logger.info(`Executing operation: ${operation}`, { data, options });

			// Determine routing strategy
			const strategy = this.determineStrategy(operation, options);

			let result: OperationResult;

			switch (strategy) {
				case 'websocket':
					result = await this.executeViaWebSocket(operation, data, options);
					break;
				case 'queue':
					result = await this.executeViaQueue(operation, data, options);
					break;
				case 'hybrid':
					result = await this.executeHybrid(operation, data, options);
					break;
				default:
					throw new Error(`Unknown strategy: ${strategy}`);
			}

			result.executionTime = Date.now() - startTime;
			logger.info(
				`Operation ${operation} completed via ${result.method}`,
				result
			);

			return result;
		} catch (error) {
			const errorResult: OperationResult = {
				success: false,
				method: 'queue', // Default fallback
				error: error instanceof Error ? error.message : 'Unknown error',
				executionTime: Date.now() - startTime,
			};

			logger.error(`Operation ${operation} failed:`, error);
			return errorResult;
		}
	}

	/**
	 * Execute bulk operations efficiently
	 */
	async executeBulk(
		operations: Array<{
			operation: string;
			data: any;
			options?: HybridOptions;
		}>,
		bulkOptions: BulkOperationOptions = {}
	): Promise<OperationResult[]> {
		const {
			batchSize = 10,
			delayBetweenBatches = 1000,
			priority = 'normal',
			notifyProgress = true,
		} = bulkOptions;

		logger.info(`Executing ${operations.length} bulk operations`, bulkOptions);

		const results: OperationResult[] = [];
		const batches = this.chunkArray(operations, batchSize);

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];

			// Process batch concurrently
			const batchPromises = batch.map(({ operation, data, options = {} }) =>
				this.execute(operation, data, {
					...options,
					requireReliability: priority === 'high',
				})
			);

			const batchResults = await Promise.allSettled(batchPromises);

			// Collect results
			batchResults.forEach((result, index) => {
				if (result.status === 'fulfilled') {
					results.push(result.value);
				} else {
					results.push({
						success: false,
						method: 'queue',
						error: result.reason?.message || 'Batch operation failed',
					});
				}
			});

			// Notify progress
			if (notifyProgress) {
				this.notifyBulkProgress(i + 1, batches.length, results);
			}

			// Delay between batches (except for last batch)
			if (i < batches.length - 1) {
				await this.delay(delayBetweenBatches);
			}
		}

		logger.info(`Bulk operations completed`, {
			total: operations.length,
			successful: results.filter((r) => r.success).length,
			failed: results.filter((r) => !r.success).length,
		});

		return results;
	}

	/**
	 * Schedule a delayed operation
	 */
	async schedule(
		operation: string,
		data: any,
		delay: number,
		options: HybridOptions = {}
	): Promise<OperationResult> {
		try {
			const jobId = await bullMQManager.scheduleJob(
				'notifications',
				{
					type: 'REMINDER',
					guildId: options.guildId,
					data,
					...options,
				},
				delay,
				{
					priority: 3,
					attempts: 3,
				}
			);

			logger.info(`Scheduled operation ${operation} for ${delay}ms delay`, {
				jobId,
			});

			return {
				success: true,
				method: 'queue',
				jobId,
			};
		} catch (error) {
			logger.error(`Failed to schedule operation ${operation}:`, error);
			return {
				success: false,
				method: 'queue',
				error: error instanceof Error ? error.message : 'Scheduling failed',
			};
		}
	}

	/**
	 * Check system health and capacity
	 */
	async getSystemHealth(): Promise<{
		websocket: { available: boolean; connections: number };
		queue: { available: boolean; health: boolean; stats: any };
		overall: 'healthy' | 'degraded' | 'unhealthy';
	}> {
		const websocketStats = wsManager?.getConnectionStats() || {
			botConnections: 0,
		};
		const criticalStats = await bullMQManager.getQueueMetrics(
			'critical-operations'
		);
		const botCommandsStats = await bullMQManager.getQueueMetrics(
			'bot-commands'
		);
		const queueHealth =
			criticalStats.failed < 10 && botCommandsStats.failed < 10;

		const websocketAvailable = websocketStats.botConnections > 0;
		const queueAvailable = queueHealth && websocketStats.redisConnected;

		let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

		if (!websocketAvailable && !queueAvailable) {
			overall = 'unhealthy';
		} else if (!websocketAvailable || !queueAvailable) {
			overall = 'degraded';
		}

		return {
			websocket: {
				available: websocketAvailable,
				connections: websocketStats.botConnections,
			},
			queue: {
				available: queueAvailable,
				health: queueHealth,
				stats: websocketStats,
			},
			overall,
		};
	}

	/**
	 * Private helper methods
	 */
	private determineStrategy(
		operation: string,
		options: HybridOptions
	): 'websocket' | 'queue' | 'hybrid' {
		// Force reliability check
		if (options.requireReliability) {
			return 'queue';
		}

		// Force WebSocket preference
		if (options.preferWebSocket === true) {
			return this.WEBSOCKET_OPERATIONS.has(operation) ? 'websocket' : 'hybrid';
		}

		// Classify operation
		if (this.WEBSOCKET_OPERATIONS.has(operation)) {
			return 'websocket';
		}

		if (this.QUEUE_OPERATIONS.has(operation)) {
			return 'queue';
		}

		if (this.HYBRID_OPERATIONS.has(operation)) {
			return 'hybrid';
		}

		// Default to hybrid for unknown operations
		return 'hybrid';
	}

	private async executeViaWebSocket(
		operation: string,
		data: any,
		options: HybridOptions
	): Promise<OperationResult> {
		const command = {
			command: operation,
			data,
			guildId: options.guildId,
			timestamp: Date.now(),
		};

		const message = {
			type: 'BOT_COMMAND',
			event: 'EXECUTE_COMMAND',
			data: command,
			guildId: options.guildId,
			timestamp: Date.now(),
			messageId: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		};

		try {
			wsManager?.broadcastToAll(message, (connection) => {
				return (
					connection.type === 'BOT' &&
					connection.authenticated &&
					(connection.guildId === options.guildId || !connection.guildId)
				);
			});

			return {
				success: true,
				method: 'websocket',
			};
		} catch (error) {
			return {
				success: false,
				method: 'websocket',
				error:
					error instanceof Error ? error.message : 'WebSocket execution failed',
			};
		}
	}

	private async executeViaQueue(
		operation: string,
		data: any,
		options: HybridOptions
	): Promise<OperationResult> {
		try {
			const jobId = await bullMQManager.addJob(
				'bot-commands',
				{
					type: 'CUSTOM_COMMAND',
					command: operation,
					guildId: options.guildId,
					data,
					...options,
				},
				{
					priority: 5,
					attempts: 3,
				}
			);

			return {
				success: true,
				method: 'queue',
				jobId,
			};
		} catch (error) {
			return {
				success: false,
				method: 'queue',
				error:
					error instanceof Error ? error.message : 'Queue execution failed',
			};
		}
	}

	private async executeHybrid(
		operation: string,
		data: any,
		options: HybridOptions
	): Promise<OperationResult> {
		// Execute command via BullMQ
		const jobId = await bullMQManager.addJob(
			'bot-commands',
			{
				type: 'BOT_COMMAND',
				command: operation,
				guildId: options.guildId,
				data,
				...options,
			},
			{
				priority: 5,
				attempts: 3,
			}
		);

		const result: OperationResult = { method: 'queue', jobId, success: true };

		return result;
	}

	private notifyBulkProgress(
		completedBatches: number,
		totalBatches: number,
		results: OperationResult[]
	): void {
		const progress = {
			completedBatches,
			totalBatches,
			successCount: results.filter((r) => r.success).length,
			failureCount: results.filter((r) => !r.success).length,
			percentage: Math.round((completedBatches / totalBatches) * 100),
		};

		const message = {
			type: 'BULK_PROGRESS',
			event: 'BULK_OPERATION_UPDATE',
			data: progress,
			timestamp: Date.now(),
			messageId: `bulk_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`,
		};

		wsManager?.broadcast(message, ['CLIENT', 'ADMIN']);
	}

	private chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			chunks.push(array.slice(i, i + chunkSize));
		}
		return chunks;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Export singleton instance
export const hybridCommunicationService =
	HybridCommunicationService.getInstance();
export default hybridCommunicationService;
