import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
	getAnalyticsOverview,
	getMemberAnalytics,
	getMessageAnalytics,
	getModerationAnalytics,
	getActivityAnalytics,
} from '../controllers/analyticsController.js';
import {
	validateGuildId,
	validateGuildAccess,
} from '../middleware/validation.js';
import { guildAnalyticsRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

// Common validation for all analytics routes
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Overview
addRoute(
	router,
	'get',
	'/overview',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildAnalyticsRateLimit,
	getAnalyticsOverview
);

// Members
addRoute(
	router,
	'get',
	'/members',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildAnalyticsRateLimit,
	getMemberAnalytics
);

// Messages
addRoute(
	router,
	'get',
	'/messages',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildAnalyticsRateLimit,
	getMessageAnalytics
);

// Moderation
addRoute(
	router,
	'get',
	'/moderation',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildAnalyticsRateLimit,
	getModerationAnalytics
);

// Activity
addRoute(
	router,
	'get',
	'/activity',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildAnalyticsRateLimit,
	getActivityAnalytics
);

export default router;
