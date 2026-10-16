import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireUniversalPermissions } from '../middleware/permissions.js';
import { validateZod } from '../validation/zodValidate.js';
import { z } from 'zod';
import {
	getEvents,
	getEvent,
	createEvent,
	updateEvent,
	deleteEvent,
	rsvpToEvent,
	getEventStatistics,
} from '../controllers/eventController.js';

const router = express.Router();

// Validation schemas
const createEventSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	startTime: z.string().datetime(),
	endTime: z.string().datetime().optional(),
	timezone: z.string().optional(),
	location: z.string().optional(),
	maxAttendees: z.number().positive().optional(),
	requiresApproval: z.boolean().optional(),
	recurring: z.any().optional(),
	reminderTimes: z.array(z.number()).optional(),
});

const updateEventSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
	timezone: z.string().optional(),
	location: z.string().optional(),
	maxAttendees: z.number().positive().optional(),
	requiresApproval: z.boolean().optional(),
	recurring: z.any().optional(),
	reminderTimes: z.array(z.number()).optional(),
});

const rsvpSchema = z.object({
	userId: z.string(),
	status: z.enum(['going', 'maybe', 'not_going']),
	notes: z.string().optional(),
});

// Event management routes
router.get(
	'/guilds/:guildId/events',
	authenticateToken,
	requireUniversalPermissions(['VIEW_EVENTS']),
	getEvents
);

router.get(
	'/guilds/:guildId/events/:eventId',
	authenticateToken,
	requireUniversalPermissions(['VIEW_EVENTS']),
	getEvent
);

router.post(
	'/guilds/:guildId/events',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_EVENTS']),
	validateZod(createEventSchema),
	createEvent
);

router.put(
	'/guilds/:guildId/events/:eventId',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_EVENTS']),
	validateZod(updateEventSchema),
	updateEvent
);

router.delete(
	'/guilds/:guildId/events/:eventId',
	authenticateToken,
	requireUniversalPermissions(['MANAGE_EVENTS']),
	deleteEvent
);

router.post(
	'/guilds/:guildId/events/:eventId/rsvp',
	authenticateToken,
	requireUniversalPermissions(['USE_EVENTS']),
	validateZod(rsvpSchema),
	rsvpToEvent
);

router.get(
	'/guilds/:guildId/events/statistics',
	authenticateToken,
	requireUniversalPermissions(['VIEW_EVENTS']),
	getEventStatistics
);

export default router;
