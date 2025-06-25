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

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

router.get(
	'/settings',
	generalRateLimit,
	requireAdminPermissions,
	getAppealSettings
);

router.put(
	'/settings',
	generalRateLimit,
	requireAdminPermissions,
	updateAppealSettings
);

router.get(
	'/',
	validatePagination,
	generalRateLimit,
	requireModerationPermissions,
	getAppeals
);

router.get(
	'/:appealId',
	generalRateLimit,
	requireModerationPermissions,
	getAppeal
);

router.post('/', validateAppeal, generalRateLimit, submitAppeal);

router.post(
	'/:appealId/review',
	generalRateLimit,
	requireModerationPermissions,
	reviewAppeal
);

router.get(
	'/statistics',
	generalRateLimit,
	requireAdminPermissions,
	getAppealStatistics
);

export default router;
