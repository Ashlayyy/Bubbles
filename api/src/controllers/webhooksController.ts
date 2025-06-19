import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { discordWebhookHandler } from '../webhooks/discord.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('webhooks-controller');

// Helper function to parse period strings
function parsePeriod(period: string): number {
	const match = period.match(/^(\d+)([dwmy])$/);
	if (!match) return 7 * 24 * 60 * 60 * 1000;

	const [, amount, unit] = match;
	const num = parseInt(amount);

	switch (unit) {
		case 'd':
			return num * 24 * 60 * 60 * 1000;
		case 'w':
			return num * 7 * 24 * 60 * 60 * 1000;
		case 'm':
			return num * 30 * 24 * 60 * 60 * 1000;
		case 'y':
			return num * 365 * 24 * 60 * 60 * 1000;
		default:
			return 7 * 24 * 60 * 60 * 1000;
	}
}

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'WEBHOOK_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`,
	};
}

// Webhook delivery retry logic
async function scheduleWebhookDelivery(
	webhookId: string,
	event: string,
	payload: any
) {
	const prisma = getPrismaClient();

	try {
		await prisma.webhookDelivery.create({
			data: {
				webhookId,
				guildId: payload.guildId || 'unknown',
				event,
				payload,
				status: 'PENDING',
				attempts: 0,
				nextRetry: new Date(),
			},
		});

		// Process delivery immediately
		await processWebhookDelivery(webhookId);
	} catch (error) {
		logger.error('Failed to schedule webhook delivery:', error);
	}
}

async function processWebhookDelivery(webhookId: string) {
	const prisma = getPrismaClient();

	try {
		const delivery = await prisma.webhookDelivery.findFirst({
			where: {
				webhookId,
				status: 'PENDING',
				nextRetry: { lte: new Date() },
			},
			include: { webhook: true },
		});

		if (!delivery) return;

		const webhook = delivery.webhook;
		const startTime = Date.now();

		try {
			// Make HTTP request to webhook URL
			const response = await fetch(webhook.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Bubbles-Discord-Bot/1.0',
					...(webhook.secret && { 'X-Webhook-Secret': webhook.secret }),
					...(webhook.headers as any),
				},
				body: JSON.stringify(delivery.payload),
				signal: AbortSignal.timeout(webhook.timeout),
			});

			const responseText = await response.text();
			const duration = Date.now() - startTime;

			if (response.ok) {
				// Success
				await Promise.all([
					prisma.webhookDelivery.update({
						where: { id: delivery.id },
						data: {
							status: 'SUCCESS',
							httpCode: response.status,
							response: { body: responseText },
						},
					}),
					prisma.webhookLog.create({
						data: {
							webhookId,
							guildId: delivery.guildId,
							event: delivery.event,
							payload: delivery.payload,
							status: 'SUCCESS',
							httpCode: response.status,
							response: { body: responseText },
							duration,
						},
					}),
					prisma.webhook.update({
						where: { id: webhookId },
						data: {
							lastUsed: new Date(),
							failCount: 0,
						},
					}),
				]);
			} else {
				throw new Error(`HTTP ${response.status}: ${responseText}`);
			}
		} catch (error: any) {
			const duration = Date.now() - startTime;
			const attempts = delivery.attempts + 1;
			const maxAttempts = delivery.maxAttempts;

			if (attempts >= maxAttempts) {
				// Abandon after max attempts
				await Promise.all([
					prisma.webhookDelivery.update({
						where: { id: delivery.id },
						data: {
							status: 'ABANDONED',
							attempts,
							lastError: error.message,
						},
					}),
					prisma.webhookLog.create({
						data: {
							webhookId,
							guildId: delivery.guildId,
							event: delivery.event,
							payload: delivery.payload,
							status: 'FAILED',
							error: error.message,
							duration,
						},
					}),
					prisma.webhook.update({
						where: { id: webhookId },
						data: { failCount: { increment: 1 } },
					}),
				]);
			} else {
				// Schedule retry
				const retryDelay = webhook.retryDelay * Math.pow(2, attempts - 1); // Exponential backoff
				const nextRetry = new Date(Date.now() + retryDelay);

				await prisma.webhookDelivery.update({
					where: { id: delivery.id },
					data: {
						attempts,
						lastError: error.message,
						nextRetry,
					},
				});

				// Schedule next retry
				setTimeout(() => processWebhookDelivery(webhookId), retryDelay);
			}
		}
	} catch (error) {
		logger.error('Error processing webhook delivery:', error);
	}
}

