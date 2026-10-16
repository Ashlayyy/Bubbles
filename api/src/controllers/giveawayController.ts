import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('giveaway-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'GIVEAWAY_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Helper function to select random winners
function selectRandomWinners(entries: any[], count: number): string[] {
	if (entries.length <= count) {
		return entries.map((entry) => entry.userId);
	}

	const shuffled = [...entries].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count).map((entry) => entry.userId);
}

// Get giveaways for a guild
export const getGiveaways = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 20, status = 'all', createdBy } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };

		if (status !== 'all') {
			where.status = status as string;
		}

		if (createdBy) {
			where.createdBy = createdBy as string;
		}

		// Fetch giveaways with pagination
		const [giveaways, total] = await Promise.all([
			prisma.giveawayAdvanced.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					entries: {
						select: {
							id: true,
							userId: true,
							enteredAt: true,
						},
					},
				},
			}),
			prisma.giveawayAdvanced.count({ where }),
		]);

		// Format giveaways with entry counts
		const formattedGiveaways = giveaways.map((giveaway: any) => {
			const now = new Date();
			const endTime = new Date(giveaway.endTime);
			const timeRemaining = endTime.getTime() - now.getTime();

			return {
				...giveaway,
				entryCount: giveaway.entries.length,
				timeRemaining: Math.max(0, timeRemaining),
				hasEnded: now >= endTime,
				entries: giveaway.entries.map((entry: any) => ({
					id: entry.id,
					userId: entry.userId,
					enteredAt: entry.enteredAt,
				})),
			};
		});

		res.success({
			giveaways: formattedGiveaways,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching giveaways:', error);
		res.failure('Failed to fetch giveaways', 500);
	}
};

// Get single giveaway with detailed information
export const getGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const prisma = getPrismaClient();

		const giveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
			include: {
				entries: {
					orderBy: { enteredAt: 'desc' },
				},
			},
		});

		if (!giveaway) {
			return res.failure('Giveaway not found', 404);
		}

		const now = new Date();
		const endTime = new Date(giveaway.endTime);
		const timeRemaining = endTime.getTime() - now.getTime();

		const formattedGiveaway = {
			...giveaway,
			entryCount: giveaway.entries.length,
			timeRemaining: Math.max(0, timeRemaining),
			hasEnded: now >= endTime,
			uniqueEntries: new Set(giveaway.entries.map((entry: any) => entry.userId))
				.size,
		};

		res.success(formattedGiveaway);
	} catch (error) {
		logger.error('Error fetching giveaway:', error);
		res.failure('Failed to fetch giveaway', 500);
	}
};

// Create a new giveaway
export const createGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			title,
			description,
			prize,
			winnerCount = 1,
			requirements,
			endTime,
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (!title || !prize || !endTime) {
			return res.failure('Title, prize, and end time are required', 400);
		}

		// Validate end time
		const endDate = new Date(endTime);
		if (endDate <= new Date()) {
			return res.failure('End time must be in the future', 400);
		}

		// Validate winner count
		if (winnerCount < 1 || winnerCount > 100) {
			return res.failure('Winner count must be between 1 and 100', 400);
		}

		// Create giveaway
		const giveaway = await prisma.giveawayAdvanced.create({
			data: {
				guildId,
				createdBy: req.user?.id || 'unknown',
				title,
				description,
				prize,
				winnerCount,
				requirements,
				endTime: endDate,
				status: 'active',
				winners: [],
				entryCount: 0,
			},
		});

		// Broadcast giveaway creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayCreate', giveaway)
		);

		logger.info(`Created giveaway '${title}' for guild ${guildId}`, {
			giveawayId: giveaway.id,
			endTime: endDate,
			winnerCount,
		});

		res.success(
			{ message: 'Giveaway created successfully', data: giveaway },
			201
		);
	} catch (error) {
		logger.error('Error creating giveaway:', error);
		res.failure('Failed to create giveaway', 500);
	}
};

