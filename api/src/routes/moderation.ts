import { Router } from 'express';
import {
	getModerationCases,
	createModerationCase,
	getModerationCase,
	updateModerationCase,
	deleteModerationCase,
	getBannedUsers,
	banUser,
	unbanUser,
	getMutedUsers,
	muteUser,
	unmuteUser,
	getUserWarnings,
	addWarning,
	removeWarning,
	getModerationSettings,
	updateModerationSettings,
	getAutomodRules,
	createAutomodRule,
	updateAutomodRule,
	deleteAutomodRule,
	getModeratorNotes,
	addModeratorNote,
	updateModeratorNote,
	deleteModeratorNote,
} from '../controllers/moderationController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildAccess,
	validateModerationCase,
	validatePagination,
	validateUserId,
} from '../middleware/validation.js';
import {
	moderationRateLimit,
	guildModerationRateLimit,
} from '../middleware/rateLimiting.js';
import { requireModerationPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All moderation routes require authentication and guild access
router.use(
	authenticateToken,
	validateGuildAccess,
	requireModerationPermissions
);

// Moderation cases
router.get(
	'/cases',
	validatePagination,
	guildModerationRateLimit,
	getModerationCases
);

router.post(
	'/cases',
	validateModerationCase,
	moderationRateLimit,
	createModerationCase
);

router.get('/cases/:caseId', guildModerationRateLimit, getModerationCase);

router.put('/cases/:caseId', moderationRateLimit, updateModerationCase);

router.delete('/cases/:caseId', moderationRateLimit, deleteModerationCase);

// Bans
router.get(
	'/bans',
	validatePagination,
	guildModerationRateLimit,
	getBannedUsers
);

router.post('/bans', moderationRateLimit, banUser);

router.delete('/bans/:userId', validateUserId, moderationRateLimit, unbanUser);

// Mutes/Timeouts
router.get(
	'/mutes',
	validatePagination,
	guildModerationRateLimit,
	getMutedUsers
);

router.post('/mutes', moderationRateLimit, muteUser);

router.delete(
	'/mutes/:userId',
	validateUserId,
	moderationRateLimit,
	unmuteUser
);

// Warnings
router.get(
	'/warnings',
	validatePagination,
	guildModerationRateLimit,
	getUserWarnings
);

router.post('/warnings', moderationRateLimit, addWarning);

router.delete('/warnings/:warningId', moderationRateLimit, removeWarning);

// Settings
router.get('/settings', guildModerationRateLimit, getModerationSettings);

router.put('/settings', moderationRateLimit, updateModerationSettings);

// Automod rules
router.get('/automod', guildModerationRateLimit, getAutomodRules);

router.post('/automod', moderationRateLimit, createAutomodRule);

router.put('/automod/:ruleId', moderationRateLimit, updateAutomodRule);

router.delete('/automod/:ruleId', moderationRateLimit, deleteAutomodRule);

// Moderator notes
router.get(
	'/notes',
	validatePagination,
	guildModerationRateLimit,
	getModeratorNotes
);

router.post('/notes', moderationRateLimit, addModeratorNote);

router.put('/notes/:noteId', moderationRateLimit, updateModeratorNote);

router.delete('/notes/:noteId', moderationRateLimit, deleteModeratorNote);

export default router;
