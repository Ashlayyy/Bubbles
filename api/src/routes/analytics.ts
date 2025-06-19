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

const router = Router();

// All analytics routes require authentication and guild access
router.use(
	'/guilds/:guildId/analytics',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Overview analytics
router.get(
	'/guilds/:guildId/analytics/overview',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getAnalyticsOverview
);

// Member analytics
router.get(
	'/guilds/:guildId/analytics/members',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMemberAnalytics
);

// Message analytics
router.get(
	'/guilds/:guildId/analytics/messages',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getMessageAnalytics
);

// Moderation analytics
router.get(
	'/guilds/:guildId/analytics/moderation',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getModerationAnalytics
);

// Activity analytics
router.get(
	'/guilds/:guildId/analytics/activity',
	guildAnalyticsRateLimit,
	requireAdminPermissions,
	getActivityAnalytics
);

export default router;
