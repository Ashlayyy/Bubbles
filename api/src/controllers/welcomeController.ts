import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('welcome-controller');

// Get welcome settings
export const getWelcomeSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Fetch guild config for welcome settings
		let guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		// Create default config if none exists
		if (!guildConfig) {
			guildConfig = await prisma.guildConfig.create({
				data: {
					guildId,
					welcomeEnabled: true,
					goodbyeEnabled: true,
				},
			});
		}

		// Get welcome statistics from moderation logs
		const welcomeStats = await prisma.moderationLog.groupBy({
			by: ['logType'],
			where: {
				guildId,
				logType: { in: ['memberJoin', 'memberLeave'] },
				timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
			},
			_count: { logType: true },
		});

		const totalWelcomes =
			welcomeStats.find((s: any) => s.logType === 'memberJoin')?._count
				.logType || 0;
		const totalGoodbyes =
			welcomeStats.find((s: any) => s.logType === 'memberLeave')?._count
				.logType || 0;

		// Get last welcome time
		const lastWelcome = await prisma.moderationLog.findFirst({
			where: {
				guildId,
				logType: 'memberJoin',
			},
			orderBy: { timestamp: 'desc' },
			select: { timestamp: true },
		});

		// Extract custom welcome stats (roles assigned, dms sent) if stored
		const customStats: any = guildConfig.welcomeStats || {};

		const settings = {
			welcomeEnabled: guildConfig.welcomeEnabled,
			goodbyeEnabled: guildConfig.goodbyeEnabled,
			welcomeChannelId: guildConfig.welcomeChannelId,
			goodbyeChannelId: guildConfig.goodbyeChannelId,
			welcomeMessage:
				'Welcome to {server}, {user}! Please read the rules in #rules.', // Default message
			goodbyeMessage: 'Goodbye {user}! Thanks for being part of {server}.', // Default message
			embedEnabled: true,
			embedColor: '#5865F2',
			assignRoles: guildConfig.moderatorRoleIds ?? [],
			dmWelcome: false,
			dmMessage: 'Welcome to our server! Feel free to ask questions.',
			welcomeImage: {
				enabled: true,
				template: 'default',
				backgroundColor: '#2F3136',
				textColor: '#FFFFFF',
				showAvatar: true,
				showServerIcon: true,
			},
			antiRaid: {
				enabled: true,
				accountAge: 7, // days
				suspiciousPatterns: true,
				autoKick: false,
				quarantineRole: null,
			},
			verification: {
				enabled: false,
				verificationRole: null,
				verificationChannel: null,
				verificationMessage: 'Click the button below to verify yourself!',
				requireCaptcha: false,
			},
			stats: {
				totalWelcomes,
				totalGoodbyes,
				rolesAssigned: customStats.rolesAssigned ?? 0,
				dmsSent: customStats.dmsSent ?? 0,
				lastWelcome: lastWelcome?.timestamp.getTime() || null,
			},
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching welcome settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch welcome settings',
		} as ApiResponse);
	}
};

// Update welcome settings
export const updateWelcomeSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;
		const prisma = getPrismaClient();

		// Update guild config with welcome settings
		const updatedConfig = await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				welcomeEnabled: settings.welcomeEnabled ?? true,
				goodbyeEnabled: settings.goodbyeEnabled ?? true,
				welcomeChannelId: settings.welcomeChannelId,
				goodbyeChannelId: settings.goodbyeChannelId,
			},
			create: {
				guildId,
				welcomeEnabled: settings.welcomeEnabled ?? true,
				goodbyeEnabled: settings.goodbyeEnabled ?? true,
				welcomeChannelId: settings.welcomeChannelId,
				goodbyeChannelId: settings.goodbyeChannelId,
			},
		});

		logger.info(`Updated welcome settings for guild ${guildId}`, settings);

		res.json({
			success: true,
			message: 'Welcome settings updated',
			data: updatedConfig,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating welcome settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update welcome settings',
		} as ApiResponse);
	}
};

