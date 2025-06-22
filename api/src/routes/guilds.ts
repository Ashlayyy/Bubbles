import { Router } from 'express';
import {
	getGuilds as getUserGuilds,
	getGuild as getGuildInfo,
	getGuildChannels,
	getGuildRoles,
	getGuildMembers,
	getGuildSettings as getServerSettings,
	updateGuildSettings as updateServerSettings,
} from '../controllers/guildController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import {
	generalRateLimit,
	guildAnalyticsRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// Base /guilds route
router.get('/', authenticateToken, generalRateLimit, getUserGuilds);

// Guild-specific routes (all require guild access validation)
const guildRouter = Router({ mergeParams: true });
router.use('/:guildId', validateGuildId, validateGuildAccess, guildRouter);

guildRouter.get('/', authenticateToken, generalRateLimit, getGuildInfo);

// TODO: Implement getDashboardStats function
// router.get(
// 	'/dashboard',
// 	authenticateToken,
// 	guildAnalyticsRateLimit,
// 	getDashboardStats
// );

guildRouter.get(
	'/channels',
	authenticateToken,
	generalRateLimit,
	getGuildChannels
);
guildRouter.get('/roles', authenticateToken, generalRateLimit, getGuildRoles);
guildRouter.get(
	'/members',
	authenticateToken,
	validatePagination,
	generalRateLimit,
	getGuildMembers
);

// TODO: Implement getGuildEmojis function
// router.get(
// 	'/emojis',
// 	authenticateToken,
// 	generalRateLimit,
// 	getGuildEmojis
// );

// Server settings
guildRouter.get(
	'/settings',
	authenticateToken,
	requireAdminPermissions,
	getServerSettings
);

guildRouter.put(
	'/settings',
	authenticateToken,
	requireAdminPermissions,
	updateServerSettings
);

// TODO: Implement backup/restore functions
// router.get(
// 	'/settings/backup',
// 	authenticateToken,
// 	requireAdminPermissions,
// 	createSettingsBackup
// );

// router.post(
// 	'/settings/restore',
// 	authenticateToken,
// 	requireAdminPermissions,
// 	restoreFromBackup
// );

export default router;
