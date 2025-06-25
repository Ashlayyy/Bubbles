import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('welcome-controller');

// Get welcome settings
export const getWelcomeSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Get guild config for welcome settings
		const guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
			select: {
				welcomeChannelId: true,
				welcomeMessage: true,
				welcomeEnabled: true,
				leaveChannelId: true,
				leaveMessage: true,
				leaveEnabled: true,
				welcomeRoleIds: true,
				welcomeEmbedEnabled: true,
				welcomeImageEnabled: true,
				welcomeDMEnabled: true,
				welcomeDMMessage: true,
			},
		});

		const settings = {
			welcome: {
				enabled: guildConfig?.welcomeEnabled || false,
				channelId: guildConfig?.welcomeChannelId || null,
				message: guildConfig?.welcomeMessage || 'Welcome {user} to {server}!',
				embedEnabled: guildConfig?.welcomeEmbedEnabled || false,
				imageEnabled: guildConfig?.welcomeImageEnabled || false,
				roles: guildConfig?.welcomeRoleIds || [],
			},
			leave: {
				enabled: guildConfig?.leaveEnabled || false,
				channelId: guildConfig?.leaveChannelId || null,
				message: guildConfig?.leaveMessage || '{user} has left {server}.',
			},
			dm: {
				enabled: guildConfig?.welcomeDMEnabled || false,
				message:
					guildConfig?.welcomeDMMessage ||
					'Welcome to {server}! Please read the rules.',
			},
		};

		res.success(settings);
	} catch (error) {
		logger.error('Error getting welcome settings:', error);
		res.failure('Failed to get welcome settings', 500);
	}
};

// Update welcome settings
export const updateWelcomeSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { welcome, leave, dm } = req.body;
		const prisma = getPrismaClient();

		// Update guild config
		await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				welcomeEnabled: welcome?.enabled,
				welcomeChannelId: welcome?.channelId,
				welcomeMessage: welcome?.message,
				welcomeEmbedEnabled: welcome?.embedEnabled,
				welcomeImageEnabled: welcome?.imageEnabled,
				welcomeRoleIds: welcome?.roles,
				leaveEnabled: leave?.enabled,
				leaveChannelId: leave?.channelId,
				leaveMessage: leave?.message,
				welcomeDMEnabled: dm?.enabled,
				welcomeDMMessage: dm?.message,
				updatedAt: new Date(),
			},
			create: {
				guildId,
				welcomeEnabled: welcome?.enabled || false,
				welcomeChannelId: welcome?.channelId,
				welcomeMessage: welcome?.message || 'Welcome {user} to {server}!',
				welcomeEmbedEnabled: welcome?.embedEnabled || false,
				welcomeImageEnabled: welcome?.imageEnabled || false,
				welcomeRoleIds: welcome?.roles || [],
				leaveEnabled: leave?.enabled || false,
				leaveChannelId: leave?.channelId,
				leaveMessage: leave?.message || '{user} has left {server}.',
				welcomeDMEnabled: dm?.enabled || false,
				welcomeDMMessage:
					dm?.message || 'Welcome to {server}! Please read the rules.',
			},
		});

		// Broadcast settings update
		wsManager.broadcastToGuild(guildId, 'welcomeSettingsUpdate', {
			welcome,
			leave,
			dm,
		});

		res.success({ welcome, leave, dm });
	} catch (error) {
		logger.error('Error updating welcome settings:', error);
		res.failure('Failed to update welcome settings', 500);
	}
};

// Test welcome message
export const testWelcomeMessage = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { type = 'welcome' } = req.body;

		// Simulate a test message
		const testData = {
			user: req.user?.username || 'TestUser',
			server: 'Test Server',
			memberCount: 100,
			type,
			timestamp: new Date().toISOString(),
		};

		// Broadcast test message
		wsManager.broadcastToGuild(guildId, 'welcomeMessageTest', testData);

		logger.info(`Test ${type} message sent for guild ${guildId}`);

		res.success({ message: `Test ${type} message sent`, testData });
	} catch (error) {
		logger.error('Error sending test welcome message:', error);
		res.failure('Failed to send test welcome message', 500);
	}
};

// Get welcome statistics
export const getWelcomeStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '30d' } = req.query;
		const prisma = getPrismaClient();

		// Calculate date range
		const now = new Date();
		let startDate = new Date();
		switch (timeframe) {
			case '24h':
				startDate.setHours(now.getHours() - 24);
				break;
			case '7d':
				startDate.setDate(now.getDate() - 7);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			default:
				startDate.setDate(now.getDate() - 30);
		}

		// Get member join/leave statistics from audit logs (simplified)
		const auditLogs = await prisma.auditLog.findMany({
			where: {
				guildId,
				action: {
					in: ['MEMBER_JOIN', 'MEMBER_LEAVE'],
				},
				timestamp: {
					gte: startDate,
				},
			},
			orderBy: {
				timestamp: 'desc',
			},
		});

		const joins = auditLogs.filter(
			(log: any) => log.action === 'MEMBER_JOIN'
		).length;
		const leaves = auditLogs.filter(
			(log: any) => log.action === 'MEMBER_LEAVE'
		).length;

		const statistics = {
			timeframe,
			period: {
				start: startDate.toISOString(),
				end: now.toISOString(),
			},
			members: {
				joined: joins,
				left: leaves,
				netGrowth: joins - leaves,
			},
			activity: {
				averageJoinsPerDay: Math.round(
					joins / getDaysDifference(startDate, now)
				),
				averageLeavesPerDay: Math.round(
					leaves / getDaysDifference(startDate, now)
				),
			},
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error getting welcome statistics:', error);
		res.failure('Failed to get welcome statistics', 500);
	}
};

// Get welcome message preview
export const getWelcomePreview = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { message, type = 'welcome' } = req.query;

		if (!message) {
			return res.failure('Message template is required', 400);
		}

		// Replace placeholders with sample data
		const sampleData = {
			user: 'SampleUser',
			server: 'Sample Server',
			memberCount: 150,
			mention: '@SampleUser',
		};

		let processedMessage = message as string;
		Object.entries(sampleData).forEach(([key, value]) => {
			const regex = new RegExp(`{${key}}`, 'g');
			processedMessage = processedMessage.replace(regex, value.toString());
		});

		const preview = {
			original: message,
			processed: processedMessage,
			type,
			sampleData,
		};

		res.success(preview);
	} catch (error) {
		logger.error('Error generating welcome preview:', error);
		res.failure('Failed to generate welcome preview', 500);
	}
};

// Helper function to calculate days difference
function getDaysDifference(startDate: Date, endDate: Date): number {
	const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
}
