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
	validateGuildId,
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

const router = Router();

// All moderation routes require authentication and guild access
router.use(
	'/guilds/:guildId/moderation',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Moderation cases
router.get(
	'/guilds/:guildId/moderation/cases',
	validatePagination,
	guildModerationRateLimit,
	requireModerationPermissions,
	getModerationCases
);

router.post(
	'/guilds/:guildId/moderation/cases',
	validateModerationCase,
	moderationRateLimit,
	requireModerationPermissions,
	createModerationCase
);

router.get(
	'/guilds/:guildId/moderation/cases/:caseId',
	guildModerationRateLimit,
	requireModerationPermissions,
	getModerationCase
);

router.put(
	'/guilds/:guildId/moderation/cases/:caseId',
	moderationRateLimit,
	requireModerationPermissions,
	updateModerationCase
);

router.delete(
	'/guilds/:guildId/moderation/cases/:caseId',
	moderationRateLimit,
	requireModerationPermissions,
	deleteModerationCase
);

// Bans
router.get(
	'/guilds/:guildId/moderation/bans',
	validatePagination,
	guildModerationRateLimit,
	requireModerationPermissions,
	getBannedUsers
);

router.post(
	'/guilds/:guildId/moderation/bans',
	moderationRateLimit,
	requireModerationPermissions,
	banUser
);

router.delete(
	'/guilds/:guildId/moderation/bans/:userId',
	validateUserId,
	moderationRateLimit,
	requireModerationPermissions,
	unbanUser
);

// Mutes/Timeouts
router.get(
	'/guilds/:guildId/moderation/mutes',
	validatePagination,
	guildModerationRateLimit,
	requireModerationPermissions,
	getMutedUsers
);

router.post(
	'/guilds/:guildId/moderation/mutes',
	moderationRateLimit,
	requireModerationPermissions,
	muteUser
);

router.delete(
	'/guilds/:guildId/moderation/mutes/:userId',
	validateUserId,
	moderationRateLimit,
	requireModerationPermissions,
	unmuteUser
);

// Warnings
router.get(
	'/guilds/:guildId/moderation/warnings',
	validatePagination,
	guildModerationRateLimit,
	requireModerationPermissions,
	getUserWarnings
);

router.post(
	'/guilds/:guildId/moderation/warnings',
	moderationRateLimit,
	requireModerationPermissions,
	addWarning
);

router.delete(
	'/guilds/:guildId/moderation/warnings/:warningId',
	moderationRateLimit,
	requireModerationPermissions,
	removeWarning
);

// Settings
router.get(
	'/guilds/:guildId/moderation/settings',
	guildModerationRateLimit,
	requireModerationPermissions,
	getModerationSettings
);

router.put(
	'/guilds/:guildId/moderation/settings',
	moderationRateLimit,
	requireModerationPermissions,
	updateModerationSettings
);

// Automod rules
router.get(
	'/guilds/:guildId/moderation/automod',
	guildModerationRateLimit,
	requireModerationPermissions,
	getAutomodRules
);

router.post(
	'/guilds/:guildId/moderation/automod',
	moderationRateLimit,
	requireModerationPermissions,
	createAutomodRule
);

router.put(
	'/guilds/:guildId/moderation/automod/:ruleId',
	moderationRateLimit,
	requireModerationPermissions,
	updateAutomodRule
);

router.delete(
	'/guilds/:guildId/moderation/automod/:ruleId',
	moderationRateLimit,
	requireModerationPermissions,
	deleteAutomodRule
);

// Moderator notes
router.get(
	'/guilds/:guildId/moderation/notes',
	validatePagination,
	guildModerationRateLimit,
	requireModerationPermissions,
	getModeratorNotes
);

router.post(
	'/guilds/:guildId/moderation/notes',
	moderationRateLimit,
	requireModerationPermissions,
	addModeratorNote
);

router.put(
	'/guilds/:guildId/moderation/notes/:noteId',
	moderationRateLimit,
	requireModerationPermissions,
	updateModeratorNote
);

router.delete(
	'/guilds/:guildId/moderation/notes/:noteId',
	moderationRateLimit,
	requireModerationPermissions,
	deleteModeratorNote
);

export default router;
