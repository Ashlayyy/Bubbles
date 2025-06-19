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

const router = Router();

// All starboard routes require authentication and guild access
router.use(
	'/guilds/:guildId/starboard',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Settings
router.get(
	'/guilds/:guildId/starboard/settings',
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardSettings
);

router.put(
	'/guilds/:guildId/starboard/settings',
	starboardRateLimit,
	requireAdminPermissions,
	updateStarboardSettings
);

// Messages
router.get(
	'/guilds/:guildId/starboard/messages',
	validatePagination,
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardMessages
);

// Statistics
router.get(
	'/guilds/:guildId/starboard/statistics',
	guildStarboardRateLimit,
	requireAdminPermissions,
	getStarboardStats
);

export default router;
