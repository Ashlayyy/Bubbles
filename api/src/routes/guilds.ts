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
import { addRoute } from '../utils/secureRoute.js';

const router = Router();

router.get('/', authenticateToken, generalRateLimit, getUserGuilds);

const guildRouter = Router({ mergeParams: true });
router.use(
	'/:guildId',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	guildRouter
);

guildRouter.get('/', authenticateToken, generalRateLimit, getGuildInfo);

guildRouter.get(
	'/channels',
	generalRateLimit,
	getGuildChannels
);
guildRouter.get('/roles', generalRateLimit, getGuildRoles);
guildRouter.get(
	'/members',
	validatePagination,
	generalRateLimit,
	getGuildMembers
);

addRoute(
	guildRouter,
	'get',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	authenticateToken,
	getServerSettings
);

addRoute(
	guildRouter,
	'put',
	'/settings',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	authenticateToken,
	updateServerSettings
);

export default router;
