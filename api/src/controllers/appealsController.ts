import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('appeals-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'APPEAL_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Get appeal settings
export const getAppealSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const settings = await prisma.appealSettings.findUnique({
			where: { guildId },
		});

		if (!settings) {
			// Return default settings
			return res.json({
				success: true,
				data: {
					enabled: false,
					channelId: null,
					staffRoleIds: [],
					cooldownDays: 30,
					maxAppealsPerUser: 3,
					requireReason: true,
					notifyStaff: true,
					dmUser: true,
					autoUnbanOnApproval: true,
				},
			} as ApiResponse);
		}

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching appeal settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch appeal settings',
		} as ApiResponse);
	}
};

// Update appeal settings
export const updateAppealSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const updatedSettings = await prisma.appealSettings.upsert({
			where: { guildId },
			update: {
				...req.body,
				updatedAt: new Date(),
			},
			create: {
				guildId,
				...req.body,
			},
		});

		logger.info(`Updated appeal settings for guild ${guildId}`, {
			enabled: updatedSettings.enabled,
		});

		res.json({
			success: true,
			message: 'Appeal settings updated successfully',
			data: updatedSettings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating appeal settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update appeal settings',
		} as ApiResponse);
	}
};

// Get appeals with filtering and pagination
export const getAppeals = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			page = 1,
			limit = 20,
			status,
			userId,
			type,
			moderatorId,
		} = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (status) where.status = status;
		if (userId) where.userId = userId;
		if (type) where.type = type;
		if (moderatorId) where.reviewedBy = moderatorId;

		// Fetch appeals with pagination
		const [appeals, total] = await Promise.all([
			prisma.appeal.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					responses: {
						orderBy: { createdAt: 'desc' },
						take: 5,
					},
				},
			}),
			prisma.appeal.count({ where }),
		]);

		const formattedAppeals = appeals.map((appeal: any) => ({
			id: appeal.id,
			userId: appeal.userId,
			type: appeal.type,
			reason: appeal.reason,
			status: appeal.status,
			reviewedBy: appeal.reviewedBy,
			reviewNotes: appeal.reviewNotes,
			createdAt: appeal.createdAt,
			updatedAt: appeal.updatedAt,
			responses: appeal.responses,
		}));

		res.json({
			success: true,
			data: {
				appeals: formattedAppeals,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching appeals:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch appeals',
		} as ApiResponse);
	}
};

// Get single appeal
export const getAppeal = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, appealId } = req.params;
		const prisma = getPrismaClient();

		const appeal = await prisma.appeal.findFirst({
			where: {
				id: appealId,
				guildId,
			},
			include: {
				responses: {
					orderBy: { createdAt: 'asc' },
				},
			},
		});

		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: 'Appeal not found',
			} as ApiResponse);
		}

		res.json({
			success: true,
			data: appeal,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching appeal:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch appeal',
		} as ApiResponse);
	}
};

// Create new appeal
export const createAppeal = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, type, reason, evidence, contactInfo } = req.body;
		const prisma = getPrismaClient();

		// Check if appeals are enabled
		const settings = await prisma.appealSettings.findUnique({
			where: { guildId },
		});

		if (!settings?.enabled) {
			return res.status(400).json({
				success: false,
				error: 'Appeals are not enabled for this server',
			} as ApiResponse);
		}

		// Check user limits
		const userAppeals = await prisma.appeal.count({ guildId, userId });

		if (userAppeals >= settings.maxAppealsPerUser) {
			return res.status(400).json({
				success: false,
				error: 'Maximum appeals limit reached',
			} as ApiResponse);
		}

		// Check cooldown
		const lastAppeal = await prisma.appeal.findFirst({
			where: { guildId, userId },
			orderBy: { createdAt: 'desc' },
		});

		if (lastAppeal) {
			const cooldownEnd = new Date(
				lastAppeal.createdAt.getTime() +
					settings.cooldownDays * 24 * 60 * 60 * 1000
			);
			if (new Date() < cooldownEnd) {
				return res.status(400).json({
					success: false,
					error: `Appeal cooldown active. Try again after ${cooldownEnd.toDateString()}`,
				} as ApiResponse);
			}
		}

		// Create appeal
		const appeal = await prisma.appeal.create({
			data: {
				guildId,
				userId,
				type,
				reason,
				evidence: evidence || null,
				contactInfo: contactInfo || null,
				status: 'PENDING',
			},
		});

		// Broadcast appeal creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('appealCreate', appeal)
		);

		// Notify staff if enabled
		if (settings.notifyStaff && settings.channelId) {
			try {
				await discordApi.sendMessage(settings.channelId, {
					content: `New appeal submitted by <@${userId}>`,
					embeds: [
						{
							title: 'New Appeal',
							description: `**Type:** ${type}\n**Reason:** ${reason}`,
							color: 0xffa500,
							timestamp: new Date().toISOString(),
						},
					],
				});
			} catch (error) {
				logger.warn('Failed to send staff notification:', error);
			}
		}

		logger.info(`Created appeal for user ${userId} in guild ${guildId}`, {
			appealId: appeal.id,
			type,
		});

		res.status(201).json({
			success: true,
			message: 'Appeal submitted successfully',
			data: appeal,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating appeal:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create appeal',
		} as ApiResponse);
	}
};