// Get all webhooks
export const getWebhooks = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, enabled } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (enabled !== undefined) {
			where.isActive = enabled === 'true';
		}

		// Fetch webhooks
		const [webhooks, total] = await Promise.all([
			prisma.webhook.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					_count: {
						select: { logs: true, deliveries: true },
					},
				},
			}),
			prisma.webhook.count({ where }),
		]);

		// Get statistics
		const stats = await prisma.webhook.groupBy({
			by: ['isActive'],
			where: { guildId },
			_count: true,
		});

		const statsObj = {
			total,
			enabled: stats.find((s) => s.isActive)?._count || 0,
			disabled: stats.find((s) => !s.isActive)?._count || 0,
		};

		const formattedWebhooks = webhooks.map((webhook: any) => ({
			id: webhook.id,
			name: webhook.name,
			url: webhook.url.replace(/\/[^/]+$/, '/***'), // Hide webhook token
			isActive: webhook.isActive,
			events: webhook.events,
			timeout: webhook.timeout,
			retryCount: webhook.retryCount,
			lastUsed: webhook.lastUsed,
			failCount: webhook.failCount,
			totalLogs: webhook._count.logs,
			pendingDeliveries: webhook._count.deliveries,
			createdAt: webhook.createdAt,
			updatedAt: webhook.updatedAt,
		}));

		res.json({
			success: true,
			data: {
				webhooks: formattedWebhooks,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
				stats: statsObj,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching webhooks:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch webhooks',
		} as ApiResponse);
	}
};

// Get single webhook
export const getWebhook = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, webhookId } = req.params;
		const prisma = getPrismaClient();

		const webhook = await prisma.webhook.findFirst({
			where: {
				id: webhookId,
				guildId,
			},
			include: {
				logs: {
					take: 10,
					orderBy: { timestamp: 'desc' },
				},
				deliveries: {
					where: { status: 'PENDING' },
					orderBy: { createdAt: 'desc' },
				},
				_count: {
					select: { logs: true, deliveries: true },
				},
			},
		});

		if (!webhook) {
			return res.status(404).json({
				success: false,
				error: 'Webhook not found',
			} as ApiResponse);
		}

		const webhookData = {
			id: webhook.id,
			name: webhook.name,
			url: webhook.url,
			secret: webhook.secret ? '***' : null,
			isActive: webhook.isActive,
			events: webhook.events,
			headers: webhook.headers,
			timeout: webhook.timeout,
			retryCount: webhook.retryCount,
			retryDelay: webhook.retryDelay,
			lastUsed: webhook.lastUsed,
			failCount: webhook.failCount,
			createdBy: webhook.createdBy,
			createdAt: webhook.createdAt,
			updatedAt: webhook.updatedAt,
			recentActivity: webhook.logs.map((log: any) => ({
				id: log.id,
				event: log.event,
				status: log.status,
				httpCode: log.httpCode,
				error: log.error,
				duration: log.duration,
				timestamp: log.timestamp,
			})),
			pendingDeliveries: webhook.deliveries.length,
			totalLogs: webhook._count.logs,
		};

		res.json({
			success: true,
			data: webhookData,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch webhook',
		} as ApiResponse);
	}
};

// Create webhook
export const createWebhook = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			name,
			url,
			secret,
			events = [],
			headers,
			timeout = 5000,
			retryCount = 3,
			retryDelay = 1000,
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (!name || !url) {
			return res.status(400).json({
				success: false,
				error: 'Name and URL are required',
			} as ApiResponse);
		}

		// Check if webhook name already exists
		const existingWebhook = await prisma.webhook.findFirst({
			where: {
				guildId,
				name: { equals: name, mode: 'insensitive' },
			},
		});

		if (existingWebhook) {
			return res.status(400).json({
				success: false,
				error: 'Webhook name already exists',
			} as ApiResponse);
		}

		// Create webhook
		const webhook = await prisma.webhook.create({
			data: {
				guildId,
				name,
				url,
				secret,
				events,
				headers,
				timeout,
				retryCount,
				retryDelay,
				createdBy: req.user?.id || 'unknown',
			},
		});

		// Broadcast webhook creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('webhookCreate', webhook)
		);

		logger.info(`Created webhook '${name}' for guild ${guildId}`, {
			webhookId: webhook.id,
			createdBy: req.user?.id,
		});

		res.status(201).json({
			success: true,
			message: 'Webhook created successfully',
			data: {
				id: webhook.id,
				name: webhook.name,
				url: webhook.url,
				isActive: webhook.isActive,
				events: webhook.events,
				createdAt: webhook.createdAt,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create webhook',
		} as ApiResponse);
	}
};

