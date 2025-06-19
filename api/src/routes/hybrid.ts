import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdminPermissions } from '../middleware/permissions.js';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import hybridCommunicationService from '../services/hybridCommunicationService.js';
import enhancedQueueManager from '../queue/manager.js';
import type { Response } from 'express';

const router = Router();
const logger = createLogger('hybrid-routes');

// Get system health status
router.get(
	'/system/health',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const health = await hybridCommunicationService.getSystemHealth();

			res.json({
				success: true,
				data: health,
			} as ApiResponse);
		} catch (error) {
			logger.error('Error getting system health:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get system health',
			} as ApiResponse);
		}
	}
);

// Get queue statistics
router.get(
	'/queue/stats',
	authenticateToken,
	requireAdminPermissions,
	async (req: AuthRequest, res: Response) => {
		try {
			const stats = await enhancedQueueManager.getQueueStats();

			res.json({
				success: true,
				data: stats,
			} as ApiResponse);
		} catch (error) {
			logger.error('Error getting queue stats:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get queue statistics',
			} as ApiResponse);
		}
	}
);

// Get job status
router.get(
	'/queue/:queueName/job/:jobId',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { queueName, jobId } = req.params;

			const jobStatus = await enhancedQueueManager.getJobStatus(
				queueName,
				jobId
			);

			res.json({
				success: true,
				data: jobStatus,
			} as ApiResponse);
		} catch (error) {
			logger.error('Error getting job status:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get job status',
			} as ApiResponse);
		}
	}
);

// Execute bulk operations
router.post(
	'/bulk/execute',
	authenticateToken,
	requireAdminPermissions,
	async (req: AuthRequest, res: Response) => {
		try {
			const { operations, options = {} } = req.body;

			if (!Array.isArray(operations) || operations.length === 0) {
				return res.status(400).json({
					success: false,
					error: 'Operations array is required and must not be empty',
				} as ApiResponse);
			}

			// Validate operations
			for (const op of operations) {
				if (!op.operation || !op.data) {
					return res.status(400).json({
						success: false,
						error: 'Each operation must have "operation" and "data" fields',
					} as ApiResponse);
				}
			}

			logger.info(`Starting bulk operation with ${operations.length} items`);

			const results = await hybridCommunicationService.executeBulk(
				operations,
				options
			);

			const summary = {
				total: results.length,
				successful: results.filter((r) => r.success).length,
				failed: results.filter((r) => !r.success).length,
				methods: {
					websocket: results.filter((r) => r.method === 'websocket').length,
					queue: results.filter((r) => r.method === 'queue').length,
					hybrid: results.filter((r) => r.method === 'hybrid').length,
				},
			};

			res.json({
				success: true,
				data: {
					results,
					summary,
				},
				message: `Bulk operation completed: ${summary.successful}/${summary.total} successful`,
			} as ApiResponse);
		} catch (error) {
			logger.error('Error executing bulk operations:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to execute bulk operations',
			} as ApiResponse);
		}
	}
);

// Schedule a delayed operation
router.post(
	'/schedule',
	authenticateToken,
	requireAdminPermissions,
	async (req: AuthRequest, res: Response) => {
		try {
			const { operation, data, delay, options = {} } = req.body;

			if (!operation || !data || !delay) {
				return res.status(400).json({
					success: false,
					error: 'Operation, data, and delay are required',
				} as ApiResponse);
			}

			if (delay < 1000) {
				return res.status(400).json({
					success: false,
					error: 'Delay must be at least 1000ms (1 second)',
				} as ApiResponse);
			}

			const result = await hybridCommunicationService.schedule(
				operation,
				data,
				delay,
				options
			);

			if (result.success) {
				res.json({
					success: true,
					data: {
						jobId: result.jobId,
						scheduledFor: new Date(Date.now() + delay).toISOString(),
						operation,
					},
					message: 'Operation scheduled successfully',
				} as ApiResponse);
			} else {
				res.status(500).json({
					success: false,
					error: result.error || 'Failed to schedule operation',
				} as ApiResponse);
			}
		} catch (error) {
			logger.error('Error scheduling operation:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to schedule operation',
			} as ApiResponse);
		}
	}
);

// Execute a single operation with hybrid routing
router.post(
	'/execute',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { operation, data, options = {} } = req.body;

			if (!operation || !data) {
				return res.status(400).json({
					success: false,
					error: 'Operation and data are required',
				} as ApiResponse);
			}

			const result = await hybridCommunicationService.execute(
				operation,
				data,
				options
			);

			if (result.success) {
				res.json({
					success: true,
					data: {
						method: result.method,
						jobId: result.jobId,
						executionTime: result.executionTime,
					},
					message: `Operation executed via ${result.method}`,
				} as ApiResponse);
			} else {
				res.status(500).json({
					success: false,
					error: result.error || 'Failed to execute operation',
				} as ApiResponse);
			}
		} catch (error) {
			logger.error('Error executing operation:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to execute operation',
			} as ApiResponse);
		}
	}
);

// Get operation classification information
router.get(
	'/operations/classification',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const classifications = {
				websocket: [
					'PLAY_MUSIC',
					'PAUSE_MUSIC',
					'SKIP_MUSIC',
					'SET_VOLUME',
					'GET_ONLINE_MEMBERS',
					'GET_VOICE_STATUS',
					'GET_MEMBER_COUNT',
					'QUICK_BAN',
					'INSTANT_KICK',
					'IMMEDIATE_TIMEOUT',
					'REACTION_ROLE_ADD',
					'BUTTON_CLICK',
					'MODAL_SUBMIT',
					'GET_QUEUE_STATUS',
					'GET_NOW_PLAYING',
					'GET_ACTIVE_POLLS',
				],
				queue: [
					'BULK_BAN',
					'BULK_KICK',
					'BULK_DELETE_MESSAGES',
					'MASS_ROLE_UPDATE',
					'SCHEDULED_UNBAN',
					'SCHEDULED_MESSAGE',
					'REMINDER',
					'TIMED_ROLE_REMOVE',
					'ANALYTICS_UPDATE',
					'LOG_CLEANUP',
					'BACKUP_CREATION',
					'EXPORT_DATA',
					'SETTINGS_SYNC',
					'PERMISSION_UPDATE',
					'FEATURE_TOGGLE',
					'CONFIG_BACKUP',
					'SERVER_MIGRATION',
					'ROLE_HIERARCHY_UPDATE',
					'CHANNEL_REORGANIZATION',
				],
				hybrid: [
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
				],
			};

			res.json({
				success: true,
				data: classifications,
			} as ApiResponse);
		} catch (error) {
			logger.error('Error getting operation classifications:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get operation classifications',
			} as ApiResponse);
		}
	}
);

export default router;
