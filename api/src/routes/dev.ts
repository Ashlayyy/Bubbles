import { Router } from 'express';
import { deadLetterQueryService } from '../services/deadLetterQueryService.js';
import { addRoute } from '../utils/secureRoute.js';
import { bullMQManager } from '../queue/bullmqManager.js';

export const QUEUE_NAMES = {
	BOT_COMMANDS: 'bot-commands',
	MODERATION: 'moderation',
	ANALYTICS: 'analytics',
	NOTIFICATIONS: 'notifications',
} as const;

const router = Router();

const open = {
	authRequired: false,
	tokenRequired: false,
	permissionsOverride: true,
};

addRoute(router, 'post', '/test-queue', open, async (req, res) => {
	try {
		const testJob = {
			type: 'SEND_MESSAGE' as const,
			id: `test-${Date.now()}`,
			timestamp: Date.now(),
			channelId: req.body.channelId || 'test-channel',
			content: req.body.message || 'This is a test message from the API!',
			guildId: req.body.guildId || 'test-guild',
		};

		await bullMQManager.addJob(QUEUE_NAMES.BOT_COMMANDS, testJob);

		res.status(201).json({
			success: true,
			message: 'Test job added to the bot commands queue.',
			jobData: testJob,
		});
	} catch (error) {
		console.error('Failed to add job to queue:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to add job to queue.',
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

addRoute(router, 'get', '/queue-stats', open, async (req, res) => {
	try {
		// Get stats from BullMQManager for each queue
		const criticalStats = await bullMQManager.getQueueMetrics(
			'critical-operations'
		);
		const botCommandsStats = await bullMQManager.getQueueMetrics(
			'bot-commands'
		);
		const queueStats = {
			queues: {
				'critical-operations': criticalStats,
				'bot-commands': botCommandsStats,
			},
			total: {
				waiting: criticalStats.waiting + botCommandsStats.waiting,
				active: criticalStats.active + botCommandsStats.active,
				completed: criticalStats.completed + botCommandsStats.completed,
				failed: criticalStats.failed + botCommandsStats.failed,
			},
		};

		res.json({
			success: true,
			stats: queueStats,
		});
	} catch (error) {
		console.error('Failed to get queue stats:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to get queue stats.',
			error: error instanceof Error ? error.message : 'Unknown error',
		});
	}
});

addRoute(router, 'get', '/dead-letter-stats', open, async (req, res) => {
	try {
		const response = await deadLetterQueryService.getDeadLetterStats();

		res.json({
			success: true,
			data: response.data,
		});
	} catch (error) {
		console.error('Failed to get dead letter stats:', error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Failed to get dead letter statistics',
		});
	}
});

addRoute(router, 'get', '/quarantined-jobs', open, async (req, res) => {
	try {
		const response = await deadLetterQueryService.getQuarantinedJobs();

		res.json({
			success: true,
			data: response.data,
		});
	} catch (error) {
		console.error('Failed to get quarantined jobs:', error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Failed to get quarantined jobs',
		});
	}
});

addRoute(
	router,
	'post',
	'/release-quarantine/:jobId',
	open,
	async (req, res) => {
		try {
			const { jobId } = req.params;
			const response = await deadLetterQueryService.releaseFromQuarantine(
				jobId
			);

			if (response.success) {
				res.json({
					success: true,
					message: response.message || `Job ${jobId} released from quarantine`,
				});
			} else {
				res.status(404).json({
					success: false,
					error: response.error || 'Job not found in quarantine',
				});
			}
		} catch (error) {
			console.error('Failed to release job from quarantine:', error);
			res.status(500).json({
				success: false,
				error:
					error instanceof Error
						? error.message
						: 'Failed to release job from quarantine',
			});
		}
	}
);

addRoute(router, 'delete', '/dead-letter-queue', open, async (req, res) => {
	try {
		const response = await deadLetterQueryService.clearDeadLetterQueue();

		res.json({
			success: true,
			message: response.message || 'Dead letter queue cleared',
			clearedCount: response.clearedCount || 0,
		});
	} catch (error) {
		console.error('Failed to clear dead letter queue:', error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: 'Failed to clear dead letter queue',
		});
	}
});

export default router;
