import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('event-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'EVENT_MANAGEMENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Get events for a guild
export const getEvents = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			page = 1,
			limit = 20,
			status = 'all',
			upcoming = false,
			createdBy,
		} = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };

		if (upcoming === 'true') {
			where.startTime = { gte: new Date() };
		}

		if (createdBy) {
			where.createdBy = createdBy as string;
		}

		// Fetch events with pagination
		const [events, total] = await Promise.all([
			prisma.event.findMany({
				where,
				orderBy: { startTime: 'asc' },
				skip,
				take,
				include: {
					rsvps: {
						include: {
							// Get user info if available
						},
					},
				},
			}),
			prisma.event.count({ where }),
		]);

		// Format events with RSVP counts
		const formattedEvents = events.map((event: any) => {
			const rsvpCounts = {
				going: event.rsvps.filter((rsvp: any) => rsvp.status === 'going')
					.length,
				maybe: event.rsvps.filter((rsvp: any) => rsvp.status === 'maybe')
					.length,
				not_going: event.rsvps.filter(
					(rsvp: any) => rsvp.status === 'not_going'
				).length,
			};

			return {
				...event,
				rsvpCounts,
				totalRSVPs: event.rsvps.length,
				attendeeCount: rsvpCounts.going,
			};
		});

		res.success({
			events: formattedEvents,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching events:', error);
		res.failure('Failed to fetch events', 500);
	}
};

// Get single event with detailed RSVP information
export const getEvent = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, eventId } = req.params;
		const prisma = getPrismaClient();

		const event = await prisma.event.findFirst({
			where: {
				id: eventId,
				guildId,
			},
			include: {
				rsvps: {
					orderBy: { rsvpAt: 'desc' },
				},
			},
		});

		if (!event) {
			return res.failure('Event not found', 404);
		}

		// Format RSVP data
		const rsvpCounts = {
			going: event.rsvps.filter((rsvp: any) => rsvp.status === 'going').length,
			maybe: event.rsvps.filter((rsvp: any) => rsvp.status === 'maybe').length,
			not_going: event.rsvps.filter((rsvp: any) => rsvp.status === 'not_going')
				.length,
		};

		const formattedEvent = {
			...event,
			rsvpCounts,
			totalRSVPs: event.rsvps.length,
			attendeeCount: rsvpCounts.going,
		};

		res.success(formattedEvent);
	} catch (error) {
		logger.error('Error fetching event:', error);
		res.failure('Failed to fetch event', 500);
	}
};

// Create a new event
export const createEvent = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			title,
			description,
			startTime,
			endTime,
			timezone = 'UTC',
			location,
			maxAttendees,
			requiresApproval = false,
			recurring,
			reminderTimes = [60, 15], // Default reminders: 1 hour and 15 minutes before
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (!title || !startTime) {
			return res.failure('Title and start time are required', 400);
		}

		// Validate dates
		const startDate = new Date(startTime);
		const endDate = endTime ? new Date(endTime) : null;

		if (startDate < new Date()) {
			return res.failure('Start time cannot be in the past', 400);
		}

		if (endDate && endDate <= startDate) {
			return res.failure('End time must be after start time', 400);
		}

		// Create event
		const event = await prisma.event.create({
			data: {
				guildId,
				createdBy: req.user?.id || 'unknown',
				title,
				description,
				startTime: startDate,
				endTime: endDate,
				timezone,
				location,
				maxAttendees,
				requiresApproval,
				recurring,
				reminderTimes,
			},
		});

		// Broadcast event creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('eventCreate', event)
		);

		logger.info(`Created event '${title}' for guild ${guildId}`, {
			eventId: event.id,
			startTime: startDate,
		});

		res.success({ message: 'Event created successfully', data: event }, 201);
	} catch (error) {
		logger.error('Error creating event:', error);
		res.failure('Failed to create event', 500);
	}
};

// Update an existing event
export const updateEvent = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, eventId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if event exists
		const existingEvent = await prisma.event.findFirst({
			where: {
				id: eventId,
				guildId,
			},
		});

		if (!existingEvent) {
			return res.failure('Event not found', 404);
		}

		// Validate dates if provided
		if (updateData.startTime) {
			const startDate = new Date(updateData.startTime);
			if (startDate < new Date()) {
				return res.failure('Start time cannot be in the past', 400);
			}
			updateData.startTime = startDate;
		}

		if (updateData.endTime) {
			const endDate = new Date(updateData.endTime);
			const startDate = updateData.startTime
				? new Date(updateData.startTime)
				: existingEvent.startTime;
			if (endDate <= startDate) {
				return res.failure('End time must be after start time', 400);
			}
			updateData.endTime = endDate;
		}

		// Update event
		const updatedEvent = await prisma.event.update({
			where: { id: eventId },
			data: {
				...updateData,
				updatedAt: new Date(),
			},
		});

		// Broadcast event update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('eventUpdate', updatedEvent)
		);

		logger.info(`Updated event ${eventId} for guild ${guildId}`);

		res.success({
			message: 'Event updated successfully',
			data: updatedEvent,
		});
	} catch (error) {
		logger.error('Error updating event:', error);
		res.failure('Failed to update event', 500);
	}
};

