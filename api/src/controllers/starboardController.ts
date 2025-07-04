import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('starboard-controller');

// Helper function to parse period strings
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

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'STARBOARD_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`,
	};
}

// Get starboard settings
export const getStarboardSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Get or create starboard settings
		let settings = await prisma.starboardSettings.findFirst({
			where: { guildId },
		});

		if (!settings) {
			settings = await prisma.starboardSettings.create({
				data: {
					guildId,
					channelId: null,
					emoji: '⭐',
					threshold: 3,
					selfStar: false,
					allowNsfw: false,
					ignoredChannels: [],
					ignoredRoles: [],
					ignoredUsers: [],
					color: '#FFD700',
					isEnabled: false,
				},
			});
		}

		const settingsData = {
			id: settings.id,
			guildId: settings.guildId,
			channelId: settings.channelId,
			emoji: settings.emoji,
			threshold: settings.threshold,
			selfStar: settings.selfStar,
			allowNsfw: settings.allowNsfw,
			ignoredChannels: settings.ignoredChannels,
			ignoredRoles: settings.ignoredRoles,
			ignoredUsers: settings.ignoredUsers,
			color: settings.color,
			isEnabled: settings.isEnabled,
			createdAt: settings.createdAt,
			updatedAt: settings.updatedAt,
		};

		res.success(settingsData);
	} catch (error) {
		logger.error('Error fetching starboard settings:', error);
		res.failure('Failed to fetch starboard settings', 500);
	}
};

// Update starboard settings
export const updateStarboardSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const updates = req.body;
		const prisma = getPrismaClient();

		// Get existing settings
		let settings = await prisma.starboardSettings.findFirst({
			where: { guildId },
		});

		if (!settings) {
			// Create new settings with updates
			settings = await prisma.starboardSettings.create({
				data: {
					guildId,
					...updates,
				},
			});
		} else {
			// Update existing settings
			settings = await prisma.starboardSettings.update({
				where: { id: settings.id },
				data: {
					...updates,
					updatedAt: new Date(),
				},
			});
		}

		// Broadcast settings update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('starboardSettingsUpdate', settings)
		);

		logger.info(`Updated starboard settings for guild ${guildId}`, {
			changes: Object.keys(updates),
			updatedBy: req.user?.id,
		});

		res.success({
			message: 'Starboard settings updated',
			data: settings,
		});
	} catch (error) {
		logger.error('Error updating starboard settings:', error);
		res.failure('Failed to update starboard settings', 500);
	}
};

// Get starboard messages
export const getStarboardMessages = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, minStars, channelId, userId } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (minStars) {
			where.starCount = { gte: parseInt(minStars as string) };
		}
		if (channelId) {
			where.channelId = channelId;
		}
		if (userId) {
			where.authorId = userId;
		}

		// Fetch starboard messages
		const [messages, total] = await Promise.all([
			prisma.starboardMessage.findMany({
				where,
				orderBy: [{ starCount: 'desc' }, { createdAt: 'desc' }],
				skip,
				take,
				include: {
					reactions: {
						select: {
							userId: true,
							emoji: true,
							addedAt: true,
						},
					},
				},
			}),
			prisma.starboardMessage.count({ where }),
		]);

		// Format messages
		const formattedMessages = messages.map((message: any) => ({
			id: message.id,
			messageId: message.messageId,
			starboardMessageId: message.starboardMessageId,
			guildId: message.guildId,
			channelId: message.channelId,
			authorId: message.authorId,
			content: message.content,
			attachments: message.attachments,
			embeds: message.embeds,
			starCount: message.starCount,
			lastUpdated: message.lastUpdated,
			createdAt: message.createdAt,
			reactions: message.reactions,
			starboardChannelId: message.starboardChannelId,
		}));

		// Get basic statistics
		const avgStars = await prisma.starboardMessage.aggregate({
			where: { guildId },
			_avg: { starCount: true },
		});

		// Get top users
		const topStarrers = await prisma.starboardReaction.groupBy({
			by: ['userId'],
			where: { guildId },
			_count: { userId: true },
			orderBy: { _count: { userId: 'desc' } },
			take: 5,
		});

		const topStarred = await prisma.starboardMessage.groupBy({
			by: ['authorId'],
			where: { guildId },
			_sum: { starCount: true },
			orderBy: { _sum: { starCount: 'desc' } },
			take: 5,
		});

		res.success({
			messages: formattedMessages,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
			stats: {
				totalStarred: total,
				averageStars: avgStars._avg.starCount
					? Math.round(avgStars._avg.starCount * 100) / 100
					: 0,
				topStarrers: topStarrers.map((user: any) => ({
					userId: user.userId,
					starsGiven: user._count.userId,
				})),
				topStarred: topStarred.map((user: any) => ({
					userId: user.authorId,
					starsReceived: user._sum.starCount,
				})),
			},
		});
	} catch (error) {
		logger.error('Error fetching starboard messages:', error);
		res.failure('Failed to fetch starboard messages', 500);
	}
};

