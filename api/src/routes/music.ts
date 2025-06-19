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

const router = Router();

// All music routes require authentication and guild access
router.use(
	'/guilds/:guildId/music',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Music player status
router.get('/guilds/:guildId/music/status', generalRateLimit, getMusicStatus);

// Music playback controls
router.post(
	'/guilds/:guildId/music/play',
	validateMusicAction,
	generalRateLimit,
	requireMusicPermissions,
	playMusic
);

router.post(
	'/guilds/:guildId/music/pause',
	generalRateLimit,
	requireMusicPermissions,
	pauseMusic
);

router.post(
	'/guilds/:guildId/music/resume',
	generalRateLimit,
	requireMusicPermissions,
	resumeMusic
);

router.post(
	'/guilds/:guildId/music/skip',
	generalRateLimit,
	requireMusicPermissions,
	skipTrack
);

router.post(
	'/guilds/:guildId/music/stop',
	generalRateLimit,
	requireMusicPermissions,
	stopMusic
);

// Queue management
router.get('/guilds/:guildId/music/queue', generalRateLimit, getQueue);

router.delete(
	'/guilds/:guildId/music/queue',
	generalRateLimit,
	requireMusicPermissions,
	clearQueue
);

router.post(
	'/guilds/:guildId/music/queue/shuffle',
	generalRateLimit,
	requireMusicPermissions,
	shuffleQueue
);

// Player controls
router.put(
	'/guilds/:guildId/music/volume',
	generalRateLimit,
	requireMusicPermissions,
	setVolume
);

router.put(
	'/guilds/:guildId/music/repeat',
	generalRateLimit,
	requireMusicPermissions,
	setRepeatMode
);

// Settings
router.get(
	'/guilds/:guildId/music/settings',
	generalRateLimit,
	getMusicSettings
);

router.put(
	'/guilds/:guildId/music/settings',
	configRateLimit,
	requireMusicPermissions,
	updateMusicSettings
);

export default router;