// Test welcome message
export const testWelcomeMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { type = 'welcome' } = req.body;

		logger.info(`Test ${type} message for guild ${guildId}`);

		const testResult = {
			success: true,
			messagePreview:
				type === 'welcome'
					? 'Welcome to Test Server, TestUser! Please read the rules in #rules.'
					: 'Goodbye TestUser! Thanks for being part of Test Server.',
			embedPreview: {
				title: type === 'welcome' ? 'Welcome!' : 'Goodbye!',
				description:
					type === 'welcome'
						? 'Welcome to Test Server, TestUser! Please read the rules in #rules.'
						: 'Goodbye TestUser! Thanks for being part of Test Server.',
				color: 0x5865f2,
				thumbnail: {
					url: 'https://cdn.discordapp.com/avatars/123456789/avatar.png',
				},
				footer: {
					text: 'Test Server',
					icon_url: 'https://cdn.discordapp.com/icons/987654321/icon.png',
				},
				timestamp: new Date().toISOString(),
			},
			imagePreview:
				type === 'welcome' ? 'https://example.com/welcome-image.png' : null,
		};

		res.json({
			success: true,
			message: `${type} message test completed`,
			data: testResult,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error testing welcome message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to test welcome message',
		} as ApiResponse);
	}
};

// Get welcome logs
export const getWelcomeLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, type, userId } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = {
			guildId,
			logType: { in: ['memberJoin', 'memberLeave', 'antiRaidTrigger'] },
		};
		if (type) where.logType = type;
		if (userId) where.userId = userId;

		// Fetch logs with pagination
		const [logs, total] = await Promise.all([
			prisma.moderationLog.findMany({
				where,
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.moderationLog.count({ where }),
		]);

		const formattedLogs = logs.map((log: any) => ({
			id: log.id,
			type:
				log.logType === 'memberJoin'
					? 'WELCOME'
					: log.logType === 'memberLeave'
					? 'GOODBYE'
					: 'ANTI_RAID_TRIGGER',
			userId: log.userId,
			channelId: log.channelId,
			messageId: log.metadata?.messageId,
			rolesAssigned: log.metadata?.rolesAssigned || [],
			dmSent: log.metadata?.dmSent || false,
			dmError: log.metadata?.dmError,
			timestamp: log.timestamp.getTime(),
			success: true,
			reason: log.reason,
			action: log.metadata?.action,
			roleAssigned: log.metadata?.roleAssigned,
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
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching welcome logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch welcome logs',
		} as ApiResponse);
	}
};

// Get welcome statistics
export const getWelcomeStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		// Parse period
		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get welcome/goodbye counts
		const stats = await prisma.moderationLog.groupBy({
			by: ['logType'],
			where: {
				guildId,
				logType: { in: ['memberJoin', 'memberLeave'] },
				timestamp: { gte: startDate },
			},
			_count: { logType: true },
		});

		// Get daily activity
		const dailyStats = await prisma.moderationLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				logType: { in: ['memberJoin', 'memberLeave'] },
				timestamp: { gte: startDate },
			},
			_count: { timestamp: true },
		});

		// Process daily stats
		const dailyMap = new Map();
		dailyStats.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		const welcomeCount =
			stats.find((s: any) => s.logType === 'memberJoin')?._count.logType || 0;
		const goodbyeCount =
			stats.find((s: any) => s.logType === 'memberLeave')?._count.logType || 0;

		const statistics = {
			period: period as string,
			welcomes: welcomeCount,
			goodbyes: goodbyeCount,
			netGrowth: welcomeCount - goodbyeCount,
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
		logger.error('Error fetching welcome statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch welcome statistics',
		} as ApiResponse);
	}
};

// Helper function
function parsePeriod(period: string): number {
	const match = period.match(/^(\d+)([dwmy])$/);
	if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

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
