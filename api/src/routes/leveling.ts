import { Router } from 'express';
import {
	getLevelingSettings,
	updateLevelingSettings,
	getLeaderboard,
	getUserLevel,
	setUserLevel,
	getLevelRewards,
	addLevelReward,
	removeLevelReward,
	getLevelingStatistics,
} from '../controllers/levelingController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateLevelingSettings,
	validatePagination,
	validateUserId,
} from '../middleware/validation.js';
import {
	levelingRateLimit,
	guildLevelingRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All leveling routes require authentication and guild access
router.use(
	'/guilds/:guildId/leveling',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Get leveling settings
router.get(
	'/guilds/:guildId/leveling/settings',
	guildLevelingRateLimit,
	requireAdminPermissions,
	getLevelingSettings
);

// Update leveling settings
router.put(
	'/guilds/:guildId/leveling/settings',
	validateLevelingSettings,
	levelingRateLimit,
	requireAdminPermissions,
	updateLevelingSettings
);

// Get leaderboard
router.get(
	'/guilds/:guildId/leveling/leaderboard',
	validatePagination,
	guildLevelingRateLimit,
	getLeaderboard
);

// Get leveling statistics
router.get(
	'/guilds/:guildId/leveling/statistics',
	guildLevelingRateLimit,
	requireAdminPermissions,
	getLevelingStatistics
);

// Get user level info
router.get(
	'/guilds/:guildId/leveling/users/:userId',
	validateUserId,
	guildLevelingRateLimit,
	getUserLevel
);

// Set user level/XP (admin only)
router.put(
	'/guilds/:guildId/leveling/users/:userId',
	validateUserId,
	levelingRateLimit,
	requireAdminPermissions,
	setUserLevel
);

// Get level rewards
router.get(
	'/guilds/:guildId/leveling/rewards',
	guildLevelingRateLimit,
	requireAdminPermissions,
	getLevelRewards
);

// Add level reward
router.post(
	'/guilds/:guildId/leveling/rewards',
	levelingRateLimit,
	requireAdminPermissions,
	addLevelReward
);

// Remove level reward
router.delete(
	'/guilds/:guildId/leveling/rewards/:rewardId',
	levelingRateLimit,
	requireAdminPermissions,
	removeLevelReward
);

export default router;
