import { Router } from 'express';
import {
	getAppealSettings,
	updateAppealSettings,
	getAppeals,
	getAppeal,
	submitAppeal,
	reviewAppeal,
	getAppealStatistics,
} from '../controllers/appealsController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateAppeal,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import {
	requireAdminPermissions,
	requireModerationPermissions,
} from '../middleware/permissions.js';

const router = Router();

// All appeal routes require authentication and guild access
router.use(
	'/guilds/:guildId/appeals',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Settings
router.get(
	'/guilds/:guildId/appeals/settings',
	generalRateLimit,
	requireAdminPermissions,
	getAppealSettings
);

router.put(
	'/guilds/:guildId/appeals/settings',
	generalRateLimit,
	requireAdminPermissions,
	updateAppealSettings
);

// Appeals
router.get(
	'/guilds/:guildId/appeals',
	validatePagination,
	generalRateLimit,
	requireModerationPermissions,
	getAppeals
);

router.get(
	'/guilds/:guildId/appeals/:appealId',
	generalRateLimit,
	requireModerationPermissions,
	getAppeal
);

router.post(
	'/guilds/:guildId/appeals',
	validateAppeal,
	generalRateLimit,
	submitAppeal
);

router.post(
	'/guilds/:guildId/appeals/:appealId/review',
	generalRateLimit,
	requireModerationPermissions,
	reviewAppeal
);

// Statistics
router.get(
	'/guilds/:guildId/appeals/statistics',
	generalRateLimit,
	requireAdminPermissions,
	getAppealStatistics
);

export default router;
