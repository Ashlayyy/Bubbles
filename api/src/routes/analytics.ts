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

// All analytics routes require authentication and guild access
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Overview analytics
router.get(
	'/overview',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getAnalyticsOverview
);

// Member analytics
router.get(
	'/members',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMemberAnalytics
);

// Message analytics
router.get(
	'/messages',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMessageAnalytics
);

// Moderation analytics
router.get(
	'/moderation',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getModerationAnalytics
);

// Activity analytics
router.get(
	'/activity',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getActivityAnalytics
);

export default router;
