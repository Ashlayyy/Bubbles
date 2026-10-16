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
	assignTicket,
	unassignTicket,
	bulkAssignTickets,
	autoAssignTickets,
	getAssignmentStatistics,
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

// Assignment routes
addRoute(
	router,
	'post',
	'/:ticketId/assign',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	guildTicketsRateLimit,
	assignTicket
);

addRoute(
	router,
	'post',
	'/:ticketId/unassign',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	guildTicketsRateLimit,
	unassignTicket
);

addRoute(
	router,
	'post',
	'/bulk-assign',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	guildTicketsRateLimit,
	bulkAssignTickets
);

addRoute(
	router,
	'post',
	'/auto-assign',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	guildTicketsRateLimit,
	autoAssignTickets
);

addRoute(
	router,
	'get',
	'/assignment-statistics',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	guildTicketsRateLimit,
	getAssignmentStatistics
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
