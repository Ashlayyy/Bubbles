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
	validateGuildId,
	validateGuildAccess,
	validateWelcomeSettings,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All welcome routes require authentication and guild access
router.use(
	'/guilds/:guildId/welcome',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Settings
router.get(
	'/guilds/:guildId/welcome/settings',
	generalRateLimit,
	requireAdminPermissions,
	getWelcomeSettings
);

router.put(
	'/guilds/:guildId/welcome/settings',
	validateWelcomeSettings,
	generalRateLimit,
	requireAdminPermissions,
	updateWelcomeSettings
);

// Test message
router.post(
	'/guilds/:guildId/welcome/test',
	generalRateLimit,
	requireAdminPermissions,
	testWelcomeMessage
);

// Logs
router.get(
	'/guilds/:guildId/welcome/logs',
	validatePagination,
	generalRateLimit,
	requireAdminPermissions,
	getWelcomeLogs
);

// Statistics
router.get(
	'/guilds/:guildId/welcome/statistics',
	generalRateLimit,
	requireAdminPermissions,
	getWelcomeStatistics
);

export default router;
