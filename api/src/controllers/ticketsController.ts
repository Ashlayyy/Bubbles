import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('tickets-controller');

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

		res.success(settings);
	} catch (error) {
		logger.error('Error fetching ticket settings:', error);
		res.failure('Failed to fetch ticket settings', 500);
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

		res.success({
			message: 'Ticket settings updated',
			data: updatedConfig,
		});
	} catch (error) {
		logger.error('Error updating ticket settings:', error);
		res.failure('Failed to update ticket settings', 500);
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
						userId: ticket.messages[0].userId,
						createdAt: ticket.messages[0].createdAt,
				  }
				: null,
		}));

		res.success({
			tickets: formattedTickets,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching tickets:', error);
		res.failure('Failed to fetch tickets', 500);
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
			return res.failure('Ticket not found', 404);
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
				userId: message.userId,
				userIcon: message.userIcon,
				isSystemMsg: message.isSystemMsg,
				attachments: message.attachments,
				embeds: message.embeds,
				createdAt: message.createdAt,
			})),
		};

		res.success(formattedTicket);
	} catch (error) {
		logger.error('Error fetching ticket:', error);
		res.failure('Failed to fetch ticket', 500);
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
			return res.failure('Ticket system not configured for this guild', 400);
		}

		// Check if user has reached max tickets limit
		const userTickets = await prisma.ticket.count({
			where: {
				guildId,
				userId,
				status: { in: ['OPEN', 'CLAIMED'] },
			},
		});

		if (userTickets >= 5) {
			// Max tickets per user
			return res.failure(
				'You have reached the maximum number of open tickets',
				400
			);
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
			return res.failure('Failed to create ticket channel', 500);
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
				messageId: 'system',
				userId: userId,
				userIcon: '',
				content: description || 'No description provided',
				attachments: [],
				embeds: [],
				isSystemMsg: false,
			},
		});

		// Broadcast ticket creation
		wsManager.broadcastToGuild(guildId, 'ticketCreate', ticket);

		logger.info(`Created ticket #${ticketNumber} for guild ${guildId}`, {
			ticketId: ticket.id,
			userId,
			category,
		});

		res.success(ticket, 201);
	} catch (error) {
		logger.error('Error creating ticket:', error);
		res.failure('Failed to create ticket', 500);
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

		res.success({
			message: 'Ticket updated successfully',
			data: updatedTicket,
		});
	} catch (error) {
		logger.error('Error updating ticket:', error);
		res.failure('Failed to update ticket', 500);
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
			return res.failure('Ticket not found', 404);
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

		res.success({
			message: 'Ticket closed successfully',
			data: closedTicket,
		});
	} catch (error) {
		logger.error('Error closing ticket:', error);
		res.failure('Failed to close ticket', 500);
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
				status: 'CLAIMED',
				lastActivity: new Date(),
				updatedAt: new Date(),
			},
		});

		// Broadcast claim
		wsManager.broadcastToGuild(guildId, 'ticketClaim', claimedTicket);

		logger.info(`Claimed ticket ${ticketId} for guild ${guildId}`, {
			assignedTo: req.user?.id,
		});

		res.success({
			message: 'Ticket claimed successfully',
			data: claimedTicket,
		});
	} catch (error) {
		logger.error('Error claiming ticket:', error);
		res.failure('Failed to claim ticket', 500);
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
				claimed:
					statusCounts.find((s: any) => s.status === 'CLAIMED')?._count
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

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching ticket statistics:', error);
		res.failure('Failed to fetch ticket statistics', 500);
	}
};

// Assign ticket to staff member
export const assignTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const { assignedTo, reason } = req.body;
		const assignerId = req.user?.id;
		const prisma = getPrismaClient();

		// Get the ticket
		const ticket = await prisma.ticket.findFirst({
			where: { id: ticketId, guildId },
		});

		if (!ticket) {
			return res.failure('Ticket not found', 404);
		}

		// Check if already assigned
		if (ticket.assignedTo && ticket.assignedTo === assignedTo) {
			return res.failure('Ticket is already assigned to this user', 400);
		}

		// Update ticket assignment
		const updatedTicket = await prisma.ticket.update({
			where: { id: ticketId },
			data: {
				assignedTo,
				updatedAt: new Date(),
			},
		});

		// Log the assignment
		await prisma.ticketMessage.create({
			data: {
				ticketId,
				messageId: 'system',
				userId: assignerId || 'system',
				userIcon: '',
				content: `Ticket assigned to <@${assignedTo}>${
					reason ? ` - ${reason}` : ''
				}`,
				attachments: [],
				embeds: [],
				isSystemMsg: true,
			},
		});

		// Broadcast assignment update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('ticketAssigned', {
				ticketId,
				assignedTo,
				assignedBy: assignerId,
				reason,
			})
		);

		logger.info(`Ticket ${ticketId} assigned to ${assignedTo}`, {
			guildId,
			assignerId,
		});

		res.success({
			message: 'Ticket assigned successfully',
			data: updatedTicket,
		});
	} catch (error) {
		logger.error('Error assigning ticket:', error);
		res.failure('Failed to assign ticket', 500);
	}
};

