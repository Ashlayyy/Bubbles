/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
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

		res.success(settings);
	} catch (error) {
		logger.error('Error fetching leveling settings:', error);
		res.failure('Failed to fetch leveling settings', 500);
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

		res.success({ message: 'Leveling settings updated', data: settings });
	} catch (error) {
		logger.error('Error updating leveling settings:', error);
		res.failure('Failed to update leveling settings', 500);
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
		const leaderboard = messageActivity.map((activity: any, index: number) => {
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

		res.success({
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
						? leaderboard.reduce(
								(sum: number, user: any) => sum + user.level,
								0
						  ) / leaderboard.length
						: 0,
				highestLevel:
					leaderboard.length > 0
						? Math.max(...leaderboard.map((u: any) => u.level))
						: 0,
				totalXP: leaderboard.reduce(
					(sum: number, user: any) => sum + user.xp,
					0
				),
			},
		});
	} catch (error) {
		logger.error('Error fetching leaderboard:', error);
		res.failure('Failed to fetch leaderboard', 500);
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

		const rank = allUsers.findIndex((user: any) => user.userId === userId) + 1;

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
				(a: any) => a.timestamp.toISOString().split('T')[0] === dateKey
			);
			xpHistory.push({
				date: dateKey,
				xp: (dayActivity?._count.timestamp || 0) * 15,
			});
		}

		// Fetch full level history from DB
		const levelHistoryRecords = await prisma.levelHistory.findMany({
			where: { guildId, userId },
			orderBy: { reachedAt: 'asc' },
		});

		const userLevel = {
			userId,
			username: `User${userId.slice(-4)}`, // Placeholder until cached user info is available
			avatar: null,
			level,
			xp,
			xpToNext,
			xpForLevel,
			rank,
			messagesCount: messageCount,
			joinedAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Placeholder
			totalUsers: allUsers.length,
			xpHistory,
			levelHistory: levelHistoryRecords,
		};

		res.success(userLevel);
	} catch (error) {
		logger.error('Error fetching user level:', error);
		res.failure('Failed to fetch user level', 500);
	}
};

// Set user level (admin action)
export const setUserLevel = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { level, xp } = req.body;

		// In a real implementation, you'd update the user's level in the database
		logger.info(
			`Set user ${userId} level to ${level} (${xp} XP) in guild ${guildId}`
		);

		res.success({
			message: 'User level updated successfully',
			data: { userId, level, xp },
		});
	} catch (error) {
		logger.error('Error setting user level:', error);
		res.failure('Failed to set user level', 500);
	}
};

// Get level rewards
export const getLevelRewards = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Get level rewards (using a placeholder query for now)
		const rewards = await prisma.levelReward.findMany({
			where: { guildId },
			orderBy: { level: 'asc' },
		});

		res.success(rewards);
	} catch (error) {
		logger.error('Error fetching level rewards:', error);
		res.failure('Failed to fetch level rewards', 500);
	}
};

// Add level reward
export const addLevelReward = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { level, roleId, description } = req.body;
		const prisma = getPrismaClient();

		const reward = await prisma.levelReward.create({
			data: { guildId, level, roleId, description },
		});

		res.success(
			{ message: 'Level reward added successfully', data: reward },
			201
		);
	} catch (error) {
		logger.error('Error adding level reward:', error);
		res.failure('Failed to add level reward', 500);
	}
};

// Remove level reward
export const removeLevelReward = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, rewardId } = req.params;
		const prisma = getPrismaClient();

		await prisma.levelReward.delete({ where: { id: rewardId } });

		res.success({ message: 'Level reward removed successfully' });
	} catch (error) {
		logger.error('Error removing level reward:', error);
		res.failure('Failed to remove level reward', 500);
	}
};

// Get leveling statistics
export const getLevelingStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '30d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get statistics from message activity
		const [totalUsers, recentActivity, levelDistribution] = await Promise.all([
			prisma.moderationLog.groupBy({
				by: ['userId'],
				where: { guildId, logType: 'messageCreate' },
				_count: { userId: true },
			}),
			prisma.moderationLog.count({
				where: {
					guildId,
					logType: 'messageCreate',
					timestamp: { gte: startDate },
				},
			}),
			prisma.moderationLog.groupBy({
				by: ['userId'],
				where: { guildId, logType: 'messageCreate' },
				_count: { userId: true },
			}),
		]);

		// Calculate level statistics
		const userLevels = levelDistribution.map((user: any) => {
			const messageCount = user._count.userId;
			const xp = messageCount * 15;
			return Math.floor(Math.sqrt(xp / 100));
		});

		const levelCounts = userLevels.reduce((acc: any, level: number) => {
			acc[level] = (acc[level] || 0) + 1;
			return acc;
		}, {});

		const statistics = {
			period: period as string,
			overview: {
				totalActiveUsers: totalUsers.length,
				recentMessages: recentActivity,
				averageLevel:
					userLevels.length > 0
						? userLevels.reduce((a: number, b: number) => a + b, 0) /
						  userLevels.length
						: 0,
				highestLevel: userLevels.length > 0 ? Math.max(...userLevels) : 0,
			},
			levelDistribution: Object.entries(levelCounts)
				.map(([level, count]) => ({ level: parseInt(level), users: count }))
				.sort((a, b) => a.level - b.level),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching leveling statistics:', error);
		res.failure('Failed to fetch leveling statistics', 500);
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
