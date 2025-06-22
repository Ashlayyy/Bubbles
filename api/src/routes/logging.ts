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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All logging routes require authentication and admin permissions
router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

// Logging settings
router.get('/settings', generalRateLimit, getLoggingSettings);

router.put(
	'/settings',
	validateLoggingSettings,
	configRateLimit,
	updateLoggingSettings
);

// Audit logs
router.get('/audit', validatePagination, analyticsRateLimit, getAuditLogs);

router.post('/audit/export', analyticsRateLimit, exportAuditLogs);

// Statistics
router.get('/statistics', analyticsRateLimit, getLogStatistics);

export default router;
