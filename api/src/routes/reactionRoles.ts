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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All reaction role routes require authentication and admin permissions
router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

// Get all reaction roles
router.get(
	'/',
	validatePagination,
	guildReactionRolesRateLimit,
	getReactionRoles
);

// Statistics & Logs (placing before :reactionRoleId to avoid conflict)
router.get(
	'/logs',
	validatePagination,
	guildReactionRolesRateLimit,
	getReactionRoleLogs
);

router.get(
	'/statistics',
	guildReactionRolesRateLimit,
	getReactionRoleStatistics
);

// Get single reaction role
router.get('/:reactionRoleId', guildReactionRolesRateLimit, getReactionRole);

// Create reaction role
router.post(
	'/',
	validateReactionRole,
	reactionRolesRateLimit,
	createReactionRole
);

// Update reaction role
router.put(
	'/:reactionRoleId',
	validateReactionRole,
	reactionRolesRateLimit,
	updateReactionRole
);

// Delete reaction role
router.delete('/:reactionRoleId', reactionRolesRateLimit, deleteReactionRole);

export default router;
