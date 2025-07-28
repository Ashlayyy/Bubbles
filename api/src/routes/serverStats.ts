import { Router } from 'express';
import {
	getServerStats,
	getHistoricalStats,
	getGrowthAnalytics,
	getActivityMetrics,
	createStatsSnapshot,
	getServerLeaderboards,
} from '../controllers/serverStatsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateGuildAccess } from '../middleware/validation.js';
import { analyticsRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

// Current server statistics
addRoute(
	router,
	'get',
	'/current',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	analyticsRateLimit,
	getServerStats
);

// Historical statistics
addRoute(
	router,
	'get',
	'/historical',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	analyticsRateLimit,
	getHistoricalStats
);

// Growth analytics
addRoute(
	router,
	'get',
	'/growth',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	analyticsRateLimit,
	getGrowthAnalytics
);

// Activity metrics
addRoute(
	router,
	'get',
	'/activity',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	analyticsRateLimit,
	getActivityMetrics
);

// Server leaderboards
addRoute(
	router,
	'get',
	'/leaderboards',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	analyticsRateLimit,
	getServerLeaderboards
);

// Create stats snapshot (typically called by bot)
addRoute(
	router,
	'post',
	'/snapshot',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	analyticsRateLimit,
	createStatsSnapshot
);

export default router;
