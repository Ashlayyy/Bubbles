import { createLogger } from '../types/shared.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('dead-letter-query');

interface DeadLetterResponse {
	success: boolean;
	data?: any;
	error?: string;
	message?: string;
	clearedCount?: number;
}

export class DeadLetterQueryService {
	private pendingQueries = new Map<
		string,
		{
			resolve: (value: DeadLetterResponse) => void;
			reject: (error: Error) => void;
			timeout: NodeJS.Timeout;
		}
	>();

	constructor() {
		this.setupResponseHandler();
	}

	private setupResponseHandler(): void {
		// Listen for dead letter responses from bot
		wsManager?.on('message', (connectionId: string, message: any) => {
			if (message.type === 'DEAD_LETTER_RESPONSE') {
				this.handleDeadLetterResponse(message);
			}
		});
	}

	private handleDeadLetterResponse(message: any): void {
		const { messageId, data } = message;
		const pendingQuery = this.pendingQueries.get(messageId);

		if (pendingQuery) {
			clearTimeout(pendingQuery.timeout);
			this.pendingQueries.delete(messageId);

			if (data.success) {
				pendingQuery.resolve(data);
			} else {
				pendingQuery.reject(new Error(data.error || 'Unknown error'));
			}
		}
	}

	private generateMessageId(): string {
		return `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private sendQueryToBots(message: any): Promise<DeadLetterResponse> {
		return new Promise((resolve, reject) => {
			const messageId = this.generateMessageId();
			const queryMessage = {
				...message,
				messageId,
				timestamp: Date.now(),
			};

			// Set up timeout
			const timeout = setTimeout(() => {
				this.pendingQueries.delete(messageId);
				reject(new Error('Dead letter query timeout'));
			}, 30000); // 30 second timeout

			// Store pending query
			this.pendingQueries.set(messageId, { resolve, reject, timeout });

			// Send to bot connections
			const sent = wsManager?.broadcastToAll(
				queryMessage,
				(connection: any) => {
					return connection.type === 'BOT' && connection.authenticated;
				}
			);

			if (!wsManager) {
				clearTimeout(timeout);
				this.pendingQueries.delete(messageId);
				reject(new Error('No bot connections available'));
			}
		});
	}

	async getDeadLetterStats(): Promise<DeadLetterResponse> {
		try {
			logger.info('Querying dead letter stats from bot');

			const response = await this.sendQueryToBots({
				type: 'DEAD_LETTER_QUERY',
				event: 'GET_STATS',
			});

			return response;
		} catch (error) {
			logger.error('Failed to get dead letter stats:', error);
			throw error;
		}
	}

	async getQuarantinedJobs(): Promise<DeadLetterResponse> {
		try {
			logger.info('Querying quarantined jobs from bot');

			const response = await this.sendQueryToBots({
				type: 'DEAD_LETTER_QUERY',
				event: 'GET_QUARANTINED_JOBS',
			});

			return response;
		} catch (error) {
			logger.error('Failed to get quarantined jobs:', error);
			throw error;
		}
	}

	async releaseFromQuarantine(jobId: string): Promise<DeadLetterResponse> {
		try {
			logger.info(`Releasing job ${jobId} from quarantine`);

			const response = await this.sendQueryToBots({
				type: 'DEAD_LETTER_MANAGEMENT',
				event: 'RELEASE_QUARANTINE',
				data: { jobId },
			});

			return response;
		} catch (error) {
			logger.error(`Failed to release job ${jobId} from quarantine:`, error);
			throw error;
		}
	}

	async clearDeadLetterQueue(): Promise<DeadLetterResponse> {
		try {
			logger.info('Clearing dead letter queue');

			const response = await this.sendQueryToBots({
				type: 'DEAD_LETTER_MANAGEMENT',
				event: 'CLEAR_DEAD_LETTER_QUEUE',
			});

			return response;
		} catch (error) {
			logger.error('Failed to clear dead letter queue:', error);
			throw error;
		}
	}
}

export const deadLetterQueryService = new DeadLetterQueryService();
