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

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

router.get('/games', generalRateLimit, requireAdminPermissions, getGameConfigs);

router.put(
	'/games',
	generalRateLimit,
	requireAdminPermissions,
	updateGameSettings
);

router.get(
	'/economy',
	generalRateLimit,
	requireAdminPermissions,
	getEconomySettings
);

router.put(
	'/economy',
	generalRateLimit,
	requireAdminPermissions,
	updateEconomySettings
);

router.get(
	'/trivia',
	validatePagination,
	generalRateLimit,
	requireAdminPermissions,
	getTriviaQuestions
);

router.post(
	'/trivia',
	generalRateLimit,
	requireAdminPermissions,
	addTriviaQuestion
);

export default router;
