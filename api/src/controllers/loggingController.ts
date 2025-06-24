import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('logging-controller');

// Get logging settings
export const getLoggingSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Fetch log settings from database
		let logSettings = await prisma.logSettings.findUnique({
			where: { guildId },
		});

		// Create default settings if none exist
		if (!logSettings) {
			logSettings = await prisma.logSettings.create({
				data: {
					guildId,
					channelRouting: {
						moderation: null,
						member: null,
						message: null,
						voice: null,
						role: null,
						channel: null,
						server: null,
						music: null,
					},
					ignoredUsers: [],
					ignoredRoles: [],
					ignoredChannels: [],
					enabledLogTypes: [
						'memberJoin',
						'memberLeave',
						'messageDelete',
						'messageBulkDelete',
						'moderation',
						'roleCreate',
						'roleDelete',
						'channelCreate',
						'channelDelete',
						'serverUpdate',
					],
				},
			});
		}

		const settings = {
			enabled: true,
			channels: logSettings.channelRouting as any,
			events: {
				memberJoin: logSettings.enabledLogTypes.includes('memberJoin'),
				memberLeave: logSettings.enabledLogTypes.includes('memberLeave'),
				memberUpdate: logSettings.enabledLogTypes.includes('memberUpdate'),
				messageDelete: logSettings.enabledLogTypes.includes('messageDelete'),
				messageEdit: logSettings.enabledLogTypes.includes('messageEdit'),
				messageBulkDelete:
					logSettings.enabledLogTypes.includes('messageBulkDelete'),
				voiceJoin: logSettings.enabledLogTypes.includes('voiceJoin'),
				voiceLeave: logSettings.enabledLogTypes.includes('voiceLeave'),
				voiceMove: logSettings.enabledLogTypes.includes('voiceMove'),
				roleCreate: logSettings.enabledLogTypes.includes('roleCreate'),
				roleDelete: logSettings.enabledLogTypes.includes('roleDelete'),
				roleUpdate: logSettings.enabledLogTypes.includes('roleUpdate'),
				channelCreate: logSettings.enabledLogTypes.includes('channelCreate'),
				channelDelete: logSettings.enabledLogTypes.includes('channelDelete'),
				channelUpdate: logSettings.enabledLogTypes.includes('channelUpdate'),
				serverUpdate: logSettings.enabledLogTypes.includes('serverUpdate'),
				moderation: logSettings.enabledLogTypes.includes('moderation'),
				musicPlay: logSettings.enabledLogTypes.includes('musicPlay'),
				musicStop: logSettings.enabledLogTypes.includes('musicStop'),
			},
			ignoredChannels: logSettings.ignoredChannels,
			ignoredRoles: logSettings.ignoredRoles,
			ignoredUsers: logSettings.ignoredUsers,
			customFormats: logSettings.customFormats,
			filterRules: logSettings.filterRules,
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching logging settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch logging settings',
		} as ApiResponse);
	}
};

// Update logging settings
export const updateLoggingSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;
		const prisma = getPrismaClient();

		// Convert events back to enabledLogTypes array
		const enabledLogTypes: string[] = [];
		if (settings.events) {
			Object.entries(settings.events).forEach(([event, enabled]) => {
				if (enabled) enabledLogTypes.push(event);
			});
		}

		// Update log settings
		const updatedSettings = await prisma.logSettings.upsert({
			where: { guildId },
			update: {
				channelRouting: settings.channels || {},
				ignoredUsers: settings.ignoredUsers || [],
				ignoredRoles: settings.ignoredRoles || [],
				ignoredChannels: settings.ignoredChannels || [],
				enabledLogTypes,
				customFormats: settings.customFormats,
				filterRules: settings.filterRules,
			},
			create: {
				guildId,
				channelRouting: settings.channels || {},
				ignoredUsers: settings.ignoredUsers || [],
				ignoredRoles: settings.ignoredRoles || [],
				ignoredChannels: settings.ignoredChannels || [],
				enabledLogTypes,
				customFormats: settings.customFormats,
				filterRules: settings.filterRules,
			},
		});

		logger.info(`Updated logging settings for guild ${guildId}`, {
			enabledLogTypes: enabledLogTypes.length,
		});

		res.json({
			success: true,
			message: 'Logging settings updated',
			data: updatedSettings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating logging settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update logging settings',
		} as ApiResponse);
	}
};

