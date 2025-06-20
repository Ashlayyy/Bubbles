import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('analytics-controller');

// Get server overview analytics
export const getServerOverview = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get basic counts
		const [moderationCases, totalLogs] = await Promise.all([
			prisma.moderationCase.count({
				where: { guildId, createdAt: { gte: startDate } },
			}),
			prisma.guildConfig.count({
				where: { guildId },
			}),
		]);

		// Get daily activity
		const dailyActivity = await prisma.moderationCase.groupBy({
			by: ['createdAt'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_count: { createdAt: true },
		});

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.createdAt.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.createdAt
			);
		});

		const overview = {
			period: period as string,
			memberCount: 0, // Placeholder
			messageCount: 0, // Placeholder
			moderationCases,
			logsConfigured: totalLogs,
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.json({
			success: true,
			data: overview,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching server overview:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch server overview',
		} as ApiResponse);
	}
};

// Get user activity analytics
export const getUserActivity = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get user activity from moderation cases
		const userActivity = await prisma.moderationCase.groupBy({
			by: ['userId'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_count: { userId: true },
			orderBy: { _count: { userId: 'desc' } },
			take: 20,
		});

		const processedUsers = await Promise.all(
			userActivity.map(async (user: any) => {
				const actions = await prisma.moderationCase.groupBy({
					by: ['type'],
					where: {
						guildId,
						userId: user.userId,
						createdAt: { gte: startDate },
					},
					_count: { type: true },
				});

				return {
					userId: user.userId,
					totalActions: user._count.userId,
					actions: actions.reduce((acc: any, action: any) => {
						acc[action.type] = action._count.type;
						return acc;
					}, {}),
				};
			})
		);

		res.json({
			success: true,
			data: {
				period: period as string,
				users: processedUsers,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching user activity:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch user activity',
		} as ApiResponse);
	}
};

// Get command usage analytics
export const getCommandUsage = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get custom command usage
		const [customCommandsDaily, customCommands] = await Promise.all([
			prisma.customCommandLog.groupBy({
				by: ['timestamp'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { timestamp: true },
			}),
			prisma.customCommandLog.groupBy({
				by: ['commandName'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { commandName: true },
				orderBy: { _count: { commandName: 'desc' } },
				take: 20,
			}),
		]);

		// Process daily activity
		const dailyMap = new Map<string, number>();
		customCommandsDaily.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		const processedCommands = await Promise.all(
			customCommands.map(async (cmd: any) => {
				const successCount = await prisma.customCommandLog.count({
					where: {
						guildId,
						commandName: cmd.commandName,
						success: true,
						timestamp: { gte: startDate },
					},
				});

				return {
					commandName: cmd.commandName,
					totalExecutions: cmd._count.commandName,
					successRate: Math.round(
						(successCount / cmd._count.commandName) * 100
					),
				};
			})
		);

		const totalExecutions = customCommands.reduce(
			(sum: number, cmd: any) => sum + cmd._count.commandName,
			0
		);

		res.json({
			success: true,
			data: {
				period: period as string,
				overview: {
					totalExecutions,
					uniqueCommands: customCommands.length,
					averagePerDay: Math.round(
						totalExecutions / Math.max(1, periodMs / (24 * 60 * 60 * 1000))
					),
				},
				commands: processedCommands,
				dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
					date,
					count,
				})),
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching command usage:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch command usage',
		} as ApiResponse);
	}
};

// Get moderation analytics
export const getModerationAnalytics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get moderation statistics
		const [totalCases, actionBreakdown, moderatorActivity] = await Promise.all([
			prisma.moderationCase.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
			}),
			prisma.moderationCase.groupBy({
				by: ['type'],
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
				_count: { type: true },
			}),
			prisma.moderationCase.groupBy({
				by: ['moderatorId'],
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
				_count: { moderatorId: true },
				orderBy: { _count: { moderatorId: 'desc' } },
				take: 10,
			}),
		]);

		// Get daily moderation activity
		const dailyModeration = await prisma.moderationCase.groupBy({
			by: ['createdAt'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_count: { createdAt: true },
		});

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyModeration.forEach((day: any) => {
			const dateKey = day.createdAt.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.createdAt
			);
		});

		// Get auto-moderation vs manual actions
		const [autoActions, manualActions] = await Promise.all([
			prisma.moderationCase.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
					moderatorId: 'automod',
				},
			}),
			prisma.moderationCase.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
					moderatorId: { not: 'automod' },
				},
			}),
		]);

		const moderationAnalytics = {
			period: period as string,
			overview: {
				totalCases,
				autoActions,
				manualActions,
				automationRate:
					totalCases > 0 ? Math.round((autoActions / totalCases) * 100) : 0,
				averagePerDay: Math.round(
					totalCases / Math.max(1, periodMs / (24 * 60 * 60 * 1000))
				),
			},
			actionTypes: actionBreakdown.reduce((acc: any, action: any) => {
				acc[action.type] = action._count.type;
				return acc;
			}, {}),
			topModerators: moderatorActivity.map((mod: any) => ({
				moderatorId: mod.moderatorId,
				actions: mod._count.moderatorId,
			})),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				cases: count,
			})),
		};

		res.json({
			success: true,
			data: moderationAnalytics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderation analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderation analytics',
		} as ApiResponse);
	}
};

