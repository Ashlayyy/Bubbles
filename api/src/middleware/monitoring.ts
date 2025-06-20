import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../types/shared.js';
import { healthService } from '../services/healthService.js';

const logger = createLogger('monitoring-middleware');

export interface MonitoringContext {
	startTime: number;
	requestId: string;
	route: string;
	method: string;
	userId?: string;
	guildId?: string;
}

// Extend Request to include monitoring context
declare module 'express-serve-static-core' {
	interface Request {
		monitoring?: MonitoringContext;
	}
}

export const monitoringMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const startTime = Date.now();
	const requestId = generateRequestId();

	// Set up monitoring context
	req.monitoring = {
		startTime,
		requestId,
		route: req.route?.path || req.path,
		method: req.method,
		userId: (req as any).user?.id,
		guildId: req.params.guildId || req.body?.guildId || req.query?.guildId,
	};

	// Log request start
	logger.info(`Request started: ${req.method} ${req.path}`, {
		requestId,
		userId: req.monitoring.userId,
		guildId: req.monitoring.guildId,
		userAgent: req.get('User-Agent'),
		ip: req.ip,
	});

	// Hook into response finish event
	res.on('finish', () => {
		const endTime = Date.now();
		const duration = endTime - startTime;
		const success = res.statusCode < 400;

		// Log request completion
		logger.info(`Request completed: ${req.method} ${req.path}`, {
			requestId,
			statusCode: res.statusCode,
			duration,
			success,
			userId: req.monitoring?.userId,
			guildId: req.monitoring?.guildId,
		});

		// Track API to Bot commands if this looks like one
		if (isApiToBotCommand(req)) {
			healthService.trackApiToBotCommand(success, duration);
		}

		// Track moderation actions specifically
		if (isModerationAction(req)) {
			healthService.trackModerationAction(success, duration);
		}
	});

	next();
};

export const logIntegrationEvent = (
	type: 'API_TO_BOT' | 'BOT_TO_API' | 'QUEUE_PROCESS' | 'WEBSOCKET_MESSAGE',
	data: {
		success: boolean;
		duration?: number;
		method?: string;
		guildId?: string;
		userId?: string;
		error?: string;
		metadata?: Record<string, unknown>;
	}
): void => {
	logger.info(`Integration event: ${type}`, {
		type,
		...data,
		timestamp: Date.now(),
	});

	// Update health service metrics based on event type
	switch (type) {
		case 'API_TO_BOT':
			if (data.duration !== undefined) {
				healthService.trackApiToBotCommand(data.success, data.duration);
			}
			break;
		case 'QUEUE_PROCESS':
			// Track queue processing metrics
			break;
	}
};

export const createRequestLogger = (component: string) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const startTime = Date.now();

		res.on('finish', () => {
			const duration = Date.now() - startTime;
			const success = res.statusCode < 400;

			logger.info(`${component} request completed`, {
				method: req.method,
				path: req.path,
				statusCode: res.statusCode,
				duration,
				success,
				requestId: req.monitoring?.requestId,
			});
		});

		next();
	};
};

// Helper functions
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function isApiToBotCommand(req: Request): boolean {
	// Check if this request involves bot commands
	const botCommandRoutes = [
		'/api/messages',
		'/api/moderation',
		'/api/channels',
		'/api/roles',
		'/api/hybrid/execute',
	];

	return (
		botCommandRoutes.some((route) => req.path.startsWith(route)) &&
		['POST', 'PUT', 'DELETE'].includes(req.method)
	);
}

function isModerationAction(req: Request): boolean {
	return req.path.startsWith('/api/moderation') && req.method === 'POST';
}

// Export monitoring utilities
export const monitoring = {
	logEvent: logIntegrationEvent,
	createLogger: createRequestLogger,
	middleware: monitoringMiddleware,
};