// Get audit logs
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, type, userId, before, after } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (type) where.logType = type;
		if (userId) where.userId = userId;
		if (before || after) {
			where.timestamp = {};
			if (before) where.timestamp.lt = new Date(parseInt(before as string));
			if (after) where.timestamp.gt = new Date(parseInt(after as string));
		}

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
			type: log.logType,
			timestamp: log.timestamp.getTime(),
			userId: log.userId,
			channelId: log.channelId,
			roleId: log.roleId,
			description: getLogDescription(log),
			data: {
				before: log.before,
				after: log.after,
				metadata: log.metadata,
				content: log.content,
				attachments: log.attachments,
				embeds: log.embeds,
				executorId: log.executorId,
				reason: log.reason,
			},
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
		logger.error('Error fetching audit logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch audit logs',
		} as ApiResponse);
	}
};

// Export audit logs
export const exportAuditLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { format = 'json', dateFrom, dateTo, types } = req.query;
		const prisma = getPrismaClient();

		// Build where clause for export
		const where: any = { guildId };
		if (dateFrom || dateTo) {
			where.timestamp = {};
			if (dateFrom) where.timestamp.gte = new Date(dateFrom as string);
			if (dateTo) where.timestamp.lte = new Date(dateTo as string);
		}
		if (types) {
			const typeArray = Array.isArray(types) ? types : [types];
			where.logType = { in: typeArray };
		}

		// Get count for estimation
		const totalLogs = await prisma.moderationLog.count({ where });

		// Create export job (simplified for now - in production, this would be queued)
		const exportId = `export_${Date.now()}`;

		logger.info(`Export audit logs for guild ${guildId}`, {
			format,
			dateFrom,
			dateTo,
			types,
			totalLogs,
		});

		res.json({
			success: true,
			message: 'Audit log export initiated',
			data: {
				exportId,
				status: 'processing',
				totalLogs,
				estimatedCompletion: Date.now() + Math.min(totalLogs * 10, 30000), // Estimate based on log count
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error exporting audit logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to export audit logs',
		} as ApiResponse);
	}
};

// Get log statistics
export const getLogStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		// Calculate date range
		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get event counts by type
		const logCounts = await prisma.moderationLog.groupBy({
			by: ['logType'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { logType: true },
		});

		// Get daily activity
		const dailyActivity = await prisma.moderationLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { timestamp: true },
		});

		// Process daily activity into proper format
		const dailyActivityMap = new Map();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			dailyActivityMap.set(
				dateKey,
				(dailyActivityMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		// Fill missing days with 0
		const dailyActivityArray = [];
		const dayMs = 24 * 60 * 60 * 1000;
		for (let i = Math.floor(periodMs / dayMs); i >= 0; i--) {
			const date = new Date(Date.now() - i * dayMs);
			const dateKey = date.toISOString().split('T')[0];
			dailyActivityArray.push({
				date: dateKey,
				count: dailyActivityMap.get(dateKey) || 0,
			});
		}

		const eventBreakdown: any = {};
		let totalEvents = 0;
		logCounts.forEach((count: any) => {
			eventBreakdown[count.logType] = count._count.logType;
			totalEvents += count._count.logType;
		});

		const stats = {
			period: period as string,
			totalEvents,
			eventBreakdown,
			dailyActivity: dailyActivityArray,
		};

		res.json({
			success: true,
			data: stats,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching log statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch log statistics',
		} as ApiResponse);
	}
};

// Helper functions
function getLogDescription(log: any): string {
	switch (log.logType) {
		case 'memberJoin':
			return `User joined the server`;
		case 'memberLeave':
			return `User left the server`;
		case 'messageDelete':
			return `Message deleted in channel`;
		case 'messageBulkDelete':
			return `Messages bulk deleted in channel`;
		case 'moderation':
			return `Moderation action taken`;
		default:
			return `${log.logType} event occurred`;
	}
}

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
