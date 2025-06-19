import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('leveling-controller');

// Schema might not exist yet, so we'll create a simple User XP tracking model conceptually
interface UserLevel {
	userId: string;
	guildId: string;
	xp: number;
	level: number;
	messages: number;
}

// Get leveling settings
export const getLevelingSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// For now, we'll use guild config or create a simple leveling settings structure
		// In a real implementation, you'd want a dedicated LevelingSettings table
		let guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		if (!guildConfig) {
			guildConfig = await prisma.guildConfig.create({
				data: { guildId },
			});
		}

		// Default leveling settings (in a real app, store these in a dedicated table)
		const settings = {
			enabled: true,
			xpPerMessage: 15,
			xpCooldown: 60, // seconds
			levelUpMessage: 'Congratulations {user}! You reached level {level}! 🎉',
			levelUpChannel: null, // Could be stored in guild config
			ignoredChannels: [],
			ignoredRoles: [],
			multiplierRoles: [],
			stackMultipliers: false,
			noXpRoles: [],
			levelRoles: [],
			removeOldLevelRoles: true,
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching leveling settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch leveling settings',
		} as ApiResponse);
	}
};

// Update leveling settings
export const updateLevelingSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;

		// In a real implementation, you'd update the leveling settings table
		// For now, we'll just log the update
		logger.info(`Update leveling settings for guild ${guildId}`, settings);

		res.json({
			success: true,
			message: 'Leveling settings updated',
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating leveling settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update leveling settings',
		} as ApiResponse);
	}
};

// Get leaderboard
export const getLeaderboard = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, period = 'all' } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Since we don't have a dedicated user levels table yet,
		// we'll simulate this using moderation logs for message activity
		// In a real implementation, you'd have a UserLevels table

		// Get message activity from logs as a proxy for XP
		const messageActivity = await prisma.moderationLog.groupBy({
			by: ['userId'],
			where: {
				guildId,
				logType: 'messageCreate', // Assuming this log type exists
				...(period !== 'all' && {
					timestamp: {
						gte: new Date(Date.now() - parsePeriod(period as string)),
					},
				}),
			},
			_count: { userId: true },
			orderBy: { _count: { userId: 'desc' } },
			skip,
			take,
		});

		// Simulate user level data
		const leaderboard = messageActivity.map((activity, index) => {
			const messageCount = activity._count.userId;
			const xp = messageCount * 15; // 15 XP per message
			const level = Math.floor(Math.sqrt(xp / 100)); // Simple level calculation
			const xpForLevel = level * level * 100;
			const xpToNext = (level + 1) * (level + 1) * 100 - xp;

			return {
				userId: activity.userId,
				username: `User${activity.userId.slice(-4)}`, // Placeholder
				avatar: null,
				level,
				xp,
				xpToNext,
				xpForLevel,
				rank: skip + index + 1,
				messagesCount: messageCount,
				joinedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Placeholder
			};
		});

		// Get total count for pagination
		const totalUsers = await prisma.moderationLog.groupBy({
			by: ['userId'],
			where: {
				guildId,
				logType: 'messageCreate',
			},
			_count: { userId: true },
		});

		res.json({
			success: true,
			data: {
				users: leaderboard,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total: totalUsers.length,
					pages: Math.ceil(totalUsers.length / take),
				},
				stats: {
					totalUsers: totalUsers.length,
					averageLevel:
						leaderboard.length > 0
							? leaderboard.reduce((sum, user) => sum + user.level, 0) /
							  leaderboard.length
							: 0,
					highestLevel:
						leaderboard.length > 0
							? Math.max(...leaderboard.map((u) => u.level))
							: 0,
					totalXP: leaderboard.reduce((sum, user) => sum + user.xp, 0),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching leaderboard:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch leaderboard',
		} as ApiResponse);
	}
};

