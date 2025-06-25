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
	validateGuildAccess,
	validatePagination,
	validateLoggingSettings,
} from '../middleware/validation.js';
import {
	generalRateLimit,
	configRateLimit,
	analyticsRateLimit,
} from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

// Settings
addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getLoggingSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateLoggingSettings,
	configRateLimit,
	updateLoggingSettings
);

// Audit logs
addRoute(
	router,
	'get',
	'/audit',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	analyticsRateLimit,
	getAuditLogs
);

addRoute(
	router,
	'post',
	'/audit/export',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	analyticsRateLimit,
	exportAuditLogs
);

// Statistics
addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	analyticsRateLimit,
	getLogStatistics
);

export default router;
