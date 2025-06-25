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

router.get('/', authenticateToken, generalRateLimit, getUserGuilds);

const guildRouter = Router({ mergeParams: true });
router.use('/:guildId', validateGuildId, validateGuildAccess, guildRouter);

guildRouter.get('/', authenticateToken, generalRateLimit, getGuildInfo);


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



export default router;
