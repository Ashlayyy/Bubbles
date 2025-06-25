import { Router, type Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import { healthService } from '../services/healthService.js';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();
const logger = createLogger('health-routes');

router.get('/', async (req, res: Response) => {
	try {
		const health = await healthService.getSystemHealth();

		const status =
			health.overall === 'healthy'
				? 200
				: health.overall === 'degraded'
				? 206
				: 503;

		res.status(status).json({
			status: health.overall,
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			services: {
				database: health.components.database.status,
				redis: health.components.redis.status,
				websocket: health.components.websocket.status,
				discord: health.components.discord.status,
				queue: health.components.queue.status,
				moderation: health.components.moderation.status,
			},
		});
	} catch (error) {
		logger.error('Health check error:', error);
		res.status(503).json({
			status: 'unhealthy',
			error: 'Health check failed',
			timestamp: new Date().toISOString(),
		});
	}
});

router.get(
	'/system',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const health = await healthService.getSystemHealth();

			res.json({
				success: true,
				data: health,
			} as ApiResponse);
		} catch (error) {
			logger.error('System health check error:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get system health',
			} as ApiResponse);
		}
	}
);

router.get(
	'/components/:component',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { component } = req.params;
			const health = await healthService.getSystemHealth();

			const componentHealth =
				health.components[component as keyof typeof health.components];

			if (!componentHealth) {
				return res.status(404).json({
					success: false,
					error: `Component '${component}' not found`,
				} as ApiResponse);
			}

			res.json({
				success: true,
				data: {
					component,
					...componentHealth,
				},
			} as ApiResponse);
		} catch (error) {
			logger.error(
				`Component health check error for ${req.params.component}:`,
				error
			);
			res.status(500).json({
				success: false,
				error: 'Failed to get component health',
			} as ApiResponse);
		}
	}
);

router.get(
	'/integration',
	authenticateToken,
	requireAdminPermissions,
	async (req: AuthRequest, res: Response) => {
		try {
			const health = await healthService.getSystemHealth();
			const integrationMetrics = healthService.getIntegrationMetricsSnapshot();

			res.json({
				success: true,
				data: {
					integration: health.integration,
					metrics: integrationMetrics,
					systemMetrics: health.metrics,
				},
			} as ApiResponse);
		} catch (error) {
			logger.error('Integration metrics error:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get integration metrics',
			} as ApiResponse);
		}
	}
);

router.get(
	'/moderation',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const health = await healthService.getSystemHealth();
			const moderationHealth = health.components.moderation;
			const integrationMetrics = healthService.getIntegrationMetricsSnapshot();

			res.json({
				success: true,
				data: {
					health: moderationHealth,
					metrics: integrationMetrics.moderationActions,
					queueHealth: integrationMetrics.queueHealth,
				},
			} as ApiResponse);
		} catch (error) {
			logger.error('Moderation health check error:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get moderation health',
			} as ApiResponse);
		}
	}
);

router.get(
	'/live',
	authenticateToken,
	requireAdminPermissions,
	async (req: AuthRequest, res: Response) => {
		try {
			const health = await healthService.getSystemHealth();

			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Cache-Control', 'no-cache');
			res.setHeader('Access-Control-Allow-Origin', '*');

			res.json({
				success: true,
				data: {
					timestamp: Date.now(),
					overall: health.overall,
					components: Object.entries(health.components).map(
						([name, component]) => ({
							name,
							status: component.status,
							latency: component.latency,
							lastCheck: component.lastCheck,
						})
					),
					integration: health.integration,
					metrics: health.metrics,
				},
			} as ApiResponse);
		} catch (error) {
			logger.error('Live metrics error:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to get live metrics',
			} as ApiResponse);
		}
	}
);

router.get(
	'/ping',
	authenticateToken,
	async (req: AuthRequest, res: Response) => {
		try {
			const { guildId } = req.query;
			const startTime = Date.now();

			const pingTime = Date.now() - startTime;

			res.json({
				success: true,
				data: {
					ping: pingTime,
					guildId: (guildId as string) || null,
					timestamp: Date.now(),
				},
			} as ApiResponse);
		} catch (error) {
			logger.error('Ping test error:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to ping bot',
			} as ApiResponse);
		}
	}
);

export default router;
