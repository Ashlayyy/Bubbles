import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('reaction-roles-controller');

// Get all reaction roles
export const getReactionRoles = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, channelId, messageId } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (channelId) where.channelId = channelId;
		if (messageId) where.messageId = messageId;

		// Fetch reaction roles with related data
		const [reactionRoles, total] = await Promise.all([
			prisma.reactionRole.findMany({
				where,
				include: {
					message: true,
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take,
			}),
			prisma.reactionRole.count({ where }),
		]);

		// Format response
		const formattedRoles = reactionRoles.map((reactionRole: any) => ({
			id: reactionRole.id,
			messageId: reactionRole.messageId,
			channelId: reactionRole.channelId,
			roleId: reactionRole.roleId,
			emoji: reactionRole.emoji,
			description: reactionRole.description,
			maxUsers: reactionRole.maxUsers,
			requiredRoles: reactionRole.requiredRoles,
			mode: reactionRole.mode,
			enabled: reactionRole.enabled,
			usageCount: reactionRole.usageCount,
			createdAt: reactionRole.createdAt,
			updatedAt: reactionRole.updatedAt,
			message: reactionRole.message
				? {
						id: reactionRole.message.id,
						title: reactionRole.message.title,
						content: reactionRole.message.content,
				  }
				: null,
		}));

		res.json({
			success: true,
			data: {
				reactionRoles: formattedRoles,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reaction roles:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reaction roles',
		} as ApiResponse);
	}
};

// Get single reaction role
export const getReactionRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const prisma = getPrismaClient();

		const reactionRole = await prisma.reactionRole.findFirst({
			where: {
				id: roleId,
				guildId,
			},
			include: {
				message: true,
			},
		});

		if (!reactionRole) {
			return res.status(404).json({
				success: false,
				error: 'Reaction role not found',
			} as ApiResponse);
		}

		// Get usage history
		const usageHistory = await prisma.reactionRoleLog.findMany({
			where: {
				reactionRoleId: reactionRole.id,
			},
			orderBy: { timestamp: 'desc' },
			take: 50,
		});

		const formattedRole = {
			id: reactionRole.id,
			messageId: reactionRole.messageId,
			channelId: reactionRole.channelId,
			roleId: reactionRole.roleId,
			emoji: reactionRole.emoji,
			description: reactionRole.description,
			maxUsers: reactionRole.maxUsers,
			requiredRoles: reactionRole.requiredRoles,
			mode: reactionRole.mode,
			enabled: reactionRole.enabled,
			usageCount: reactionRole.usageCount,
			createdAt: reactionRole.createdAt,
			updatedAt: reactionRole.updatedAt,
			message: reactionRole.message,
			usageHistory: usageHistory.map((log: any) => ({
				id: log.id,
				userId: log.userId,
				action: log.action,
				timestamp: log.timestamp,
				success: log.success,
				error: log.error,
			})),
		};

		res.json({
			success: true,
			data: formattedRole,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reaction role:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reaction role',
		} as ApiResponse);
	}
};

// Create reaction role
export const createReactionRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			messageId,
			channelId,
			roleId,
			emoji,
			description,
			maxUsers,
			requiredRoles = [],
			mode = 'ADD_REMOVE',
		} = req.body;
		const prisma = getPrismaClient();

		// Verify the message exists on Discord
		try {
			await discordApi.getMessage(channelId, messageId);
		} catch (error) {
			return res.status(400).json({
				success: false,
				error: 'Message not found or bot cannot access it',
			} as ApiResponse);
		}

		// Create reaction role in database
		const reactionRole = await prisma.reactionRole.create({
			data: {
				guildId,
				messageId,
				channelId,
				roleId,
				emoji,
				description: description || null,
				maxUsers: maxUsers || null,
				requiredRoles,
				mode,
				enabled: true,
				usageCount: 0,
			},
		});

		// Add the emoji reaction to the message
		try {
			await discordApi.addReaction(channelId, messageId, emoji);
		} catch (error) {
			logger.warn('Failed to add reaction to message:', error);
		}

		// Broadcast creation
		wsManager.broadcastToGuild(guildId, 'reactionRoleCreate', reactionRole);

		logger.info(`Created reaction role for guild ${guildId}`, {
			reactionRoleId: reactionRole.id,
			messageId,
			roleId,
		});

		res.status(201).json({
			success: true,
			message: 'Reaction role created successfully',
			data: reactionRole,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating reaction role:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create reaction role',
		} as ApiResponse);
	}
};

