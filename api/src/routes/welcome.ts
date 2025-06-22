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

// All welcome routes require authentication and admin permissions
router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

// Settings
router.get('/settings', generalRateLimit, getWelcomeSettings);
router.put(
	'/settings',
	validateWelcomeSettings,
	generalRateLimit,
	updateWelcomeSettings
);

// Test message
router.post('/test', generalRateLimit, testWelcomeMessage);

// Logs
router.get('/logs', validatePagination, generalRateLimit, getWelcomeLogs);

// Statistics
router.get('/statistics', generalRateLimit, getWelcomeStatistics);

export default router;
