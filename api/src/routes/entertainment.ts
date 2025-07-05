import { Router } from 'express';
import {
	getGameConfigs,
	updateGameSettings,
	getEconomySettings,
	updateEconomySettings,
	getTriviaQuestions,
	addTriviaQuestion,
} from '../controllers/entertainmentController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Game configs
addRoute(
	router,
	'get',
	'/games',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getGameConfigs
);

addRoute(
	router,
	'put',
	'/games',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	updateGameSettings
);

// Economy settings
addRoute(
	router,
	'get',
	'/economy',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getEconomySettings
);

addRoute(
	router,
	'put',
	'/economy',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	updateEconomySettings
);

// Trivia questions
addRoute(
	router,
	'get',
	'/trivia',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	generalRateLimit,
	getTriviaQuestions
);

addRoute(
	router,
	'post',
	'/trivia',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	addTriviaQuestion
);

export default router;
