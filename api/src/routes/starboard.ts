import { Router } from 'express';
import {
	getStarboardSettings,
	updateStarboardSettings,
	getStarboardMessages,
	getStarboardStats,
} from '../controllers/starboardController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import {
	starboardRateLimit,
	guildStarboardRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

router.get(
	'/settings',
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardSettings
);

router.put(
	'/settings',
	starboardRateLimit,
	requireAdminPermissions,
	updateStarboardSettings
);

router.get(
	'/messages',
	validatePagination,
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardMessages
);

router.get(
	'/statistics',
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardStats
);

export default router;
