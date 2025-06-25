import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
	getAppealSettings,
	updateAppealSettings,
	getAppeals,
	getAppeal,
	submitAppeal,
	reviewAppeal,
	getAppealStatistics,
} from '../controllers/appealsController.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateAppeal,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

// Common validation for all appeals routes
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Settings routes
addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getAppealSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	updateAppealSettings
);

// Fetch appeals
addRoute(
	router,
	'get',
	'/',
	{
		discordPermissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MODERATE_MEMBERS'],
		permissionsOverride: true,
	},
	validatePagination,
	generalRateLimit,
	getAppeals
);

// Single appeal details
addRoute(
	router,
	'get',
	'/:appealId',
	{
		discordPermissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MODERATE_MEMBERS'],
		permissionsOverride: true,
	},
	generalRateLimit,
	getAppeal
);

// Submit an appeal (no special guild permissions, token required by default)
addRoute(
	router,
	'post',
	'/',
	{},
	validateAppeal,
	generalRateLimit,
	submitAppeal
);

// Review appeal
addRoute(
	router,
	'post',
	'/:appealId/review',
	{
		discordPermissions: ['BAN_MEMBERS', 'KICK_MEMBERS', 'MODERATE_MEMBERS'],
		permissionsOverride: true,
	},
	generalRateLimit,
	reviewAppeal
);

// Appeal statistics
addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getAppealStatistics
);

export default router;
