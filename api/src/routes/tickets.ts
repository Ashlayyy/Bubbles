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
import { addRoute } from '../utils/secureRoute.js';
import { requireModerationPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildTicketsRateLimit,
	getTicketSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateTicketSettings,
	ticketsRateLimit,
	updateTicketSettings
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildTicketsRateLimit,
	getTicketStatistics
);

addRoute(
	router,
	'get',
	'/',
	{
		discordPermissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MODERATE_MEMBERS'],
		permissionsOverride: true,
	},
	validatePagination,
	guildTicketsRateLimit,
	getTickets
);

addRoute(router, 'post', '/', {}, ticketsRateLimit, createTicket);

const ticketRouter = Router({ mergeParams: true });
router.use('/:ticketId', requireModerationPermissions, ticketRouter);

ticketRouter.get('/', guildTicketsRateLimit, getTicket);
ticketRouter.put('/', ticketsRateLimit, updateTicket);
ticketRouter.post('/close', ticketsRateLimit, closeTicket);
ticketRouter.post('/claim', ticketsRateLimit, claimTicket);

export default router;
