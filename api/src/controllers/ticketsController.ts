import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('tickets-controller');

// Get ticket settings
export const getTicketSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Get guild config for ticket settings
		let guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		if (!guildConfig) {
			guildConfig = await prisma.guildConfig.create({
				data: {
					guildId,
					useTicketThreads: true,
					ticketSilentClaim: true,
				},
			});
		}

		const settings = {
			enabled: !!guildConfig.ticketChannelId,
			ticketChannelId: guildConfig.ticketChannelId,
			categoryId: guildConfig.ticketCategoryId,
			useThreads: guildConfig.useTicketThreads,
			onCallRoleId: guildConfig.ticketOnCallRoleId,
			silentClaim: guildConfig.ticketSilentClaim,
			accessType: guildConfig.ticketAccessType || 'EVERYONE',
			accessRoleId: guildConfig.ticketAccessRoleId,
			accessPermission: guildConfig.ticketAccessPermission,
			logChannelId: guildConfig.ticketLogChannelId,
			maxTicketsPerUser: 5, // Could be added to schema
			autoCloseAfter: 24, // hours - could be added to schema
			supportMessage:
				'Please describe your issue and a staff member will assist you shortly.',
			closeMessage:
				'This ticket has been closed. Thank you for contacting support.',
			categories: [
				{
					id: 'general',
					name: 'General Support',
					emoji: '❓',
					description: 'General questions and support',
				},
				{
					id: 'bug',
					name: 'Bug Report',
					emoji: '🐛',
					description: 'Report bugs or issues',
				},
				{
					id: 'feature',
					name: 'Feature Request',
					emoji: '💡',
					description: 'Suggest new features',
				},
				{
					id: 'ban_appeal',
					name: 'Ban Appeal',
					emoji: '⚖️',
					description: 'Appeal a moderation action',
				},
			],
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching ticket settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket settings',
		} as ApiResponse);
	}
};

// Update ticket settings
export const updateTicketSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const settings = req.body;
		const prisma = getPrismaClient();

		// Update guild config with ticket settings
		const updatedConfig = await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				ticketChannelId: settings.ticketChannelId,
				ticketCategoryId: settings.categoryId,
				useTicketThreads: settings.useThreads ?? true,
				ticketOnCallRoleId: settings.onCallRoleId,
				ticketSilentClaim: settings.silentClaim ?? true,
				ticketAccessType: settings.accessType,
				ticketAccessRoleId: settings.accessRoleId,
				ticketAccessPermission: settings.accessPermission,
				ticketLogChannelId: settings.logChannelId,
			},
			create: {
				guildId,
				ticketChannelId: settings.ticketChannelId,
				ticketCategoryId: settings.categoryId,
				useTicketThreads: settings.useThreads ?? true,
				ticketOnCallRoleId: settings.onCallRoleId,
				ticketSilentClaim: settings.silentClaim ?? true,
				ticketAccessType: settings.accessType,
				ticketAccessRoleId: settings.accessRoleId,
				ticketAccessPermission: settings.accessPermission,
				ticketLogChannelId: settings.logChannelId,
			},
		});

		logger.info(`Updated ticket settings for guild ${guildId}`, settings);

		res.json({
			success: true,
			message: 'Ticket settings updated',
			data: updatedConfig,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating ticket settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update ticket settings',
		} as ApiResponse);
	}
};

// Get all tickets
export const getTickets = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			page = 1,
			limit = 50,
			status,
			assignedTo,
			category,
			userId,
		} = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (status) where.status = status;
		if (assignedTo) where.assignedTo = assignedTo;
		if (category) where.category = category;
		if (userId) where.userId = userId;

		// Fetch tickets with pagination
		const [tickets, total] = await Promise.all([
			prisma.ticket.findMany({
				where,
				include: {
					messages: {
						orderBy: { createdAt: 'desc' },
						take: 1, // Just the latest message for preview
					},
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take,
			}),
			prisma.ticket.count({ where }),
		]);

		const formattedTickets = tickets.map((ticket: any) => ({
			id: ticket.id,
			ticketNumber: ticket.ticketNumber,
			userId: ticket.userId,
			channelId: ticket.channelId,
			threadId: ticket.threadId,
			category: ticket.category,
			title: ticket.title,
			description: ticket.description,
			status: ticket.status,
			assignedTo: ticket.assignedTo,
			tags: ticket.tags,
			closedReason: ticket.closedReason,
			closedBy: ticket.closedBy,
			closedAt: ticket.closedAt,
			lastActivity: ticket.lastActivity,
			allowUserClose: ticket.allowUserClose,
			isAnonymous: ticket.isAnonymous,
			createdAt: ticket.createdAt,
			updatedAt: ticket.updatedAt,
			lastMessage: ticket.messages[0]
				? {
						id: ticket.messages[0].id,
						content: ticket.messages[0].content,
						authorId: ticket.messages[0].authorId,
						createdAt: ticket.messages[0].createdAt,
				  }
				: null,
		}));

		res.json({
			success: true,
			data: {
				tickets: formattedTickets,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching tickets:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch tickets',
		} as ApiResponse);
	}
};