// Unassign ticket
export const unassignTicket = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ticketId } = req.params;
		const { reason } = req.body;
		const unassignerId = req.user?.id;
		const prisma = getPrismaClient();

		// Get the ticket
		const ticket = await prisma.ticket.findFirst({
			where: { id: ticketId, guildId },
		});

		if (!ticket) {
			return res.failure('Ticket not found', 404);
		}

		if (!ticket.assignedTo) {
			return res.failure('Ticket is not assigned', 400);
		}

		const previousAssignee = ticket.assignedTo;

		// Update ticket assignment
		const updatedTicket = await prisma.ticket.update({
			where: { id: ticketId },
			data: {
				assignedTo: null,
				updatedAt: new Date(),
			},
		});

		// Log the unassignment
		await prisma.ticketMessage.create({
			data: {
				ticketId,
				messageId: 'system',
				userId: unassignerId || 'system',
				userIcon: '',
				content: `Ticket unassigned from <@${previousAssignee}>${
					reason ? ` - ${reason}` : ''
				}`,
				attachments: [],
				embeds: [],
				isSystemMsg: true,
			},
		});

		// Broadcast unassignment update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('ticketUnassigned', {
				ticketId,
				previousAssignee,
				unassignedBy: unassignerId,
				reason,
			})
		);

		logger.info(`Ticket ${ticketId} unassigned from ${previousAssignee}`, {
			guildId,
			unassignerId,
		});

		res.success({
			message: 'Ticket unassigned successfully',
			data: updatedTicket,
		});
	} catch (error) {
		logger.error('Error unassigning ticket:', error);
		res.failure('Failed to unassign ticket', 500);
	}
};

// Bulk assign tickets
export const bulkAssignTickets = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { ticketIds, assignedTo, reason } = req.body;
		const assignerId = req.user?.id;
		const prisma = getPrismaClient();

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return res.failure('Ticket IDs array is required', 400);
		}

		if (ticketIds.length > 50) {
			return res.failure('Cannot assign more than 50 tickets at once', 400);
		}

		// Get tickets to assign
		const tickets = await prisma.ticket.findMany({
			where: {
				id: { in: ticketIds },
				guildId,
				status: { in: ['OPEN', 'CLAIMED'] },
			},
		});

		if (tickets.length === 0) {
			return res.failure('No valid tickets found to assign', 400);
		}

		// Update all tickets
		const updatedTickets = await prisma.ticket.updateMany({
			where: {
				id: { in: tickets.map((t: any) => t.id) },
			},
			data: {
				assignedTo,
				updatedAt: new Date(),
			},
		});

		// Log assignments
		const logMessages = tickets.map((ticket: any) => ({
			ticketId: ticket.id,
			messageId: 'system',
			userId: assignerId || 'system',
			userIcon: '',
			content: `Ticket assigned to <@${assignedTo}> (bulk assignment)${
				reason ? ` - ${reason}` : ''
			}`,
			attachments: [],
			embeds: [],
			isSystemMsg: true,
		}));

		await prisma.ticketMessage.createMany({
			data: logMessages,
		});

		// Broadcast bulk assignment
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('ticketsBulkAssigned', {
				ticketIds: tickets.map((t: any) => t.id),
				assignedTo,
				assignedBy: assignerId,
				count: tickets.length,
				reason,
			})
		);

		logger.info(`Bulk assigned ${tickets.length} tickets to ${assignedTo}`, {
			guildId,
			assignerId,
		});

		res.success({
			message: `Successfully assigned ${tickets.length} tickets`,
			data: {
				assignedCount: tickets.length,
				skippedCount: ticketIds.length - tickets.length,
			},
		});
	} catch (error) {
		logger.error('Error bulk assigning tickets:', error);
		res.failure('Failed to bulk assign tickets', 500);
	}
};

