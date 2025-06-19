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
	validateGuildId,
	validateGuildAccess,
	validateReactionRole,
	validatePagination,
} from '../middleware/validation.js';
import {
	reactionRolesRateLimit,
	guildReactionRolesRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All reaction role routes require authentication and guild access
router.use(
	'/guilds/:guildId/reaction-roles',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Get all reaction roles
router.get(
	'/guilds/:guildId/reaction-roles',
	validatePagination,
	guildReactionRolesRateLimit,
	requireAdminPermissions,
	getReactionRoles
);

// Get single reaction role
router.get(
	'/guilds/:guildId/reaction-roles/:reactionRoleId',
	guildReactionRolesRateLimit,
	requireAdminPermissions,
	getReactionRole
);

// Create reaction role
router.post(
	'/guilds/:guildId/reaction-roles',
	validateReactionRole,
	reactionRolesRateLimit,
	requireAdminPermissions,
	createReactionRole
);

// Update reaction role
router.put(
	'/guilds/:guildId/reaction-roles/:reactionRoleId',
	validateReactionRole,
	reactionRolesRateLimit,
	requireAdminPermissions,
	updateReactionRole
);

// Delete reaction role
router.delete(
	'/guilds/:guildId/reaction-roles/:reactionRoleId',
	reactionRolesRateLimit,
	requireAdminPermissions,
	deleteReactionRole
);

// Get reaction role logs
router.get(
	'/guilds/:guildId/reaction-roles/logs',
	validatePagination,
	guildReactionRolesRateLimit,
	requireAdminPermissions,
	getReactionRoleLogs
);

// Get reaction role statistics
router.get(
	'/guilds/:guildId/reaction-roles/statistics',
	guildReactionRolesRateLimit,
	requireAdminPermissions,
	getReactionRoleStatistics
);

export default router;