// Delete an event
export const deleteEvent = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, eventId } = req.params;
		const prisma = getPrismaClient();

		// Check if event exists
		const existingEvent = await prisma.event.findFirst({
			where: {
				id: eventId,
				guildId,
			},
		});

		if (!existingEvent) {
			return res.failure('Event not found', 404);
		}

		// Delete event and its RSVPs (cascade delete)
		await prisma.event.delete({
			where: { id: eventId },
		});

		// Broadcast event deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('eventDelete', { id: eventId })
		);

		logger.info(`Deleted event ${eventId} from guild ${guildId}`);

		res.success({ message: 'Event deleted successfully' });
	} catch (error) {
		logger.error('Error deleting event:', error);
		res.failure('Failed to delete event', 500);
	}
};

// RSVP to an event
export const rsvpToEvent = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, eventId } = req.params;
		const { userId, status, notes } = req.body;
		const prisma = getPrismaClient();

		// Validate status
		if (!['going', 'maybe', 'not_going'].includes(status)) {
			return res.failure('Invalid RSVP status', 400);
		}

		// Check if event exists
		const event = await prisma.event.findFirst({
			where: {
				id: eventId,
				guildId,
			},
			include: {
				rsvps: {
					where: { status: 'going' },
				},
			},
		});

		if (!event) {
			return res.failure('Event not found', 404);
		}

		// Check if event has passed
		if (event.startTime < new Date()) {
			return res.failure('Cannot RSVP to past events', 400);
		}

		// Check max attendees limit
		if (status === 'going' && event.maxAttendees) {
			const currentAttendees = event.rsvps.length;
			const existingRSVP = await prisma.eventRSVP.findUnique({
				where: { eventId_userId: { eventId, userId } },
			});

			// If changing from not going/maybe to going, check capacity
			if (!existingRSVP || existingRSVP.status !== 'going') {
				if (currentAttendees >= event.maxAttendees) {
					return res.failure('Event is at maximum capacity', 400);
				}
			}
		}

		// Upsert RSVP
		const rsvp = await prisma.eventRSVP.upsert({
			where: { eventId_userId: { eventId, userId } },
			update: {
				status,
				notes,
				rsvpAt: new Date(),
			},
			create: {
				eventId,
				userId,
				status,
				notes,
			},
		});

		// Get updated event with RSVP counts
		const updatedEvent = await prisma.event.findUnique({
			where: { id: eventId },
			include: {
				rsvps: true,
			},
		});

		const rsvpCounts = {
			going:
				updatedEvent?.rsvps.filter((r: any) => r.status === 'going').length ||
				0,
			maybe:
				updatedEvent?.rsvps.filter((r: any) => r.status === 'maybe').length ||
				0,
			not_going:
				updatedEvent?.rsvps.filter((r: any) => r.status === 'not_going')
					.length || 0,
		};

		// Broadcast RSVP update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('eventRSVP', {
				eventId,
				userId,
				status,
				rsvpCounts,
			})
		);

		logger.info(`User ${userId} RSVP'd '${status}' to event ${eventId}`);

		res.success({
			message: 'RSVP updated successfully',
			data: {
				rsvp,
				rsvpCounts,
			},
		});
	} catch (error) {
		logger.error('Error updating RSVP:', error);
		res.failure('Failed to update RSVP', 500);
	}
};

// Get event statistics
export const getEventStatistics = async (req: AuthRequest, res: Response) => {
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
			totalEvents,
			upcomingEvents,
			pastEvents,
			totalRSVPs,
			averageAttendees,
			eventsByCreator,
		] = await Promise.all([
			prisma.event.count({
				where: { guildId, createdAt: { gte: startDate } },
			}),
			prisma.event.count({
				where: { guildId, startTime: { gte: now } },
			}),
			prisma.event.count({
				where: { guildId, startTime: { lt: now } },
			}),
			prisma.eventRSVP.count({
				where: {
					event: { guildId },
					rsvpAt: { gte: startDate },
				},
			}),
			prisma.eventRSVP.aggregate({
				where: {
					event: { guildId, startTime: { gte: startDate } },
					status: 'going',
				},
				_avg: { eventId: true },
			}),
			prisma.event.groupBy({
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
				totalEvents,
				upcomingEvents,
				pastEvents,
				totalRSVPs,
				averageAttendees: Math.round(averageAttendees._avg.eventId || 0),
			},
			topCreators: eventsByCreator.map((creator: any) => ({
				userId: creator.createdBy,
				eventCount: creator._count.createdBy,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching event statistics:', error);
		res.failure('Failed to fetch event statistics', 500);
	}
};
