import { Router } from 'express';
import queueManager from '../queue/manager.js';
import { deadLetterQueryService } from '../services/deadLetterQueryService.js';

export const QUEUE_NAMES = {
	BOT_COMMANDS: 'bot-commands',
	MODERATION: 'moderation',
	ANALYTICS: 'analytics',
	NOTIFICATIONS: 'notifications',
} as const;

const router = Router();

router.post('/test-queue', async (req, res) => {
	try {
		const testJob = {
			type: 'SEND_MESSAGE' as const,
			id: `test-${Date.now()}`,
			timestamp: Date.now(),
			channelId: req.body.channelId || 'test-channel',
			content: req.body.message || 'This is a test message from the API!',
			guildId: req.body.guildId || 'test-guild',
		};

		await queueManager.addJob(QUEUE_NAMES.BOT_COMMANDS, testJob);

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

router.get('/queue-stats', async (req, res) => {
	try {
		const stats = await queueManager.getQueueStatus(QUEUE_NAMES.BOT_COMMANDS);
		res.json({
			success: true,
			stats,
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

router.get('/dead-letter-stats', async (req, res) => {
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

router.get('/quarantined-jobs', async (req, res) => {
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

router.post('/release-quarantine/:jobId', async (req, res) => {
	try {
		const { jobId } = req.params;
		const response = await deadLetterQueryService.releaseFromQuarantine(jobId);

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
});

router.delete('/dead-letter-queue', async (req, res) => {
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
