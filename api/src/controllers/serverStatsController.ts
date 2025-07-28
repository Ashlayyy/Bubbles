import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('server-stats-controller');

// Helper function to create WebSocket message
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'SYSTEM',
		event: event,
		data,
		timestamp: Date.now(),
		messageId: generateId(),
	};
}

// Helper function to generate ID
function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
}

interface ServerStatsSnapshot {
	guildId: string;
	memberCount: number;
	onlineCount: number;
	channelCount: number;
	roleCount: number;
	messageCount24h: number;
	moderationCases24h: number;
	ticketsCreated24h: number;
	commandsExecuted24h: number;
	voiceMinutes24h: number;
	reactionRoleUsage24h: number;
	timestamp: Date;
}

interface GrowthMetrics {
	memberGrowth: number;
	messageGrowth: number;
	activityGrowth: number;
	retentionRate: number;
	engagementRate: number;
}

interface ActivityMetrics {
	messagesByHour: Array<{ hour: number; count: number }>;
	messagesByChannel: Array<{
		channelId: string;
		channelName: string;
		count: number;
	}>;
	topUsers: Array<{
		userId: string;
		username: string;
		messageCount: number;
		lastActive: Date;
	}>;
	commandUsage: Array<{ command: string; count: number }>;
	voiceActivity: Array<{
		channelId: string;
		channelName: string;
		minutes: number;
	}>;
}

// Get current server statistics
export const getServerStats = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const now = new Date();
		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// Get basic counts from Discord API (these would be fetched from bot)
		// For now, using placeholder values that would be populated by Discord API
		const basicStats = {
			memberCount: 0, // To be populated by Discord API
			onlineCount: 0, // To be populated by Discord API
			channelCount: 0, // To be populated by Discord API
			roleCount: 0, // To be populated by Discord API
		};

		// Get activity metrics from database
		const [
			messageCount24h,
			moderationCases24h,
			ticketsCreated24h,
			commandsExecuted24h,
			reactionRoleUsage24h,
		] = await Promise.all([
			// Messages would be tracked in a separate message stats table
			0, // Placeholder
			prisma.moderationCase.count({
				where: { guildId, createdAt: { gte: yesterday } },
			}),
			prisma.ticket.count({
				where: { guildId, createdAt: { gte: yesterday } },
			}),
			prisma.customCommandLog.count({
				where: { guildId, timestamp: { gte: yesterday } },
			}),
			prisma.reactionRoleLog.count({
				where: { guildId, timestamp: { gte: yesterday } },
			}),
		]);

		const stats = {
			...basicStats,
			messageCount24h,
			moderationCases24h,
			ticketsCreated24h,
			commandsExecuted24h,
			reactionRoleUsage24h,
			voiceMinutes24h: 0, // To be implemented
			lastUpdated: now,
		};

		res.success(stats);
	} catch (error) {
		logger.error('Error fetching server stats:', error);
		res.failure('Failed to fetch server stats', 500);
	}
};

// Get historical server statistics
export const getHistoricalStats = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '30d', metric = 'all' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get historical snapshots
		const snapshots = await prisma.serverStatsSnapshot.findMany({
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			orderBy: { timestamp: 'asc' },
		});

		// Process snapshots based on requested metric
		let processedData;
		switch (metric) {
			case 'members':
				processedData = snapshots.map((s: any) => ({
					timestamp: s.timestamp,
					memberCount: s.memberCount,
					onlineCount: s.onlineCount,
				}));
				break;
			case 'activity':
				processedData = snapshots.map((s: any) => ({
					timestamp: s.timestamp,
					messageCount: s.messageCount24h,
					commandsExecuted: s.commandsExecuted24h,
					voiceMinutes: s.voiceMinutes24h,
				}));
				break;
			case 'moderation':
				processedData = snapshots.map((s: any) => ({
					timestamp: s.timestamp,
					moderationCases: s.moderationCases24h,
					ticketsCreated: s.ticketsCreated24h,
				}));
				break;
			default:
				processedData = snapshots;
		}

		res.success({
			period: period as string,
			metric: metric as string,
			data: processedData,
		});
	} catch (error) {
		logger.error('Error fetching historical stats:', error);
		res.failure('Failed to fetch historical stats', 500);
	}
};

