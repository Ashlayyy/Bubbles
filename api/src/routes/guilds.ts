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

// User guilds
router.get(
	'/users/@me/guilds',
	authenticateToken,
	generalRateLimit,
	getUserGuilds
);

// Guild-specific routes (all require guild access validation)
router.use('/guilds/:guildId', validateGuildId, validateGuildAccess);

router.get(
	'/guilds/:guildId',
	authenticateToken,
	generalRateLimit,
	getGuildInfo
);

// TODO: Implement getDashboardStats function
// router.get(
// 	'/guilds/:guildId/dashboard',
// 	authenticateToken,
// 	guildAnalyticsRateLimit,
// 	getDashboardStats
// );

router.get(
	'/guilds/:guildId/channels',
	authenticateToken,
	generalRateLimit,
	getGuildChannels
);
router.get(
	'/guilds/:guildId/roles',
	authenticateToken,
	generalRateLimit,
	getGuildRoles
);
router.get(
	'/guilds/:guildId/members',
	authenticateToken,
	validatePagination,
	generalRateLimit,
	getGuildMembers
);

// TODO: Implement getGuildEmojis function
// router.get(
// 	'/guilds/:guildId/emojis',
// 	authenticateToken,
// 	generalRateLimit,
// 	getGuildEmojis
// );

// Server settings
router.get(
	'/guilds/:guildId/settings',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	generalRateLimit,
	requireAdminPermissions,
	getServerSettings
);

router.put(
	'/guilds/:guildId/settings',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	generalRateLimit,
	requireAdminPermissions,
	updateServerSettings
);

// TODO: Implement backup/restore functions
// router.get(
// 	'/guilds/:guildId/settings/backup',
// 	validateGuildId,
// 	authenticateToken,
// 	validateGuildAccess,
// 	generalRateLimit,
// 	requireAdminPermissions,
// 	createSettingsBackup
// );

// router.post(
// 	'/guilds/:guildId/settings/restore',
// 	validateGuildId,
// 	authenticateToken,
// 	validateGuildAccess,
// 	generalRateLimit,
// 	requireAdminPermissions,
// 	restoreFromBackup
// );

export default router;
