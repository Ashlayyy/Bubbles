import { Router } from 'express';
import {
	getLoggingSettings,
	updateLoggingSettings,
	getAuditLogs,
	exportAuditLogs,
	getLogStatistics,
} from '../controllers/loggingController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
	validateLoggingSettings,
} from '../middleware/validation.js';
import {
	generalRateLimit,
	configRateLimit,
	analyticsRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All logging routes require authentication and guild access
router.use(
	'/guilds/:guildId/logging',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Logging settings
router.get(
	'/guilds/:guildId/logging/settings',
	generalRateLimit,
	requireAdminPermissions,
	getLoggingSettings
);

router.put(
	'/guilds/:guildId/logging/settings',
	validateLoggingSettings,
	configRateLimit,
	requireAdminPermissions,
	updateLoggingSettings
);

// Audit logs
router.get(
	'/guilds/:guildId/logging/audit',
	validatePagination,
	analyticsRateLimit,
	requireAdminPermissions,
	getAuditLogs
);

router.post(
	'/guilds/:guildId/logging/audit/export',
	analyticsRateLimit,
	requireAdminPermissions,
	exportAuditLogs
);

// Statistics
router.get(
	'/guilds/:guildId/logging/statistics',
	analyticsRateLimit,
	requireAdminPermissions,
	getLogStatistics
);

export default router;