// Update appeal status
export const updateAppealStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, appealId } = req.params;
		const { status, reviewNotes } = req.body;
		const reviewerId = req.user?.id;
		const prisma = getPrismaClient();

		// Get current appeal
		const appeal = await prisma.appeal.findFirst({
			where: { id: appealId, guildId },
		});

		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: 'Appeal not found',
			} as ApiResponse);
		}

		// Update appeal
		const updatedAppeal = await prisma.appeal.update({
			where: { id: appealId },
			data: {
				status,
				reviewNotes,
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
			},
		});

		// Handle auto-unban on approval
		const settings = await prisma.appealSettings.findUnique({
			where: { guildId },
		});

		if (status === 'APPROVED' && settings?.autoUnbanOnApproval) {
			try {
				await discordApi.unbanUser(guildId, appeal.userId, 'Appeal approved');
			} catch (error) {
				logger.warn('Failed to auto-unban user:', error);
			}
		}

		// Broadcast status update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('appealStatusUpdate', updatedAppeal)
		);

		// Send DM to user if enabled
		if (settings?.dmUser) {
			try {
				const user = await discordApi.getUser(appeal.userId);
				if (user) {
					await discordApi.sendMessage(user.id, {
						content: `Your appeal has been ${status.toLowerCase()}.`,
						embeds: [
							{
								title: `Appeal ${status}`,
								description: reviewNotes || 'No additional notes provided.',
								color: status === 'APPROVED' ? 0x00ff00 : 0xff0000,
								timestamp: new Date().toISOString(),
							},
						],
					});
				}
			} catch (error) {
				logger.warn('Failed to send DM to user:', error);
			}
		}

		logger.info(`Updated appeal ${appealId} status to ${status}`, {
			reviewerId,
		});

		res.json({
			success: true,
			message: 'Appeal status updated successfully',
			data: updatedAppeal,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating appeal status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update appeal status',
		} as ApiResponse);
	}
};

// Delete appeal
export const deleteAppeal = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, appealId } = req.params;
		const prisma = getPrismaClient();

		// Delete appeal and its responses
		await prisma.appeal.delete({
			where: { id: appealId },
		});

		// Broadcast appeal deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('appealDelete', { id: appealId })
		);

		logger.info(`Deleted appeal ${appealId} from guild ${guildId}`);

		res.json({
			success: true,
			message: 'Appeal deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting appeal:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete appeal',
		} as ApiResponse);
	}
};

// Get appeal statistics
export const getAppealStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '30d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get appeal statistics
		const [totalAppeals, statusCounts, typeBreakdown, dailyActivity] =
			await Promise.all([
				prisma.appeal.count({
					where: {
						guildId,
						createdAt: { gte: startDate },
					},
				}),
				prisma.appeal.groupBy({
					by: ['status'],
					where: {
						guildId,
						createdAt: { gte: startDate },
					},
					_count: { status: true },
				}),
				prisma.appeal.groupBy({
					by: ['type'],
					where: {
						guildId,
						createdAt: { gte: startDate },
					},
					_count: { type: true },
				}),
				prisma.appeal.groupBy({
					by: ['createdAt'],
					where: {
						guildId,
						createdAt: { gte: startDate },
					},
					_count: { createdAt: true },
				}),
			]);

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.createdAt.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.createdAt
			);
		});

		// Calculate approval rates
		const approvedCount =
			statusCounts.find((s: any) => s.status === 'APPROVED')?._count.status ||
			0;
		const deniedCount =
			statusCounts.find((s: any) => s.status === 'DENIED')?._count.status || 0;
		const reviewedCount = approvedCount + deniedCount;

		const statistics = {
			period: period as string,
			overview: {
				totalAppeals,
				pendingCount:
					statusCounts.find((s: any) => s.status === 'PENDING')?._count
						.status || 0,
				underReviewCount:
					statusCounts.find((s: any) => s.status === 'UNDER_REVIEW')?._count
						.status || 0,
				approvedCount,
				deniedCount,
				approvalRate:
					reviewedCount > 0
						? Math.round((approvedCount / reviewedCount) * 100)
						: 0,
			},
			typeBreakdown: typeBreakdown.reduce((acc: any, type: any) => {
				acc[type.type] = type._count.type;
				return acc;
			}, {}),
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
		logger.error('Error fetching appeal statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch appeal statistics',
		} as ApiResponse);
	}
};

// Helper function
function parsePeriod(period: string): number {
	const match = period.match(/^(\d+)([dwmy])$/);
	if (!match) return 30 * 24 * 60 * 60 * 1000;

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
			return 30 * 24 * 60 * 60 * 1000;
	}
}

export { createAppeal as submitAppeal };
export { updateAppealStatus as reviewAppeal };
