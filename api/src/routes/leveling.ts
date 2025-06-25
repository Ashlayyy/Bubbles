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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

router.get(
	'/settings',
	guildLevelingRateLimit,
	requireAdminPermissions,
	getLevelingSettings
);

router.put(
	'/settings',
	validateLevelingSettings,
	levelingRateLimit,
	requireAdminPermissions,
	updateLevelingSettings
);

router.get(
	'/leaderboard',
	validatePagination,
	guildLevelingRateLimit,
	getLeaderboard
);

router.get(
	'/statistics',
	guildLevelingRateLimit,
	requireAdminPermissions,
	getLevelingStatistics
);

const userRouter = Router({ mergeParams: true });
router.use('/users/:userId', validateUserId, userRouter);

userRouter.get('/', guildLevelingRateLimit, getUserLevel);
userRouter.put('/', levelingRateLimit, requireAdminPermissions, setUserLevel);

const rewardsRouter = Router({ mergeParams: true });
router.use('/rewards', requireAdminPermissions, rewardsRouter);

rewardsRouter.get('/', guildLevelingRateLimit, getLevelRewards);
rewardsRouter.post('/', levelingRateLimit, addLevelReward);
rewardsRouter.delete('/:rewardId', levelingRateLimit, removeLevelReward);

export default router;