// Update webhook
export const updateWebhook = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, webhookId } = req.params;
		const updates = req.body;
		const prisma = getPrismaClient();

		// Check webhook exists
		const existingWebhook = await prisma.webhook.findFirst({
			where: {
				id: webhookId,
				guildId,
			},
		});

		if (!existingWebhook) {
			return res.status(404).json({
				success: false,
				error: 'Webhook not found',
			} as ApiResponse);
		}

		// Check name uniqueness if name is being updated
		if (updates.name && updates.name !== existingWebhook.name) {
			const nameExists = await prisma.webhook.findFirst({
				where: {
					guildId,
					name: { equals: updates.name, mode: 'insensitive' },
					id: { not: webhookId },
				},
			});

			if (nameExists) {
				return res.status(400).json({
					success: false,
					error: 'Webhook name already exists',
				} as ApiResponse);
			}
		}

		// Update webhook
		const updatedWebhook = await prisma.webhook.update({
			where: { id: webhookId },
			data: {
				...updates,
				updatedAt: new Date(),
			},
		});

		// Broadcast webhook update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('webhookUpdate', updatedWebhook)
		);

		logger.info(`Updated webhook ${webhookId} for guild ${guildId}`, {
			changes: Object.keys(updates),
			updatedBy: req.user?.id,
		});

		res.json({
			success: true,
			message: 'Webhook updated successfully',
			data: updatedWebhook,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update webhook',
		} as ApiResponse);
	}
};

// Delete webhook
export const deleteWebhook = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, webhookId } = req.params;
		const prisma = getPrismaClient();

		// Check webhook exists
		const webhook = await prisma.webhook.findFirst({
			where: {
				id: webhookId,
				guildId,
			},
		});

		if (!webhook) {
			return res.status(404).json({
				success: false,
				error: 'Webhook not found',
			} as ApiResponse);
		}

		// Delete webhook (cascades to logs and deliveries)
		await prisma.webhook.delete({
			where: { id: webhookId },
		});

		// Broadcast webhook deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('webhookDelete', { webhookId, name: webhook.name })
		);

		logger.info(`Deleted webhook ${webhookId} for guild ${guildId}`, {
			webhookName: webhook.name,
			deletedBy: req.user?.id,
		});

		res.json({
			success: true,
			message: 'Webhook deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete webhook',
		} as ApiResponse);
	}
};

// Test webhook
export const testWebhook = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, webhookId } = req.params;
		const { testPayload } = req.body;
		const prisma = getPrismaClient();

		// Get webhook
		const webhook = await prisma.webhook.findFirst({
			where: {
				id: webhookId,
				guildId,
			},
		});

		if (!webhook) {
			return res.status(404).json({
				success: false,
				error: 'Webhook not found',
			} as ApiResponse);
		}

		// Create test payload
		const payload = testPayload || {
			event: 'webhook_test',
			guildId,
			timestamp: new Date().toISOString(),
			data: { message: 'This is a test webhook delivery' },
		};

		// Schedule delivery
		await scheduleWebhookDelivery(webhookId, 'test', payload);

		logger.info(`Test webhook ${webhookId} for guild ${guildId}`, {
			testedBy: req.user?.id,
		});

		res.json({
			success: true,
			message: 'Webhook test scheduled',
			data: { payload },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error testing webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to test webhook',
		} as ApiResponse);
	}
};

