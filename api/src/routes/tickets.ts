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

router.use(authenticateToken, validateGuildAccess);

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

router.get(
	'/statistics',
	guildTicketsRateLimit,
	requireAdminPermissions,
	getTicketStatistics
);

router.get(
	'/',
	validatePagination,
	guildTicketsRateLimit,
	requireModerationPermissions,
	getTickets
);

router.post('/', ticketsRateLimit, createTicket);

const ticketRouter = Router({ mergeParams: true });
router.use('/:ticketId', requireModerationPermissions, ticketRouter);

ticketRouter.get('/', guildTicketsRateLimit, getTicket);
ticketRouter.put('/', ticketsRateLimit, updateTicket);
ticketRouter.post('/close', ticketsRateLimit, closeTicket);
ticketRouter.post('/claim', ticketsRateLimit, claimTicket);

export default router;
