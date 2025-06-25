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
	validateGuildAccess,
	validateLevelingSettings,
	validatePagination,
	validateUserId,
} from '../middleware/validation.js';
import {
	levelingRateLimit,
	guildLevelingRateLimit,
} from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildLevelingRateLimit,
	getLevelingSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateLevelingSettings,
	levelingRateLimit,
	updateLevelingSettings
);

router.get(
	'/leaderboard',
	validatePagination,
	guildLevelingRateLimit,
	getLeaderboard
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildLevelingRateLimit,
	getLevelingStatistics
);

const userRouter = Router({ mergeParams: true });
router.use('/users/:userId', validateUserId, userRouter);

userRouter.get('/', guildLevelingRateLimit, getUserLevel);
addRoute(
	userRouter,
	'put',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	levelingRateLimit,
	setUserLevel
);

const rewardsRouter = Router({ mergeParams: true });
router.use('/rewards', rewardsRouter);

addRoute(
	rewardsRouter,
	'get',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildLevelingRateLimit,
	getLevelRewards
);
addRoute(
	rewardsRouter,
	'post',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	levelingRateLimit,
	addLevelReward
);
addRoute(
	rewardsRouter,
	'delete',
	'/:rewardId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	levelingRateLimit,
	removeLevelReward
);

export default router;