// Update an existing giveaway
export const updateGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if giveaway exists
		const existingGiveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
		});

		if (!existingGiveaway) {
			return res.failure('Giveaway not found', 404);
		}

		// Don't allow updating if giveaway has ended
		if (existingGiveaway.status === 'ended') {
			return res.failure('Cannot update ended giveaway', 400);
		}

		// Validate end time if provided
		if (updateData.endTime) {
			const endDate = new Date(updateData.endTime);
			if (endDate <= new Date()) {
				return res.failure('End time must be in the future', 400);
			}
			updateData.endTime = endDate;
		}

		// Validate winner count if provided
		if (
			updateData.winnerCount &&
			(updateData.winnerCount < 1 || updateData.winnerCount > 100)
		) {
			return res.failure('Winner count must be between 1 and 100', 400);
		}

		// Update giveaway
		const updatedGiveaway = await prisma.giveawayAdvanced.update({
			where: { id: giveawayId },
			data: {
				...updateData,
				updatedAt: new Date(),
			},
		});

		// Broadcast giveaway update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayUpdate', updatedGiveaway)
		);

		logger.info(`Updated giveaway ${giveawayId} for guild ${guildId}`);

		res.success({
			message: 'Giveaway updated successfully',
			data: updatedGiveaway,
		});
	} catch (error) {
		logger.error('Error updating giveaway:', error);
		res.failure('Failed to update giveaway', 500);
	}
};

// Delete a giveaway
export const deleteGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const prisma = getPrismaClient();

		// Check if giveaway exists
		const existingGiveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
		});

		if (!existingGiveaway) {
			return res.failure('Giveaway not found', 404);
		}

		// Delete giveaway and its entries (cascade delete)
		await prisma.giveawayAdvanced.delete({
			where: { id: giveawayId },
		});

		// Broadcast giveaway deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayDelete', { id: giveawayId })
		);

		logger.info(`Deleted giveaway ${giveawayId} from guild ${guildId}`);

		res.success({ message: 'Giveaway deleted successfully' });
	} catch (error) {
		logger.error('Error deleting giveaway:', error);
		res.failure('Failed to delete giveaway', 500);
	}
};

// Enter a giveaway
export const enterGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const { userId } = req.body;
		const prisma = getPrismaClient();

		// Check if giveaway exists and is active
		const giveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
			include: {
				entries: {
					where: { userId },
				},
			},
		});

		if (!giveaway) {
			return res.failure('Giveaway not found', 404);
		}

		if (giveaway.status !== 'active') {
			return res.failure('Giveaway is not active', 400);
		}

		// Check if giveaway has ended
		if (giveaway.endTime <= new Date()) {
			return res.failure('Giveaway has ended', 400);
		}

		// Check if user already entered
		if (giveaway.entries.length > 0) {
			return res.failure('User has already entered this giveaway', 400);
		}

		// TODO: Validate requirements if specified
		// This would check things like role requirements, age requirements, etc.

		// Create entry
		const entry = await prisma.giveawayEntryAdvanced.create({
			data: {
				giveawayId,
				userId,
			},
		});

		// Update giveaway entry count
		const updatedGiveaway = await prisma.giveawayAdvanced.update({
			where: { id: giveawayId },
			data: {
				entryCount: { increment: 1 },
			},
		});

		// Broadcast entry
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayEntry', {
				giveawayId,
				userId,
				entryCount: updatedGiveaway.entryCount,
			})
		);

		logger.info(`User ${userId} entered giveaway ${giveawayId}`);

		res.success({
			message: 'Successfully entered giveaway',
			data: {
				entry,
				entryCount: updatedGiveaway.entryCount,
			},
		});
	} catch (error) {
		logger.error('Error entering giveaway:', error);
		res.failure('Failed to enter giveaway', 500);
	}
};

// End a giveaway and select winners
export const endGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const { forceEnd = false } = req.body;
		const prisma = getPrismaClient();

		// Check if giveaway exists
		const giveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
			include: {
				entries: true,
			},
		});

		if (!giveaway) {
			return res.failure('Giveaway not found', 404);
		}

		if (giveaway.status !== 'active') {
			return res.failure('Giveaway is not active', 400);
		}

		// Check if giveaway should be ended
		const now = new Date();
		if (!forceEnd && giveaway.endTime > now) {
			return res.failure('Giveaway has not ended yet', 400);
		}

		// Select winners
		const winners = selectRandomWinners(giveaway.entries, giveaway.winnerCount);

		// Update giveaway with winners
		const endedGiveaway = await prisma.giveawayAdvanced.update({
			where: { id: giveawayId },
			data: {
				status: 'ended',
				winners,
				updatedAt: new Date(),
			},
		});

		// Broadcast giveaway end
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayEnd', {
				giveawayId,
				winners,
				prize: giveaway.prize,
				totalEntries: giveaway.entries.length,
			})
		);

		logger.info(
			`Ended giveaway ${giveawayId} with winners: ${winners.join(', ')}`
		);

		res.success({
			message: 'Giveaway ended successfully',
			data: {
				giveaway: endedGiveaway,
				winners,
				totalEntries: giveaway.entries.length,
			},
		});
	} catch (error) {
		logger.error('Error ending giveaway:', error);
		res.failure('Failed to end giveaway', 500);
	}
};

