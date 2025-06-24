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

const router = Router({ mergeParams: true });

// All music routes require authentication and guild access
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Music player status
router.get('/status', generalRateLimit, getMusicStatus);

// Music playback controls
router.post(
	'/play',
	validateMusicAction,
	generalRateLimit,
	requireMusicPermissions,
	playMusic
);

router.post('/pause', generalRateLimit, requireMusicPermissions, pauseMusic);

router.post('/resume', generalRateLimit, requireMusicPermissions, resumeMusic);

router.post('/skip', generalRateLimit, requireMusicPermissions, skipTrack);

router.post('/stop', generalRateLimit, requireMusicPermissions, stopMusic);

// Queue management
router.get('/queue', generalRateLimit, getQueue);

router.delete('/queue', generalRateLimit, requireMusicPermissions, clearQueue);

router.post(
	'/queue/shuffle',
	generalRateLimit,
	requireMusicPermissions,
	shuffleQueue
);

// Player controls
router.put('/volume', generalRateLimit, requireMusicPermissions, setVolume);

router.put('/repeat', generalRateLimit, requireMusicPermissions, setRepeatMode);

// Settings
router.get('/settings', generalRateLimit, getMusicSettings);

router.put(
	'/settings',
	configRateLimit,
	requireMusicPermissions,
	updateMusicSettings
);

export default router;
