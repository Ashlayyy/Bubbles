import { Router } from 'express';
import {
	getWelcomeSettings,
	updateWelcomeSettings,
	testWelcomeMessage,
	getWelcomeStatistics,
} from '../controllers/welcomeController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildAccess,
	validateWelcomeSettings,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getWelcomeSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateWelcomeSettings,
	generalRateLimit,
	updateWelcomeSettings
);

addRoute(
	router,
	'post',
	'/test',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	testWelcomeMessage
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getWelcomeStatistics
);

export default router;