// Update reaction role
export const updateReactionRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const updates = req.body;
		const prisma = getPrismaClient();

		// Update reaction role
		const updatedRole = await prisma.reactionRole.update({
			where: {
				id: roleId,
				guildId,
			},
			data: {
				...updates,
				updatedAt: new Date(),
			},
		});

		// Broadcast update
		wsManager.broadcastToGuild(guildId, 'reactionRoleUpdate', updatedRole);

		logger.info(
			`Updated reaction role ${roleId} for guild ${guildId}`,
			updates
		);

		res.json({
			success: true,
			message: 'Reaction role updated successfully',
			data: updatedRole,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating reaction role:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update reaction role',
		} as ApiResponse);
	}
};

// Delete reaction role
export const deleteReactionRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const prisma = getPrismaClient();

		// Get reaction role details before deletion
		const reactionRole = await prisma.reactionRole.findFirst({
			where: {
				id: roleId,
				guildId,
			},
		});

		if (!reactionRole) {
			return res.status(404).json({
				success: false,
				error: 'Reaction role not found',
			} as ApiResponse);
		}

		// Delete from database (cascade will handle logs)
		await prisma.reactionRole.delete({
			where: {
				id: roleId,
			},
		});

		// Remove emoji reaction from message
		try {
			await discordApi.removeReaction(
				reactionRole.channelId,
				reactionRole.messageId,
				reactionRole.emoji
			);
		} catch (error) {
			logger.warn('Failed to remove reaction from message:', error);
		}

		// Broadcast deletion
		wsManager.broadcastToGuild(guildId, 'reactionRoleDelete', { id: roleId });

		logger.info(`Deleted reaction role ${roleId} for guild ${guildId}`);

		res.json({
			success: true,
			message: 'Reaction role deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting reaction role:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete reaction role',
		} as ApiResponse);
	}
};

// Get reaction role logs
export const getReactionRoleLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, userId, action, reactionRoleId } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (userId) where.userId = userId;
		if (action) where.action = action;
		if (reactionRoleId) where.reactionRoleId = reactionRoleId;

		// Fetch logs with pagination
		const [logs, total] = await Promise.all([
			prisma.reactionRoleLog.findMany({
				where,
				include: {
					reactionRole: {
						select: {
							roleId: true,
							emoji: true,
							channelId: true,
							messageId: true,
						},
					},
				},
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.reactionRoleLog.count({ where }),
		]);

		res.json({
			success: true,
			data: {
				logs: logs.map((log: any) => ({
					id: log.id,
					userId: log.userId,
					action: log.action,
					timestamp: log.timestamp,
					success: log.success,
					error: log.error,
					reactionRole: log.reactionRole,
				})),
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reaction role logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reaction role logs',
		} as ApiResponse);
	}
};

// Get reaction role statistics
export const getReactionRoleStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get total counts
		const [totalRoles, totalLogs, recentActivity] = await Promise.all([
			prisma.reactionRole.count({ where: { guildId } }),
			prisma.reactionRoleLog.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
			prisma.reactionRoleLog.groupBy({
				by: ['action'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { action: true },
			}),
		]);

		// Get most used reaction roles
		const topRoles = await prisma.reactionRole.findMany({
			where: { guildId },
			orderBy: { usageCount: 'desc' },
			take: 10,
			select: {
				id: true,
				roleId: true,
				emoji: true,
				usageCount: true,
				description: true,
			},
		});

		// Get daily activity
		const dailyActivity = await prisma.reactionRoleLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { timestamp: true },
		});

		// Process daily activity
		const dailyMap = new Map();
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
				totalReactionRoles: totalRoles,
				totalUsages: totalLogs,
				averageUsagesPerDay: Math.round(
					totalLogs / Math.max(1, periodMs / (24 * 60 * 60 * 1000))
				),
			},
			actionBreakdown: {
				added:
					recentActivity.find((a: any) => a.action === 'ADD')?._count.action ||
					0,
				removed:
					recentActivity.find((a: any) => a.action === 'REMOVE')?._count
						.action || 0,
			},
			topReactionRoles: topRoles,
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
		logger.error('Error fetching reaction role statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reaction role statistics',
		} as ApiResponse);
	}
};

// Helper function
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