// Reroll winners for a giveaway
export const rerollGiveaway = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, giveawayId } = req.params;
		const { excludeUsers = [] } = req.body;
		const prisma = getPrismaClient();

		// Check if giveaway exists and has ended
		const giveaway = await prisma.giveawayAdvanced.findFirst({
			where: {
				id: giveawayId,
				guildId,
			},
			include: {
				entries: true,
			},
		});

		if (!giveaway) {
			return res.failure('Giveaway not found', 404);
		}

		if (giveaway.status !== 'ended') {
			return res.failure('Can only reroll ended giveaways', 400);
		}

		// Filter out excluded users
		const eligibleEntries = giveaway.entries.filter(
			(entry: any) => !excludeUsers.includes(entry.userId)
		);

		if (eligibleEntries.length === 0) {
			return res.failure('No eligible entries for reroll', 400);
		}

		// Select new winners
		const newWinners = selectRandomWinners(
			eligibleEntries,
			giveaway.winnerCount
		);

		// Update giveaway with new winners
		const rerolledGiveaway = await prisma.giveawayAdvanced.update({
			where: { id: giveawayId },
			data: {
				winners: newWinners,
				updatedAt: new Date(),
			},
		});

		// Broadcast reroll
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('giveawayReroll', {
				giveawayId,
				oldWinners: giveaway.winners,
				newWinners,
				prize: giveaway.prize,
			})
		);

		logger.info(
			`Rerolled giveaway ${giveawayId} with new winners: ${newWinners.join(
				', '
			)}`
		);

		res.success({
			message: 'Giveaway rerolled successfully',
			data: {
				giveaway: rerolledGiveaway,
				oldWinners: giveaway.winners,
				newWinners,
			},
		});
	} catch (error) {
		logger.error('Error rerolling giveaway:', error);
		res.failure('Failed to reroll giveaway', 500);
	}
};

// Get giveaway statistics
export const getGiveawayStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { timeframe = '30d' } = req.query;
		const prisma = getPrismaClient();

		// Calculate date range
		const now = new Date();
		let startDate = new Date();
		switch (timeframe) {
			case '7d':
				startDate.setDate(now.getDate() - 7);
				break;
			case '30d':
				startDate.setDate(now.getDate() - 30);
				break;
			case '90d':
				startDate.setDate(now.getDate() - 90);
				break;
			default:
				startDate.setDate(now.getDate() - 30);
		}

		const [
			totalGiveaways,
			activeGiveaways,
			endedGiveaways,
			totalEntries,
			averageEntries,
			topCreators,
		] = await Promise.all([
			prisma.giveawayAdvanced.count({
				where: { guildId, createdAt: { gte: startDate } },
			}),
			prisma.giveawayAdvanced.count({
				where: { guildId, status: 'active' },
			}),
			prisma.giveawayAdvanced.count({
				where: { guildId, status: 'ended' },
			}),
			prisma.giveawayEntryAdvanced.count({
				where: {
					giveaway: { guildId },
					enteredAt: { gte: startDate },
				},
			}),
			prisma.giveawayAdvanced.aggregate({
				where: { guildId, createdAt: { gte: startDate } },
				_avg: { entryCount: true },
			}),
			prisma.giveawayAdvanced.groupBy({
				by: ['createdBy'],
				where: { guildId, createdAt: { gte: startDate } },
				_count: { createdBy: true },
				orderBy: { _count: { createdBy: 'desc' } },
				take: 5,
			}),
		]);

		const statistics = {
			timeframe,
			period: {
				start: startDate.toISOString(),
				end: now.toISOString(),
			},
			overview: {
				totalGiveaways,
				activeGiveaways,
				endedGiveaways,
				totalEntries,
				averageEntries: Math.round(averageEntries._avg.entryCount || 0),
			},
			topCreators: topCreators.map((creator: any) => ({
				userId: creator.createdBy,
				giveawayCount: creator._count.createdBy,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching giveaway statistics:', error);
		res.failure('Failed to fetch giveaway statistics', 500);
	}
};