// Get feature usage analytics
export const getFeatureUsage = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get feature usage stats
		const [
			reactionRoleUsage,
			ticketActivity,
			musicActivity,
			automationExecutions,
		] = await Promise.all([
			prisma.reactionRoleLog.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
			prisma.ticket.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
			}),
			prisma.musicTrackHistory.count({
				where: {
					guildId,
					playedAt: { gte: startDate },
				},
			}),
			prisma.automationRuleExecution.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
		]);

		// Get timeline data
		const timeline = await prisma.reactionRoleLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { timestamp: true },
		});

		// Process timeline
		const timelineMap = new Map<string, number>();
		timeline.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			timelineMap.set(
				dateKey,
				(timelineMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		const featureUsage = {
			period: period as string,
			overview: {
				reactionRoles: reactionRoleUsage,
				tickets: ticketActivity,
				music: musicActivity,
				automation: automationExecutions,
				totalFeatureUsage:
					reactionRoleUsage +
					ticketActivity +
					musicActivity +
					automationExecutions,
			},
			timeline: Array.from(timelineMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.json({
			success: true,
			data: featureUsage,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching feature usage:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch feature usage',
		} as ApiResponse);
	}
};

// Get comprehensive analytics report
export const getAnalyticsReport = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;

		// Get all analytics data
		const [
			serverOverview,
			userActivity,
			commandUsage,
			moderationAnalytics,
			featureUsage,
		] = await Promise.all([
			getServerOverviewData(guildId, period as string),
			getUserActivityData(guildId, period as string),
			getCommandUsageData(guildId, period as string),
			getModerationAnalyticsData(guildId, period as string),
			getFeatureUsageData(guildId, period as string),
		]);

		const report = {
			guildId,
			period: period as string,
			generatedAt: new Date().toISOString(),
			serverOverview,
			userActivity,
			commandUsage,
			moderationAnalytics,
			featureUsage,
		};

		res.json({
			success: true,
			data: report,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error generating analytics report:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to generate analytics report',
		} as ApiResponse);
	}
};

// Helper functions
const getServerOverviewData = async (guildId: string, period: string) => {
	const prisma = getPrismaClient();
	const periodMs = parsePeriod(period);
	const startDate = new Date(Date.now() - periodMs);

	const moderationCases = await prisma.moderationCase.count({
		where: { guildId, createdAt: { gte: startDate } },
	});

	return { moderationCases };
};

const getUserActivityData = async (guildId: string, period: string) => {
	const prisma = getPrismaClient();
	const periodMs = parsePeriod(period);
	const startDate = new Date(Date.now() - periodMs);

	const userActivity = await prisma.moderationCase.groupBy({
		by: ['userId'],
		where: { guildId, createdAt: { gte: startDate } },
		_count: { userId: true },
		take: 10,
	});

	return { users: userActivity.length };
};

const getCommandUsageData = async (guildId: string, period: string) => {
	const prisma = getPrismaClient();
	const periodMs = parsePeriod(period);
	const startDate = new Date(Date.now() - periodMs);

	const commandUsage = await prisma.customCommandLog.count({
		where: { guildId, timestamp: { gte: startDate } },
	});

	return { totalExecutions: commandUsage };
};

const getModerationAnalyticsData = async (guildId: string, period: string) => {
	const prisma = getPrismaClient();
	const periodMs = parsePeriod(period);
	const startDate = new Date(Date.now() - periodMs);

	const totalCases = await prisma.moderationCase.count({
		where: { guildId, createdAt: { gte: startDate } },
	});

	return { totalCases };
};

const getFeatureUsageData = async (guildId: string, period: string) => {
	const prisma = getPrismaClient();
	const periodMs = parsePeriod(period);
	const startDate = new Date(Date.now() - periodMs);

	const reactionRoleUsage = await prisma.reactionRoleLog.count({
		where: { guildId, timestamp: { gte: startDate } },
	});

	return { reactionRoles: reactionRoleUsage };
};

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

// -----------------------------------------------------------------------------
// Aliases for route compatibility
// -----------------------------------------------------------------------------
export { getServerOverview as getAnalyticsOverview };
export { getUserActivity as getMemberAnalytics };
export { getCommandUsage as getMessageAnalytics };
export { getFeatureUsage as getActivityAnalytics };
