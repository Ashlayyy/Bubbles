import { Router } from 'express';
import {
	getAnalyticsOverview,
	getMemberAnalytics,
	getMessageAnalytics,
	getModerationAnalytics,
	getActivityAnalytics,
} from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import {
	analyticsRateLimit,
	guildAnalyticsRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

router.get(
	'/overview',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getAnalyticsOverview
);

router.get(
	'/members',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMemberAnalytics
);

router.get(
	'/messages',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMessageAnalytics
);

router.get(
	'/moderation',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getModerationAnalytics
);

router.get(
	'/activity',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getActivityAnalytics
);

export default router;
