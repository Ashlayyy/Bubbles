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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildStarboardRateLimit,
	getStarboardSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	starboardRateLimit,
	updateStarboardSettings
);

addRoute(
	router,
	'get',
	'/messages',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildStarboardRateLimit,
	getStarboardMessages
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildStarboardRateLimit,
	getStarboardStats
);

export default router;
