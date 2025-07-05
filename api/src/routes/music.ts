import { Router } from 'express';
import {
	getMusicStatus,
	playMusic,
	pauseMusic,
	resumeMusic,
	skipTrack,
	stopMusic,
	getQueue,
	clearQueue,
	shuffleQueue,
	setVolume,
	setRepeatMode,
	getMusicSettings,
	updateMusicSettings,
} from '../controllers/musicController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateMusicAction,
} from '../middleware/validation.js';
import {
	generalRateLimit,
	configRateLimit,
} from '../middleware/rateLimiting.js';
import { requireMusicPermissions } from '../middleware/permissions.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

addRoute(router, 'get', '/status', {}, generalRateLimit, getMusicStatus);

addRoute(
	router,
	'post',
	'/play',
	{},
	validateMusicAction,
	generalRateLimit,
	requireMusicPermissions,
	playMusic
);

addRoute(
	router,
	'post',
	'/pause',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	pauseMusic
);

addRoute(
	router,
	'post',
	'/resume',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	resumeMusic
);

addRoute(
	router,
	'post',
	'/skip',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	skipTrack
);

addRoute(
	router,
	'post',
	'/stop',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	stopMusic
);

addRoute(router, 'get', '/queue', { permissionsOverride: true }, getQueue);

addRoute(
	router,
	'delete',
	'/queue',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	clearQueue
);

addRoute(
	router,
	'post',
	'/queue/shuffle',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	shuffleQueue
);

addRoute(
	router,
	'put',
	'/volume',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	setVolume
);

addRoute(
	router,
	'put',
	'/repeat',
	{ permissionsOverride: true },
	generalRateLimit,
	requireMusicPermissions,
	setRepeatMode
);

addRoute(
	router,
	'get',
	'/settings',
	{ permissionsOverride: true },
	generalRateLimit,
	getMusicSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ permissionsOverride: true },
	configRateLimit,
	requireMusicPermissions,
	updateMusicSettings
);

export default router;