// Get single ticket
export const getTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const prisma = getPrismaClient();

		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
			include: {
				messages: {
					orderBy: { createdAt: 'asc' },
				},
			},
		});

		if (!ticket) {
			return res.status(404).json({
				success: false,
				error: 'Ticket not found',
			} as ApiResponse);
		}

		const formattedTicket = {
			id: ticket.id,
			ticketNumber: ticket.ticketNumber,
			userId: ticket.userId,
			channelId: ticket.channelId,
			threadId: ticket.threadId,
			category: ticket.category,
			title: ticket.title,
			description: ticket.description,
			status: ticket.status,
			assignedTo: ticket.assignedTo,
			tags: ticket.tags,
			closedReason: ticket.closedReason,
			closedBy: ticket.closedBy,
			closedAt: ticket.closedAt,
			lastActivity: ticket.lastActivity,
			allowUserClose: ticket.allowUserClose,
			isAnonymous: ticket.isAnonymous,
			createdAt: ticket.createdAt,
			updatedAt: ticket.updatedAt,
			messages: ticket.messages.map((message: any) => ({
				id: message.id,
				content: message.content,
				authorId: message.authorId,
				isStaff: message.isStaff,
				isInternal: message.isInternal,
				attachments: message.attachments,
				createdAt: message.createdAt,
			})),
		};

		res.json({
			success: true,
			data: formattedTicket,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket',
		} as ApiResponse);
	}
};

// Create new ticket
export const createTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			userId,
			category,
			title,
			description,
			isAnonymous = false,
		} = req.body;
		const prisma = getPrismaClient();

		// Get guild config for ticket settings
		const guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		if (!guildConfig?.ticketChannelId) {
			return res.status(400).json({
				success: false,
				error: 'Ticket system not configured for this guild',
			} as ApiResponse);
		}

		// Check if user has reached max tickets limit
		const userTickets = await prisma.ticket.count({
			where: {
				guildId,
				userId,
				status: { in: ['OPEN', 'IN_PROGRESS'] },
			},
		});

		if (userTickets >= 5) {
			// Max tickets per user
			return res.status(400).json({
				success: false,
				error: 'You have reached the maximum number of open tickets',
			} as ApiResponse);
		}

		// Get next ticket number
		const lastTicket = await prisma.ticket.findFirst({
			where: { guildId },
			orderBy: { ticketNumber: 'desc' },
			select: { ticketNumber: true },
		});

		const ticketNumber = (lastTicket?.ticketNumber || 0) + 1;

		// Create Discord channel or thread
		let channelId = '';
		let threadId = null;

		try {
			if (guildConfig.useTicketThreads) {
				// Create thread in ticket channel
				const thread = await discordApi.startThreadWithoutMessage(
					guildConfig.ticketChannelId,
					{
						name: `Ticket #${ticketNumber} - ${title}`,
						auto_archive_duration: 1440, // 24 hours
						type: 11, // Private thread
					}
				);
				channelId = guildConfig.ticketChannelId;
				threadId = thread.id;
			} else {
				// Create channel in category
				const channel = await discordApi.createChannel(guildId, {
					name: `ticket-${ticketNumber}`,
					type: 0, // Text channel
					parent_id: guildConfig.ticketCategoryId,
					topic: `Ticket #${ticketNumber} - ${title}`,
					permission_overwrites: [
						{
							id: userId,
							type: 1, // Member
							allow: '1024', // VIEW_CHANNEL
						},
					],
				});
				channelId = channel.id;
			}
		} catch (error) {
			logger.error('Failed to create Discord channel/thread:', error);
			return res.status(500).json({
				success: false,
				error: 'Failed to create ticket channel',
			} as ApiResponse);
		}

		// Create ticket in database
		const ticket = await prisma.ticket.create({
			data: {
				ticketNumber,
				guildId,
				userId,
				channelId,
				threadId,
				category,
				title,
				description,
				status: 'OPEN',
				allowUserClose: true,
				isAnonymous,
				lastActivity: new Date(),
			},
		});

		// Create initial message
		await prisma.ticketMessage.create({
			data: {
				ticketId: ticket.id,
				content: description || 'No description provided',
				authorId: userId,
				isStaff: false,
				isInternal: false,
			},
		});

		// Broadcast ticket creation
		wsManager.broadcastToGuild(guildId, 'ticketCreate', ticket);

		logger.info(`Created ticket #${ticketNumber} for guild ${guildId}`, {
			ticketId: ticket.id,
			userId,
			category,
		});

		res.status(201).json({
			success: true,
			message: 'Ticket created successfully',
			data: ticket,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create ticket',
		} as ApiResponse);
	}
};

