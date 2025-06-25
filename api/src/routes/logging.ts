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

router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

router.get('/settings', generalRateLimit, getLoggingSettings);

router.put(
	'/settings',
	validateLoggingSettings,
	configRateLimit,
	updateLoggingSettings
);

router.get('/audit', validatePagination, analyticsRateLimit, getAuditLogs);

router.post('/audit/export', analyticsRateLimit, exportAuditLogs);

router.get('/statistics', analyticsRateLimit, getLogStatistics);

export default router;
