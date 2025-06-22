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

const router = Router({ mergeParams: true });

// All ticket routes require authentication and guild access
router.use(authenticateToken, validateGuildAccess);

// Settings (Admin)
router.get(
	'/settings',
	guildTicketsRateLimit,
	requireAdminPermissions,
	getTicketSettings
);

router.put(
	'/settings',
	validateTicketSettings,
	ticketsRateLimit,
	requireAdminPermissions,
	updateTicketSettings
);

// Statistics (Admin)
router.get(
	'/statistics',
	guildTicketsRateLimit,
	requireAdminPermissions,
	getTicketStatistics
);

// All tickets (Moderator)
router.get(
	'/',
	validatePagination,
	guildTicketsRateLimit,
	requireModerationPermissions,
	getTickets
);

// Create a ticket (Any authenticated user)
router.post('/', ticketsRateLimit, createTicket);

// Individual ticket routes (Moderator)
const ticketRouter = Router({ mergeParams: true });
router.use('/:ticketId', requireModerationPermissions, ticketRouter);

ticketRouter.get('/', guildTicketsRateLimit, getTicket);
ticketRouter.put('/', ticketsRateLimit, updateTicket);
ticketRouter.post('/close', ticketsRateLimit, closeTicket);
ticketRouter.post('/claim', ticketsRateLimit, claimTicket);

export default router;