// Get webhook logs
export const getWebhookLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, webhookId } = req.params;
		const { page = 1, limit = 50, status, event } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { webhookId, guildId };
		if (status) {
			where.status = status;
		}
		if (event) {
			where.event = event;
		}

		// Fetch logs
		const [logs, total] = await Promise.all([
			prisma.webhookLog.findMany({
				where,
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.webhookLog.count({ where }),
		]);

		// Get event statistics
		const eventStats = await prisma.webhookLog.groupBy({
			by: ['event'],
			where: { webhookId, guildId },
			_count: { event: true },
			orderBy: { _count: { event: 'desc' } },
		});

		// Get status statistics
		const statusStats = await prisma.webhookLog.groupBy({
			by: ['status'],
			where: { webhookId, guildId },
			_count: { status: true },
		});

		const formattedLogs = logs.map((log: any) => ({
			id: log.id,
			event: log.event,
			status: log.status,
			httpCode: log.httpCode,
			error: log.error,
			duration: log.duration,
			timestamp: log.timestamp,
			payload: log.payload,
			response: log.response,
		}));

		res.json({
			success: true,
			data: {
				logs: formattedLogs,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
				stats: {
					events: eventStats.map((stat: any) => ({
						event: stat.event,
						count: stat._count.event,
					})),
					statuses: statusStats.map((stat: any) => ({
						status: stat.status,
						count: stat._count.status,
					})),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching webhook logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch webhook logs',
		} as ApiResponse);
	}
};

// Get webhook statistics
export const getWebhookStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d', webhookId } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Build where clause
		const where: any = { guildId, timestamp: { gte: startDate } };
		if (webhookId) {
			where.webhookId = webhookId;
		}

		// Get basic statistics
		const [
			totalDeliveries,
			successfulDeliveries,
			failedDeliveries,
			avgDuration,
		] = await Promise.all([
			prisma.webhookLog.count({ where }),
			prisma.webhookLog.count({ where: { ...where, status: 'SUCCESS' } }),
			prisma.webhookLog.count({ where: { ...where, status: 'FAILED' } }),
			prisma.webhookLog.aggregate({
				where: { ...where, duration: { not: null } },
				_avg: { duration: true },
			}),
		]);

		// Get most active webhooks
		const topWebhooks = await prisma.webhookLog.groupBy({
			by: ['webhookId'],
			where: { guildId, timestamp: { gte: startDate } },
			_count: { webhookId: true },
			orderBy: { _count: { webhookId: 'desc' } },
			take: 10,
		});

		// Get webhook names for top webhooks
		const webhookIds = topWebhooks.map((w) => w.webhookId);
		const webhookNames = await prisma.webhook.findMany({
			where: { id: { in: webhookIds } },
			select: { id: true, name: true },
		});

		const nameMap = new Map(webhookNames.map((w) => [w.id, w.name]));

		// Get event distribution
		const eventDistribution = await prisma.webhookLog.groupBy({
			by: ['event'],
			where,
			_count: { event: true },
			orderBy: { _count: { event: 'desc' } },
		});

		// Get daily activity
		const dailyActivity = await prisma.webhookLog.groupBy({
			by: ['timestamp'],
			where,
			_count: { timestamp: true },
		});

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		const statistics = {
			period: period as string,
			overview: {
				totalDeliveries,
				successfulDeliveries,
				failedDeliveries,
				successRate:
					totalDeliveries > 0
						? ((successfulDeliveries / totalDeliveries) * 100).toFixed(2)
						: 0,
				averageDuration: avgDuration._avg.duration
					? Math.round(avgDuration._avg.duration)
					: 0,
			},
			topWebhooks: topWebhooks.map((webhook: any) => ({
				webhookId: webhook.webhookId,
				name: nameMap.get(webhook.webhookId) || 'Unknown',
				deliveries: webhook._count.webhookId,
			})),
			eventDistribution: eventDistribution.map((event: any) => ({
				event: event.event,
				count: event._count.event,
			})),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.json({
			success: true,
			data: statistics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching webhook statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch webhook statistics',
		} as ApiResponse);
	}
};

// === Discord Bot Webhook Handlers ===

// Handle Discord webhook events from bot instances
export const handleDiscordWebhook = async (req: AuthRequest, res: Response) => {
	try {
		await discordWebhookHandler.handleWebhook(req, res);
	} catch (error) {
		logger.error('Error processing Discord webhook:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
		} as ApiResponse);
	}
};

// Send command to bot instances
export const sendBotCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { command, data } = req.body;

		const success = await discordWebhookHandler.sendBotCommand(guildId, {
			command,
			data,
			timestamp: Date.now(),
		});

		res.json({
			success,
			message: 'Command sent to bot',
			data: {
				guildId,
				command,
				timestamp: Date.now(),
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error sending bot command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to send bot command',
		} as ApiResponse);
	}
};

// Get Discord event history
export const getDiscordEventHistory = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { eventType, limit = 50 } = req.query;

		const events = discordWebhookHandler.getEventHistory(
			guildId,
			eventType as string,
			parseInt(limit as string)
		);

		res.json({
			success: true,
			data: {
				events,
				guildId,
				eventType: eventType || 'all',
				limit: parseInt(limit as string),
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching Discord event history:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch Discord event history',
		} as ApiResponse);
	}
};

// Get Discord event statistics
export const getDiscordEventStats = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		const stats = discordWebhookHandler.getEventStats(guildId);

		res.json({
			success: true,
			data: {
				stats,
				guildId,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching Discord event stats:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch Discord event stats',
		} as ApiResponse);
	}
};

// Get shard status from connected bot instances
export const getShardStatus = async (req: AuthRequest, res: Response) => {
	try {
		const shardStatus = discordWebhookHandler.getShardStatus();

		res.json({
			success: true,
			data: {
				shardStatus,
				timestamp: new Date().toISOString(),
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching shard status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch shard status',
		} as ApiResponse);
	}
};

// Get WebSocket connection statistics
export const getWebSocketStats = async (req: AuthRequest, res: Response) => {
	try {
		const stats = wsManager.getConnectionStats();

		res.json({
			success: true,
			data: {
				websocketStats: stats,
				timestamp: new Date().toISOString(),
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching WebSocket stats:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch WebSocket stats',
		} as ApiResponse);
	}
};