// Get growth analytics
export const getGrowthAnalytics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '30d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);
		const midDate = new Date(Date.now() - periodMs / 2);

		// Get snapshots for comparison
		const [currentPeriod, previousPeriod] = await Promise.all([
			prisma.serverStatsSnapshot.findMany({
				where: {
					guildId,
					timestamp: { gte: midDate },
				},
				orderBy: { timestamp: 'desc' },
				take: 1,
			}),
			prisma.serverStatsSnapshot.findMany({
				where: {
					guildId,
					timestamp: { gte: startDate, lt: midDate },
				},
				orderBy: { timestamp: 'desc' },
				take: 1,
			}),
		]);

		if (currentPeriod.length === 0 || previousPeriod.length === 0) {
			return res.success({
				period: period as string,
				memberGrowth: 0,
				messageGrowth: 0,
				activityGrowth: 0,
				retentionRate: 0,
				engagementRate: 0,
			});
		}

		const current = currentPeriod[0];
		const previous = previousPeriod[0];

		const metrics: GrowthMetrics = {
			memberGrowth: calculateGrowthRate(
				previous.memberCount,
				current.memberCount
			),
			messageGrowth: calculateGrowthRate(
				previous.messageCount24h,
				current.messageCount24h
			),
			activityGrowth: calculateGrowthRate(
				previous.commandsExecuted24h + previous.voiceMinutes24h,
				current.commandsExecuted24h + current.voiceMinutes24h
			),
			retentionRate: await calculateRetentionRate(guildId, startDate),
			engagementRate: calculateEngagementRate(current),
		};

		res.success({
			period: period as string,
			...metrics,
			comparison: {
				current: current.timestamp,
				previous: previous.timestamp,
			},
		});
	} catch (error) {
		logger.error('Error fetching growth analytics:', error);
		res.failure('Failed to fetch growth analytics', 500);
	}
};

// Get detailed activity metrics
export const getActivityMetrics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get activity data
		const [
			messagesByHour,
			commandUsage,
			reactionRoleActivity,
			moderationActivity,
			ticketActivity,
		] = await Promise.all([
			// Messages by hour would be implemented with message tracking
			[],
			prisma.customCommandLog.groupBy({
				by: ['commandName'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { commandName: true },
				orderBy: { _count: { commandName: 'desc' } },
				take: 10,
			}),
			prisma.reactionRoleLog.groupBy({
				by: ['action'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { action: true },
			}),
			prisma.moderationCase.groupBy({
				by: ['type'],
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
				_count: { type: true },
			}),
			prisma.ticket.groupBy({
				by: ['category'],
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
				_count: { category: true },
			}),
		]);

		const metrics: ActivityMetrics = {
			messagesByHour: [], // To be implemented with message tracking
			messagesByChannel: [], // To be implemented with message tracking
			topUsers: [], // To be implemented with user activity tracking
			commandUsage: commandUsage.map((cmd: any) => ({
				command: cmd.commandName,
				count: cmd._count.commandName,
			})),
			voiceActivity: [], // To be implemented with voice tracking
		};

		res.success({
			period: period as string,
			...metrics,
			additional: {
				reactionRoleActivity,
				moderationActivity,
				ticketActivity,
			},
		});
	} catch (error) {
		logger.error('Error fetching activity metrics:', error);
		res.failure('Failed to fetch activity metrics', 500);
	}
};

