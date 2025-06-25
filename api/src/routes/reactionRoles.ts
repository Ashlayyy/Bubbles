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

router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

router.get(
	'/',
	validatePagination,
	guildReactionRolesRateLimit,
	getReactionRoles
);

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

router.get('/:reactionRoleId', guildReactionRolesRateLimit, getReactionRole);

router.post(
	'/',
	validateReactionRole,
	reactionRolesRateLimit,
	createReactionRole
);

router.put(
	'/:reactionRoleId',
	validateReactionRole,
	reactionRolesRateLimit,
	updateReactionRole
);

router.delete('/:reactionRoleId', reactionRolesRateLimit, deleteReactionRole);

export default router;