// Add or remove star from message
export const toggleStar = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { messageId, userId, emoji = '⭐', action } = req.body;
		const prisma = getPrismaClient();

		if (!messageId || !userId || !['add', 'remove'].includes(action)) {
			return res.failure('Invalid parameters', 400);
		}

		// Get starboard settings
		const settings = await prisma.starboardSettings.findFirst({
			where: { guildId },
		});
		if (!settings?.isEnabled) {
			return res.failure('Starboard is disabled', 400);
		}

		if (!settings.selfStar && userId === req.body.authorId) {
			return res.failure('You cannot star your own messages', 400);
		}

		// Check if message exists in starboard
		let starboardMessage = await prisma.starboardMessage.findFirst({
			where: { messageId, guildId },
			include: { reactions: true },
		});

		if (action === 'add') {
			// Check if user already starred this message
			const existingReaction = await prisma.starboardReaction.findFirst({
				where: {
					messageId: starboardMessage?.id || '',
					userId,
					emoji,
				},
			});

			if (existingReaction) {
				return res.failure('User already starred this message', 400);
			}

			// Create or update starboard message
			if (!starboardMessage) {
				// Create new starboard message
				starboardMessage = await prisma.starboardMessage.create({
					data: {
						guildId,
						channelId: req.body.channelId || '',
						messageId,
						starboardChannelId: settings.channelId || '',
						authorId: req.body.authorId || '',
						content: req.body.content || '',
						attachments: req.body.attachments || [],
						embeds: req.body.embeds || [],
						starCount: 1,
					},
					include: { reactions: true },
				});
			} else {
				// Update star count
				starboardMessage = await prisma.starboardMessage.update({
					where: { id: starboardMessage.id },
					data: {
						starCount: { increment: 1 },
						lastUpdated: new Date(),
					},
					include: { reactions: true },
				});
			}

			// Add reaction
			await prisma.starboardReaction.create({
				data: {
					messageId: starboardMessage.id,
					userId,
					guildId,
					emoji,
				},
			});
		} else if (action === 'remove') {
			if (!starboardMessage) {
				return res.failure('Message not in starboard', 404);
			}

			// Remove reaction
			const reaction = await prisma.starboardReaction.findFirst({
				where: {
					messageId: starboardMessage.id,
					userId,
					emoji,
				},
			});

			if (!reaction) {
				return res.failure('Reaction not found', 404);
			}

			await prisma.starboardReaction.delete({
				where: { id: reaction.id },
			});

			// Update star count
			const newStarCount = Math.max(0, starboardMessage.starCount - 1);

			if (newStarCount === 0) {
				// Remove from starboard if no stars left
				await prisma.starboardMessage.delete({
					where: { id: starboardMessage.id },
				});
			} else {
				await prisma.starboardMessage.update({
					where: { id: starboardMessage.id },
					data: {
						starCount: newStarCount,
						lastUpdated: new Date(),
					},
				});
			}
		}

		// Broadcast star update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('starboardUpdate', {
				messageId,
				action,
				starCount: starboardMessage?.starCount || 0,
			})
		);

		logger.info(`${action} star for message ${messageId} in guild ${guildId}`, {
			userId,
			starCount: starboardMessage?.starCount || 0,
		});

		res.success({
			message: `Star ${action}ed successfully`,
			data: {
				messageId,
				starCount: starboardMessage?.starCount || 0,
				action,
			},
		});
	} catch (error) {
		logger.error('Error toggling star:', error);
		res.failure('Failed to toggle star', 500);
	}
};

// Get starboard statistics
export const getStarboardStats = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '30d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get basic statistics
		const [totalMessages, totalStars, avgStars] = await Promise.all([
			prisma.starboardMessage.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
			}),
			prisma.starboardReaction.count({
				where: {
					guildId,
					addedAt: { gte: startDate },
				},
			}),
			prisma.starboardMessage.aggregate({
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
				_avg: { starCount: true },
			}),
		]);

		// Get top messages
		const topMessages = await prisma.starboardMessage.findMany({
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			orderBy: { starCount: 'desc' },
			take: 10,
		});

		// Get top starrers
		const topStarrers = await prisma.starboardReaction.groupBy({
			by: ['userId'],
			where: {
				guildId,
				addedAt: { gte: startDate },
			},
			_count: { userId: true },
			orderBy: { _count: { userId: 'desc' } },
			take: 10,
		});

		// Get top starred users
		const topStarred = await prisma.starboardMessage.groupBy({
			by: ['authorId'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_sum: { starCount: true },
			orderBy: { _sum: { starCount: 'desc' } },
			take: 10,
		});

		// Get daily activity
		const dailyActivity = await prisma.starboardReaction.groupBy({
			by: ['addedAt'],
			where: {
				guildId,
				addedAt: { gte: startDate },
			},
			_count: { addedAt: true },
		});

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.addedAt.toISOString().split('T')[0];
			dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + day._count.addedAt);
		});

		const statistics = {
			period: period as string,
			overview: {
				totalStarred: totalMessages,
				totalStars: totalStars,
				averageStars: avgStars._avg.starCount
					? Math.round(avgStars._avg.starCount * 100) / 100
					: 0,
				uniqueStarrers: topStarrers.length,
				uniqueStarred: topStarred.length,
			},
			topMessages: topMessages.map((message: any) => ({
				id: message.id,
				messageId: message.messageId,
				content:
					message.content.substring(0, 100) +
					(message.content.length > 100 ? '...' : ''),
				authorId: message.authorId,
				starCount: message.starCount,
				channelId: message.channelId,
				createdAt: message.createdAt,
			})),
			topStarrers: topStarrers.map((user: any) => ({
				userId: user.userId,
				starsGiven: user._count.userId,
			})),
			topStarred: topStarred.map((user: any) => ({
				userId: user.authorId,
				starsReceived: user._sum.starCount,
			})),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching starboard statistics:', error);
		res.failure('Failed to fetch starboard statistics', 500);
	}
};
