import { Router } from 'express';
import {
	getWelcomeSettings,
	updateWelcomeSettings,
	testWelcomeMessage,
	getWelcomeLogs,
	getWelcomeStatistics,
} from '../controllers/welcomeController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildAccess,
	validateWelcomeSettings,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

router.get('/settings', generalRateLimit, getWelcomeSettings);
router.put(
	'/settings',
	validateWelcomeSettings,
	generalRateLimit,
	updateWelcomeSettings
);

router.post('/test', generalRateLimit, testWelcomeMessage);

router.get('/logs', validatePagination, generalRateLimit, getWelcomeLogs);

router.get('/statistics', generalRateLimit, getWelcomeStatistics);

export default router;
