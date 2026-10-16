import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
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
			return res.success({
				enabled: false,
				channelId: null,
				staffRoleIds: [],
				cooldownDays: 30,
				maxAppealsPerUser: 3,
				requireReason: true,
				notifyStaff: true,
				dmUser: true,
				autoUnbanOnApproval: true,
			});
		}

		res.success(settings);
	} catch (error) {
		logger.error('Error fetching appeal settings:', error);
		res.failure('Failed to fetch appeal settings', 500);
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

		res.success({
			message: 'Appeal settings updated successfully',
			data: updatedSettings,
		});
	} catch (error) {
		logger.error('Error updating appeal settings:', error);
		res.failure('Failed to update appeal settings', 500);
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

		// Build where clause for CaseAppeal
		const caseAppealWhere: any = {
			case: { guildId },
		};
		if (status) caseAppealWhere.status = status;
		if (userId) caseAppealWhere.userId = userId;
		if (type)
			caseAppealWhere.case = {
				...caseAppealWhere.case,
				type: (type as string).toUpperCase(),
			};
		if (moderatorId) caseAppealWhere.reviewedBy = moderatorId;

		// Fetch appeals with pagination
		const [appeals, total] = await Promise.all([
			prisma.caseAppeal.findMany({
				where: caseAppealWhere,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					case: {
						select: {
							id: true,
							type: true,
							reason: true,
							guildId: true,
							caseNumber: true,
						},
					},
				},
			}),
			prisma.caseAppeal.count({ where: caseAppealWhere }),
		]);

		const formattedAppeals = appeals.map((appeal: any) => ({
			id: appeal.id,
			userId: appeal.userId,
			type: appeal.case.type,
			reason: appeal.reason,
			status: appeal.status,
			reviewedBy: appeal.reviewedBy,
			reviewNotes: appeal.reviewNotes,
			evidence: appeal.evidence,
			caseId: appeal.case.id,
			caseNumber: appeal.case.caseNumber,
			createdAt: appeal.createdAt,
			updatedAt: appeal.updatedAt,
		}));

		res.success({
			appeals: formattedAppeals,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching appeals:', error);
		res.failure('Failed to fetch appeals', 500);
	}
};

// Get single appeal
export const getAppeal = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, appealId } = req.params;
		const prisma = getPrismaClient();

		const appeal = await prisma.caseAppeal.findFirst({
			where: {
				id: appealId,
				case: { guildId },
			},
			include: {
				case: {
					select: {
						id: true,
						type: true,
						reason: true,
						guildId: true,
						caseNumber: true,
					},
				},
			},
		});

		if (!appeal) {
			return res.failure('Appeal not found', 404);
		}

		res.success(appeal);
	} catch (error) {
		logger.error('Error fetching appeal:', error);
		res.failure('Failed to fetch appeal', 500);
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
			return res.failure('Appeals are not enabled for this server', 400);
		}

		// Check user limits
		const userAppeals = await prisma.caseAppeal.count({
			where: {
				userId,
				case: { guildId },
			},
		});

		if (userAppeals >= settings.maxAppealsPerUser) {
			return res.failure('Maximum appeals limit reached', 400);
		}

		// Check cooldown
		const lastAppeal = await prisma.caseAppeal.findFirst({
			where: {
				userId,
				case: { guildId },
			},
			orderBy: { createdAt: 'desc' },
		});

		if (lastAppeal) {
			const cooldownEnd = new Date(
				lastAppeal.createdAt.getTime() + settings.appealCooldown * 1000
			);
			if (new Date() < cooldownEnd) {
				return res.failure(
					`Appeal cooldown active. Try again after ${cooldownEnd.toDateString()}`,
					400
				);
			}
		}

		// Find the moderation case to appeal
		const moderationCase = await prisma.moderationCase.findFirst({
			where: {
				guildId,
				userId,
				type: type.toUpperCase(),
				status: { in: ['ACTIVE', 'EXPIRED'] },
			},
			orderBy: { createdAt: 'desc' },
		});

		if (!moderationCase) {
			return res.failure('No active moderation case found to appeal', 400);
		}

		// Create appeal
		const appeal = await prisma.caseAppeal.create({
			data: {
				caseId: moderationCase.id,
				userId,
				appealMethod: 'DASHBOARD',
				reason,
				evidence: evidence || [],
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

		res.success(
			{
				message: 'Appeal submitted successfully',
				data: appeal,
			},
			201
		);
	} catch (error) {
		logger.error('Error creating appeal:', error);
		res.failure('Failed to create appeal', 500);
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
		const appeal = await prisma.caseAppeal.findFirst({
			where: {
				id: appealId,
				case: { guildId },
			},
			include: {
				case: true,
			},
		});

		if (!appeal) {
			return res.failure('Appeal not found', 404);
		}

		// Update appeal
		const updatedAppeal = await prisma.caseAppeal.update({
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

				// Update the original case status
				await prisma.moderationCase.update({
					where: { id: appeal.case.id },
					data: {
						status: 'APPEALED',
						updatedAt: new Date(),
					},
				});
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

		res.success({
			message: 'Appeal status updated successfully',
			data: updatedAppeal,
		});
	} catch (error) {
		logger.error('Error updating appeal status:', error);
		res.failure('Failed to update appeal status', 500);
	}
};

// Delete appeal
export const deleteAppeal = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, appealId } = req.params;
		const prisma = getPrismaClient();

		// Delete appeal
		await prisma.caseAppeal.delete({
			where: { id: appealId },
		});

		// Broadcast appeal deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('appealDelete', { id: appealId })
		);

		logger.info(`Deleted appeal ${appealId} from guild ${guildId}`);

		res.success({ message: 'Appeal deleted successfully' });
	} catch (error) {
		logger.error('Error deleting appeal:', error);
		res.failure('Failed to delete appeal', 500);
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
				prisma.caseAppeal.count({
					where: {
						case: { guildId },
						createdAt: { gte: startDate },
					},
				}),
				prisma.caseAppeal.groupBy({
					by: ['status'],
					where: {
						case: { guildId },
						createdAt: { gte: startDate },
					},
					_count: { status: true },
				}),
				prisma.caseAppeal.findMany({
					where: {
						case: { guildId },
						createdAt: { gte: startDate },
					},
					include: {
						case: {
							select: { type: true },
						},
					},
				}),
				prisma.caseAppeal.groupBy({
					by: ['createdAt'],
					where: {
						case: { guildId },
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

		// Process type breakdown
		const typeMap = new Map<string, number>();
		typeBreakdown.forEach((appeal: any) => {
			const type = appeal.case.type;
			typeMap.set(type, (typeMap.get(type) || 0) + 1);
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
			typeBreakdown: Object.fromEntries(typeMap),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching appeal statistics:', error);
		res.failure('Failed to fetch appeal statistics', 500);
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