// Update ticket
export const updateTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const updates = req.body;
		const prisma = getPrismaClient();

		// Update ticket
		const updatedTicket = await prisma.ticket.update({
			where: {
				id: ticketId,
				guildId,
			},
			data: {
				...updates,
				lastActivity: new Date(),
				updatedAt: new Date(),
			},
		});

		// Broadcast update
		wsManager.broadcastToGuild(guildId, 'ticketUpdate', updatedTicket);

		logger.info(`Updated ticket ${ticketId} for guild ${guildId}`, updates);

		res.json({
			success: true,
			message: 'Ticket updated successfully',
			data: updatedTicket,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update ticket',
		} as ApiResponse);
	}
};

// Close ticket
export const closeTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const { reason, deleteChannel = false } = req.body;
		const prisma = getPrismaClient();

		// Get ticket details
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			return res.status(404).json({
				success: false,
				error: 'Ticket not found',
			} as ApiResponse);
		}

		// Update ticket status
		const closedTicket = await prisma.ticket.update({
			where: { id: ticketId },
			data: {
				status: 'CLOSED',
				closedReason: reason || 'No reason provided',
				closedBy: req.user?.id || 'unknown',
				closedAt: new Date(),
				lastActivity: new Date(),
				updatedAt: new Date(),
			},
		});

		// Delete or archive Discord channel/thread
		if (deleteChannel) {
			try {
				if (ticket.threadId) {
					// Archive thread
					await discordApi.deleteChannel(ticket.threadId);
				} else {
					// Delete channel
					await discordApi.deleteChannel(ticket.channelId);
				}
			} catch (error) {
				logger.warn('Failed to delete Discord channel:', error);
			}
		}

		// Broadcast closure
		wsManager.broadcastToGuild(guildId, 'ticketClose', closedTicket);

		logger.info(`Closed ticket ${ticketId} for guild ${guildId}`, { reason });

		res.json({
			success: true,
			message: 'Ticket closed successfully',
			data: closedTicket,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error closing ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to close ticket',
		} as ApiResponse);
	}
};

// Claim ticket
export const claimTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const prisma = getPrismaClient();

		// Update ticket with assignee
		const claimedTicket = await prisma.ticket.update({
			where: {
				id: ticketId,
				guildId,
			},
			data: {
				assignedTo: req.user?.id || 'unknown',
				status: 'IN_PROGRESS',
				lastActivity: new Date(),
				updatedAt: new Date(),
			},
		});

		// Broadcast claim
		wsManager.broadcastToGuild(guildId, 'ticketClaim', claimedTicket);

		logger.info(`Claimed ticket ${ticketId} for guild ${guildId}`, {
			assignedTo: req.user?.id,
		});

		res.json({
			success: true,
			message: 'Ticket claimed successfully',
			data: claimedTicket,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error claiming ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to claim ticket',
		} as ApiResponse);
	}
};

// Get ticket statistics
export const getTicketStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get ticket counts by status
		const [statusCounts, totalTickets, recentTickets] = await Promise.all([
			prisma.ticket.groupBy({
				by: ['status'],
				where: { guildId },
				_count: { status: true },
			}),
			prisma.ticket.count({ where: { guildId } }),
			prisma.ticket.count({
				where: {
					guildId,
					createdAt: { gte: startDate },
				},
			}),
		]);

		// Get category breakdown
		const categoryBreakdown = await prisma.ticket.groupBy({
			by: ['category'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_count: { category: true },
		});

		// Get daily activity
		const dailyActivity = await prisma.ticket.groupBy({
			by: ['createdAt'],
			where: {
				guildId,
				createdAt: { gte: startDate },
			},
			_count: { createdAt: true },
		});

		// Process daily activity
		const dailyMap = new Map();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.createdAt.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.createdAt
			);
		});

		const statistics = {
			period: period as string,
			overview: {
				total: totalTickets,
				recent: recentTickets,
				open:
					statusCounts.find((s: any) => s.status === 'OPEN')?._count.status ||
					0,
				inProgress:
					statusCounts.find((s: any) => s.status === 'IN_PROGRESS')?._count
						.status || 0,
				closed:
					statusCounts.find((s: any) => s.status === 'CLOSED')?._count.status ||
					0,
			},
			categories: categoryBreakdown.reduce((acc: any, cat: any) => {
				acc[cat.category] = cat._count.category;
				return acc;
			}, {} as Record<string, number>),
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
		logger.error('Error fetching ticket statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket statistics',
		} as ApiResponse);
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
