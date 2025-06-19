import { Router } from 'express';
import {
	getTicketSettings,
	updateTicketSettings,
	getTickets,
	getTicket,
	createTicket,
	updateTicket,
	closeTicket,
	claimTicket,
	getTicketStatistics,
} from '../controllers/ticketsController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateTicketSettings,
	validatePagination,
} from '../middleware/validation.js';
import {
	ticketsRateLimit,
	guildTicketsRateLimit,
} from '../middleware/rateLimiting.js';
import {
	requireAdminPermissions,
	requireModerationPermissions,
} from '../middleware/permissions.js';

const router = Router();

// All ticket routes require authentication and guild access
router.use(
	'/guilds/:guildId/tickets',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Settings
router.get(
	'/guilds/:guildId/tickets/settings',
	guildTicketsRateLimit,
	requireAdminPermissions,
	getTicketSettings
);

router.put(
	'/guilds/:guildId/tickets/settings',
	validateTicketSettings,
	ticketsRateLimit,
	requireAdminPermissions,
	updateTicketSettings
);

// Tickets
router.get(
	'/guilds/:guildId/tickets',
	validatePagination,
	guildTicketsRateLimit,
	requireModerationPermissions,
	getTickets
);

router.get(
	'/guilds/:guildId/tickets/:ticketId',
	guildTicketsRateLimit,
	requireModerationPermissions,
	getTicket
);

router.post('/guilds/:guildId/tickets', ticketsRateLimit, createTicket);

router.put(
	'/guilds/:guildId/tickets/:ticketId',
	ticketsRateLimit,
	requireModerationPermissions,
	updateTicket
);

router.post(
	'/guilds/:guildId/tickets/:ticketId/close',
	ticketsRateLimit,
	requireModerationPermissions,
	closeTicket
);

router.post(
	'/guilds/:guildId/tickets/:ticketId/claim',
	ticketsRateLimit,
	requireModerationPermissions,
	claimTicket
);

// Statistics
router.get(
	'/guilds/:guildId/tickets/statistics',
	guildTicketsRateLimit,
	requireAdminPermissions,
	getTicketStatistics
);

export default router;
