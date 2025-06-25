import { Router } from 'express';
import {
	getReactionRoles,
	getReactionRole,
	createReactionRole,
	updateReactionRole,
	deleteReactionRole,
	getReactionRoleLogs,
	getReactionRoleStatistics,
} from '../controllers/reactionRolesController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildAccess,
	validateReactionRole,
	validatePagination,
} from '../middleware/validation.js';
import {
	reactionRolesRateLimit,
	guildReactionRolesRateLimit,
} from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildReactionRolesRateLimit,
	getReactionRoles
);

addRoute(
	router,
	'get',
	'/logs',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildReactionRolesRateLimit,
	getReactionRoleLogs
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildReactionRolesRateLimit,
	getReactionRoleStatistics
);

addRoute(
	router,
	'get',
	'/:reactionRoleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildReactionRolesRateLimit,
	getReactionRole
);

addRoute(
	router,
	'post',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateReactionRole,
	reactionRolesRateLimit,
	createReactionRole
);

addRoute(
	router,
	'put',
	'/:reactionRoleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateReactionRole,
	reactionRolesRateLimit,
	updateReactionRole
);

addRoute(
	router,
	'delete',
	'/:reactionRoleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	reactionRolesRateLimit,
	deleteReactionRole
);

export default router;
