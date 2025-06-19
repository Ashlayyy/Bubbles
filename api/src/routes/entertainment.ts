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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All entertainment routes require authentication and guild access
router.use(
	'/guilds/:guildId/entertainment',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Game configurations
router.get(
	'/guilds/:guildId/entertainment/games',
	generalRateLimit,
	requireAdminPermissions,
	getGameConfigs
);

router.put(
	'/guilds/:guildId/entertainment/games',
	generalRateLimit,
	requireAdminPermissions,
	updateGameSettings
);

// Economy settings
router.get(
	'/guilds/:guildId/entertainment/economy',
	generalRateLimit,
	requireAdminPermissions,
	getEconomySettings
);

router.put(
	'/guilds/:guildId/entertainment/economy',
	generalRateLimit,
	requireAdminPermissions,
	updateEconomySettings
);

// Trivia questions
router.get(
	'/guilds/:guildId/entertainment/trivia',
	validatePagination,
	generalRateLimit,
	requireAdminPermissions,
	getTriviaQuestions
);

router.post(
	'/guilds/:guildId/entertainment/trivia',
	generalRateLimit,
	requireAdminPermissions,
	addTriviaQuestion
);

export default router;