// Get user level info
export const getUserLevel = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const prisma = getPrismaClient();

		// Get user's message count from logs
		const messageCount = await prisma.moderationLog.count({
			where: {
				guildId,
				userId,
				logType: 'messageCreate',
			},
		});

		// Calculate level and XP
		const xp = messageCount * 15;
		const level = Math.floor(Math.sqrt(xp / 100));
		const xpForLevel = level * level * 100;
		const xpToNext = (level + 1) * (level + 1) * 100 - xp;

		// Get user's rank
		const allUsers = await prisma.moderationLog.groupBy({
			by: ['userId'],
			where: {
				guildId,
				logType: 'messageCreate',
			},
			_count: { userId: true },
			orderBy: { _count: { userId: 'desc' } },
		});

		const rank = allUsers.findIndex((user) => user.userId === userId) + 1;

		// Get recent XP history (last 7 days)
		const recentActivity = await prisma.moderationLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				userId,
				logType: 'messageCreate',
				timestamp: {
					gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
				},
			},
			_count: { timestamp: true },
		});

		// Process into daily XP history
		const xpHistory = [];
		for (let i = 6; i >= 0; i--) {
			const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
			const dateKey = date.toISOString().split('T')[0];
			const dayActivity = recentActivity.find(
				(a) => a.timestamp.toISOString().split('T')[0] === dateKey
			);
			xpHistory.push({
				date: dateKey,
				xp: (dayActivity?._count.timestamp || 0) * 15,
			});
		}

		const userLevel = {
			userId,
			username: `User${userId.slice(-4)}`, // Placeholder
			avatar: null,
			level,
			xp,
			xpToNext,
			xpForLevel,
			rank: rank || 0,
			messagesCount: messageCount,
			joinedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Placeholder
			levelHistory: [], // TODO: Track level achievements
			xpHistory,
		};

		res.json({
			success: true,
			data: userLevel,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching user level:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch user level',
		} as ApiResponse);
	}
};

// Set user level (admin function)
export const setUserLevel = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { level, xp } = req.body;

		// In a real implementation, you'd update the user's level/XP in the database
		// For now, we'll just return success
		logger.info(`Set user level for ${userId} in guild ${guildId}`, {
			level,
			xp,
		});

		res.json({
			success: true,
			message: 'User level updated successfully',
			data: { userId, level, xp },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error setting user level:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to set user level',
		} as ApiResponse);
	}
};

// Get level rewards
export const getLevelRewards = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// In a real implementation, you'd fetch from a LevelRewards table
		const rewards = [
			{
				id: '1',
				level: 5,
				type: 'ROLE',
				roleId: '123456789',
				roleName: 'Level 5',
				description: 'Reached level 5!',
			},
			{
				id: '2',
				level: 10,
				type: 'ROLE',
				roleId: '987654321',
				roleName: 'Level 10',
				description: 'Reached level 10!',
			},
		];

		res.json({
			success: true,
			data: { rewards },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching level rewards:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch level rewards',
		} as ApiResponse);
	}
};

// Add level reward
export const addLevelReward = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const rewardData = req.body;

		// In a real implementation, you'd add to LevelRewards table
		logger.info(`Add level reward for guild ${guildId}`, rewardData);

		const reward = {
			id: Date.now().toString(),
			...rewardData,
		};

		res.status(201).json({
			success: true,
			message: 'Level reward added successfully',
			data: reward,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding level reward:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add level reward',
		} as ApiResponse);
	}
};

// Remove level reward
export const removeLevelReward = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, rewardId } = req.params;

		// In a real implementation, you'd delete from LevelRewards table
		logger.info(`Remove level reward ${rewardId} from guild ${guildId}`);

		res.json({
			success: true,
			message: 'Level reward removed successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error removing level reward:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to remove level reward',
		} as ApiResponse);
	}
};

// Get leveling statistics
export const getLevelingStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get message activity stats
		const messageStats = await prisma.moderationLog.count({
			where: {
				guildId,
				logType: 'messageCreate',
				timestamp: { gte: startDate },
			},
		});

		// Get active users count
		const activeUsers = await prisma.moderationLog.groupBy({
			by: ['userId'],
			where: {
				guildId,
				logType: 'messageCreate',
				timestamp: { gte: startDate },
			},
			_count: { userId: true },
		});

		const statistics = {
			period: period as string,
			totalMessages: messageStats,
			activeUsers: activeUsers.length,
			averageMessagesPerUser:
				activeUsers.length > 0
					? Math.round(messageStats / activeUsers.length)
					: 0,
			totalXpAwarded: messageStats * 15,
		};

		res.json({
			success: true,
			data: statistics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching leveling statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch leveling statistics',
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
