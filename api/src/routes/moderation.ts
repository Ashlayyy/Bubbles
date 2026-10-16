import { Router } from 'express';
import { addRoute } from '../utils/secureRoute.js';
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
	bulkBanUsers,
	bulkKickUsers,
	bulkTimeoutUsers,
	getBulkOperationStatus,
} from '../controllers/moderationController.js';
import {
	validateModerationCase,
	validatePagination,
	validateUserId,
} from '../middleware/validation.js';
import {
	moderationRateLimit,
	guildModerationRateLimit,
} from '../middleware/rateLimiting.js';

const router = Router({ mergeParams: true });

// Moderation cases
addRoute(
	router,
	'get',
	'/cases',
	{ discordPermissions: ['VIEW_AUDIT_LOG'], permissionsOverride: true },
	validatePagination,
	guildModerationRateLimit,
	getModerationCases
);

addRoute(
	router,
	'post',
	'/cases',
	{ discordPermissions: ['BAN_MEMBERS'], permissionsOverride: true },
	validateModerationCase,
	moderationRateLimit,
	createModerationCase
);

addRoute(
	router,
	'get',
	'/cases/:caseId',
	{ discordPermissions: ['VIEW_AUDIT_LOG'], permissionsOverride: true },
	guildModerationRateLimit,
	getModerationCase
);

addRoute(
	router,
	'put',
	'/cases/:caseId',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	updateModerationCase
);

addRoute(
	router,
	'delete',
	'/cases/:caseId',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	deleteModerationCase
);

// Bans
addRoute(
	router,
	'get',
	'/bans',
	{ discordPermissions: ['BAN_MEMBERS'], permissionsOverride: true },
	validatePagination,
	guildModerationRateLimit,
	getBannedUsers
);

addRoute(
	router,
	'post',
	'/bans',
	{ discordPermissions: ['BAN_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	banUser
);

addRoute(
	router,
	'delete',
	'/bans/:userId',
	{ discordPermissions: ['BAN_MEMBERS'], permissionsOverride: true },
	validateUserId,
	moderationRateLimit,
	unbanUser
);

// Mutes/Timeouts
addRoute(
	router,
	'get',
	'/mutes',
	{ discordPermissions: ['MODERATE_MEMBERS'], permissionsOverride: true },
	validatePagination,
	guildModerationRateLimit,
	getMutedUsers
);

addRoute(
	router,
	'post',
	'/mutes',
	{ discordPermissions: ['MODERATE_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	muteUser
);

addRoute(
	router,
	'delete',
	'/mutes/:userId',
	{ discordPermissions: ['MODERATE_MEMBERS'], permissionsOverride: true },
	validateUserId,
	moderationRateLimit,
	unmuteUser
);

// Warnings
addRoute(
	router,
	'get',
	'/warnings',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	validatePagination,
	guildModerationRateLimit,
	getUserWarnings
);

addRoute(
	router,
	'post',
	'/warnings',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	moderationRateLimit,
	addWarning
);

addRoute(
	router,
	'delete',
	'/warnings/:warningId',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	moderationRateLimit,
	removeWarning
);

// Settings
addRoute(
	router,
	'get',
	'/settings',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	guildModerationRateLimit,
	getModerationSettings
);

addRoute(
	router,
	'put',
	'/settings',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	updateModerationSettings
);

// Automod rules
addRoute(
	router,
	'get',
	'/automod',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	guildModerationRateLimit,
	getAutomodRules
);

addRoute(
	router,
	'post',
	'/automod',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	createAutomodRule
);

addRoute(
	router,
	'put',
	'/automod/:ruleId',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	updateAutomodRule
);

addRoute(
	router,
	'delete',
	'/automod/:ruleId',
	{ discordPermissions: ['MANAGE_GUILD'], permissionsOverride: true },
	moderationRateLimit,
	deleteAutomodRule
);

// Moderator notes
addRoute(
	router,
	'get',
	'/notes',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	validatePagination,
	guildModerationRateLimit,
	getModeratorNotes
);

addRoute(
	router,
	'post',
	'/notes',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	moderationRateLimit,
	addModeratorNote
);

addRoute(
	router,
	'put',
	'/notes/:noteId',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	moderationRateLimit,
	updateModeratorNote
);

addRoute(
	router,
	'delete',
	'/notes/:noteId',
	{ discordPermissions: ['MANAGE_MESSAGES'], permissionsOverride: true },
	moderationRateLimit,
	deleteModeratorNote
);

// Bulk operations
addRoute(
	router,
	'post',
	'/bulk/ban',
	{ discordPermissions: ['BAN_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	bulkBanUsers
);

addRoute(
	router,
	'post',
	'/bulk/kick',
	{ discordPermissions: ['KICK_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	bulkKickUsers
);

addRoute(
	router,
	'post',
	'/bulk/timeout',
	{ discordPermissions: ['MODERATE_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	bulkTimeoutUsers
);

addRoute(
	router,
	'get',
	'/bulk/status/:jobId',
	{ discordPermissions: ['MODERATE_MEMBERS'], permissionsOverride: true },
	moderationRateLimit,
	getBulkOperationStatus
);

export default router;