// Auto-assign tickets based on workload
export const autoAssignTickets = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { staffIds, maxAssignments = 5 } = req.body;
		const assignerId = req.user?.id;
		const prisma = getPrismaClient();

		if (!Array.isArray(staffIds) || staffIds.length === 0) {
			return res.failure('Staff IDs array is required', 400);
		}

		// Get unassigned tickets
		const unassignedTickets = await prisma.ticket.findMany({
			where: {
				guildId,
				assignedTo: null,
				status: { in: ['OPEN', 'CLAIMED'] },
			},
			orderBy: { createdAt: 'asc' },
		});

		if (unassignedTickets.length === 0) {
			return res.failure('No unassigned tickets found', 400);
		}

		// Get current workload for each staff member
		const staffWorkloads = await Promise.all(
			staffIds.map(async (staffId: string) => {
				const assignedCount = await prisma.ticket.count({
					where: {
						guildId,
						assignedTo: staffId,
						status: { in: ['OPEN', 'CLAIMED'] },
					},
				});
				return { staffId, assignedCount };
			})
		);

		// Sort staff by workload (ascending)
		staffWorkloads.sort((a, b) => a.assignedCount - b.assignedCount);

		const assignments: { ticketId: string; staffId: string }[] = [];
		let staffIndex = 0;

		// Assign tickets in round-robin fashion
		for (const ticket of unassignedTickets) {
			const staff = staffWorkloads[staffIndex];

			if (staff.assignedCount < maxAssignments) {
				assignments.push({ ticketId: ticket.id, staffId: staff.staffId });
				staff.assignedCount++;

				// Move to next staff member
				staffIndex = (staffIndex + 1) % staffWorkloads.length;
			} else {
				// All staff members are at max capacity
				break;
			}
		}

		if (assignments.length === 0) {
			return res.failure('All staff members are at maximum capacity', 400);
		}

		// Execute assignments
		const updatePromises = assignments.map(({ ticketId, staffId }) =>
			prisma.ticket.update({
				where: { id: ticketId },
				data: {
					assignedTo: staffId,
					updatedAt: new Date(),
				},
			})
		);

		await Promise.all(updatePromises);

		// Log assignments
		const logMessages = assignments.map(({ ticketId, staffId }) => ({
			ticketId,
			messageId: 'system',
			userId: assignerId || 'system',
			userIcon: '',
			content: `Ticket auto-assigned to <@${staffId}>`,
			attachments: [],
			embeds: [],
			isSystemMsg: true,
		}));

		await prisma.ticketMessage.createMany({
			data: logMessages,
		});

		// Broadcast auto-assignments
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('ticketsAutoAssigned', {
				assignments,
				assignedBy: assignerId,
				count: assignments.length,
			})
		);

		logger.info(`Auto-assigned ${assignments.length} tickets`, {
			guildId,
			assignerId,
		});

		res.success({
			message: `Successfully auto-assigned ${assignments.length} tickets`,
			data: {
				assignments,
				assignedCount: assignments.length,
				remainingUnassigned: unassignedTickets.length - assignments.length,
			},
		});
	} catch (error) {
		logger.error('Error auto-assigning tickets:', error);
		res.failure('Failed to auto-assign tickets', 500);
	}
};

// Get assignment statistics
export const getAssignmentStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get staff workloads
		const staffWorkloads = await prisma.ticket.groupBy({
			by: ['assignedTo'],
			where: {
				guildId,
				assignedTo: { not: null },
				status: { in: ['OPEN', 'CLAIMED'] },
			},
			_count: { assignedTo: true },
		});

		// Get assignment history
		const assignmentHistory = await prisma.ticketMessage.findMany({
			where: {
				ticket: { guildId },
				content: { contains: 'assigned' },
				isSystemMsg: true,
				createdAt: { gte: startDate },
			},
			include: {
				ticket: {
					select: {
						id: true,
						assignedTo: true,
						status: true,
						category: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		// Calculate response times for assigned tickets
		const assignedTickets = await prisma.ticket.findMany({
			where: {
				guildId,
				assignedTo: { not: null },
				status: 'CLOSED',
				createdAt: { gte: startDate },
			},
			include: {
				messages: {
					where: { isSystemMsg: false },
					orderBy: { createdAt: 'asc' },
					take: 1,
				},
			},
		});

		const responseTimeData = assignedTickets
			.filter((ticket: any) => ticket.messages.length > 0)
			.map((ticket: any) => {
				const firstResponse = ticket.messages[0];
				const responseTime =
					firstResponse.createdAt.getTime() - ticket.createdAt.getTime();
				return {
					ticketId: ticket.id,
					assignedTo: ticket.assignedTo,
					responseTime,
					category: ticket.category,
				};
			});

		// Calculate average response times by staff
		const staffResponseTimes = responseTimeData.reduce(
			(acc: any, data: any) => {
				if (!acc[data.assignedTo!]) {
					acc[data.assignedTo!] = [];
				}
				acc[data.assignedTo!].push(data.responseTime);
				return acc;
			},
			{} as Record<string, number[]>
		);

		const staffAverages = Object.entries(staffResponseTimes).map(
			([staffId, times]: [string, any]) => ({
				staffId,
				averageResponseTime:
					(times as number[]).reduce((a: number, b: number) => a + b, 0) /
					(times as number[]).length,
				ticketCount: (times as number[]).length,
			})
		);

		// Get unassigned tickets count
		const unassignedCount = await prisma.ticket.count({
			where: {
				guildId,
				assignedTo: null,
				status: { in: ['OPEN', 'CLAIMED'] },
			},
		});

		const statistics = {
			period: period as string,
			workloads: staffWorkloads.map((w: any) => ({
				staffId: w.assignedTo,
				activeTickets: w._count.assignedTo,
			})),
			averageResponseTimes: staffAverages,
			assignmentHistory: assignmentHistory.slice(0, 50), // Last 50 assignments
			unassignedTickets: unassignedCount,
			totalAssignedTickets: staffWorkloads.reduce(
				(sum: number, w: any) => sum + w._count.assignedTo,
				0
			),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching assignment statistics:', error);
		res.failure('Failed to fetch assignment statistics', 500);
	}
};

// Helper function to parse period
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