// Create a server stats snapshot
export const createStatsSnapshot = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// This would typically be called by the bot with Discord API data
		const {
			memberCount,
			onlineCount,
			channelCount,
			roleCount,
			messageCount24h = 0,
			voiceMinutes24h = 0,
		} = req.body;

		const now = new Date();
		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// Get activity metrics
		const [
			moderationCases24h,
			ticketsCreated24h,
			commandsExecuted24h,
			reactionRoleUsage24h,
		] = await Promise.all([
			prisma.moderationCase.count({
				where: { guildId, createdAt: { gte: yesterday } },
			}),
			prisma.ticket.count({
				where: { guildId, createdAt: { gte: yesterday } },
			}),
			prisma.customCommandLog.count({
				where: { guildId, timestamp: { gte: yesterday } },
			}),
			prisma.reactionRoleLog.count({
				where: { guildId, timestamp: { gte: yesterday } },
			}),
		]);

		// Create snapshot
		const snapshot = await prisma.serverStatsSnapshot.create({
			data: {
				guildId,
				memberCount,
				onlineCount,
				channelCount,
				roleCount,
				messageCount24h,
				moderationCases24h,
				ticketsCreated24h,
				commandsExecuted24h,
				voiceMinutes24h,
				reactionRoleUsage24h,
				timestamp: now,
			},
		});

		// Broadcast stats update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('serverStatsUpdated', {
				guildId,
				stats: snapshot,
			})
		);

		logger.info(`Created stats snapshot for guild ${guildId}`, {
			memberCount,
			onlineCount,
			activityMetrics: {
				messages: messageCount24h,
				moderation: moderationCases24h,
				tickets: ticketsCreated24h,
				commands: commandsExecuted24h,
			},
		});

		res.success({
			message: 'Stats snapshot created successfully',
			data: snapshot,
		});
	} catch (error) {
		logger.error('Error creating stats snapshot:', error);
		res.failure('Failed to create stats snapshot', 500);
	}
};

// Get server leaderboards
export const getServerLeaderboards = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '30d', type = 'messages' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		let leaderboard;
		switch (type) {
			case 'commands':
				leaderboard = await prisma.customCommandLog.groupBy({
					by: ['userId'],
					where: {
						guildId,
						timestamp: { gte: startDate },
					},
					_count: { userId: true },
					orderBy: { _count: { userId: 'desc' } },
					take: 50,
				});
				break;
			case 'moderation':
				leaderboard = await prisma.moderationCase.groupBy({
					by: ['moderatorId'],
					where: {
						guildId,
						createdAt: { gte: startDate },
						moderatorId: { not: null },
					},
					_count: { moderatorId: true },
					orderBy: { _count: { moderatorId: 'desc' } },
					take: 50,
				});
				break;
			case 'tickets':
				leaderboard = await prisma.ticket.groupBy({
					by: ['assignedTo'],
					where: {
						guildId,
						createdAt: { gte: startDate },
						assignedTo: { not: null },
					},
					_count: { assignedTo: true },
					orderBy: { _count: { assignedTo: 'desc' } },
					take: 50,
				});
				break;
			default:
				// Messages leaderboard would be implemented with message tracking
				leaderboard = [];
		}

		res.success({
			period: period as string,
			type: type as string,
			leaderboard: leaderboard.map((entry: any, index: number) => ({
				rank: index + 1,
				userId: entry.userId || entry.moderatorId || entry.assignedTo,
				count:
					entry._count.userId ||
					entry._count.moderatorId ||
					entry._count.assignedTo,
			})),
		});
	} catch (error) {
		logger.error('Error fetching server leaderboards:', error);
		res.failure('Failed to fetch server leaderboards', 500);
	}
};

// Helper functions
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

function calculateGrowthRate(previous: number, current: number): number {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Math.round(((current - previous) / previous) * 100);
}

async function calculateRetentionRate(
	guildId: string,
	startDate: Date
): Promise<number> {
	// This would be implemented with member join/leave tracking
	// For now, return a placeholder
	return 85; // 85% retention rate
}

function calculateEngagementRate(snapshot: any): number {
	if (snapshot.memberCount === 0) return 0;
	const activeUsers =
		snapshot.messageCount24h +
		snapshot.commandsExecuted24h +
		snapshot.voiceMinutes24h;
	return Math.round((activeUsers / snapshot.memberCount) * 100);
}
