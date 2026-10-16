/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('leveling-controller');

const DEFAULT_LEVELING_SETTINGS = {
	enabled: true,
	xpPerMessage: 15,
	xpCooldown: 60,
	levelUpMessage: 'Congratulations {user}! You reached level {level}!',
	levelUpChannel: null,
	ignoredChannels: [] as string[],
	ignoredRoles: [] as string[],
	multiplierRoles: [] as unknown[],
	stackMultipliers: false,
	noXpRoles: [] as string[],
	levelRoles: [] as unknown[],
	removeOldLevelRoles: true,
};

function xpForLevel(level: number): number {
	return level * level * 100;
}

function levelFromXp(xp: number): number {
	return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

// Get leveling settings
export const getLevelingSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		let guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		if (!guildConfig) {
			guildConfig = await prisma.guildConfig.create({
				data: { guildId },
			});
		}

		const stored =
			guildConfig.levelingSettings &&
			typeof guildConfig.levelingSettings === 'object'
				? (guildConfig.levelingSettings as Record<string, unknown>)
				: {};

		res.success({ ...DEFAULT_LEVELING_SETTINGS, ...stored });
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
		const prisma = getPrismaClient();

		const guildConfig = await prisma.guildConfig.upsert({
			where: { guildId },
			create: { guildId, levelingSettings: settings },
			update: { levelingSettings: settings },
		});

		res.success({
			message: 'Leveling settings updated',
			data: guildConfig.levelingSettings,
		});
	} catch (error) {
		logger.error('Error updating leveling settings:', error);
		res.failure('Failed to update leveling settings', 500);
	}
};

// Get leaderboard
export const getLeaderboard = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50 } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		const [rows, totalUsers] = await Promise.all([
			prisma.userXp.findMany({
				where: { guildId },
				orderBy: { xp: 'desc' },
				skip,
				take,
			}),
			prisma.userXp.count({ where: { guildId } }),
		]);

		const leaderboard = rows.map(
			(
				row: { userId: string; level: number; xp: number; messages: number; updatedAt: Date },
				index: number
			) => ({
			userId: row.userId,
			username: `User${row.userId.slice(-4)}`,
			avatar: null,
			level: row.level,
			xp: row.xp,
			xpToNext: xpForLevel(row.level + 1) - row.xp,
			xpForLevel: xpForLevel(row.level),
			rank: skip + index + 1,
			messagesCount: row.messages,
			joinedAt: row.updatedAt.getTime(),
		}));

		res.success({
			users: leaderboard,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total: totalUsers,
				pages: Math.ceil(totalUsers / take),
			},
			stats: {
				totalUsers,
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

		const record = await prisma.userXp.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		const xp = record?.xp ?? 0;
		const level = record?.level ?? levelFromXp(xp);
		const messagesCount = record?.messages ?? 0;
		const xpForCurrent = xpForLevel(level);
		const xpToNext = xpForLevel(level + 1) - xp;

		const higher = await prisma.userXp.count({
			where: { guildId, xp: { gt: xp } },
		});
		const rank = record ? higher + 1 : 0;
		const totalUsers = await prisma.userXp.count({ where: { guildId } });

		const levelHistoryRecords = await prisma.levelHistory.findMany({
			where: { guildId, userId },
			orderBy: { reachedAt: 'asc' },
		});

		res.success({
			userId,
			username: `User${userId.slice(-4)}`,
			avatar: null,
			level,
			xp,
			xpToNext,
			xpForLevel: xpForCurrent,
			rank,
			messagesCount,
			joinedAt: record?.updatedAt.getTime() ?? Date.now(),
			totalUsers,
			xpHistory: [],
			levelHistory: levelHistoryRecords,
		});
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
		const prisma = getPrismaClient();
		const nextXp = typeof xp === 'number' ? xp : xpForLevel(Number(level) || 0);
		const nextLevel = typeof level === 'number' ? level : levelFromXp(nextXp);

		const record = await prisma.userXp.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: {
				guildId,
				userId,
				xp: nextXp,
				level: nextLevel,
			},
			update: {
				xp: nextXp,
				level: nextLevel,
			},
		});

		res.success({
			message: 'User level updated successfully',
			data: { userId, level: record.level, xp: record.xp },
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

		const rows = await prisma.userXp.findMany({
			where: { guildId },
			select: { userId: true, xp: true, level: true, messages: true, updatedAt: true },
		});
		const recentCutoff = startDate.getTime();
		const recentMessages = rows.reduce(
			(sum: number, row: { updatedAt: Date; messages: number }) =>
				row.updatedAt.getTime() >= recentCutoff ? sum + row.messages : sum,
			0
		);
		const userLevels = rows.map((row: { level: number }) => row.level);

		const levelCounts = userLevels.reduce((acc: any, level: number) => {
			acc[level] = (acc[level] || 0) + 1;
			return acc;
		}, {});

		const statistics = {
			period: period as string,
			overview: {
				totalActiveUsers: rows.length,
				recentMessages,
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
