import { Router } from 'express';
import {
	getWebhooks,
	getWebhook,
	createWebhook,
	updateWebhook,
	deleteWebhook,
	testWebhook,
	getWebhookLogs,
	getWebhookStatistics,
	handleDiscordWebhook,
	sendBotCommand,
	getDiscordEventHistory,
	getDiscordEventStats,
	getShardStatus,
	getWebSocketStats,
} from '../controllers/webhooksController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateWebhook,
	validatePagination,
} from '../middleware/validation.js';
import {
	webhooksRateLimit,
	guildWebhooksRateLimit,
} from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildWebhooksRateLimit,
	getWebhooks
);
addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildWebhooksRateLimit,
	getWebhookStatistics
);
addRoute(
	router,
	'get',
	'/:webhookId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildWebhooksRateLimit,
	getWebhook
);
addRoute(
	router,
	'get',
	'/:webhookId/logs',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildWebhooksRateLimit,
	getWebhookLogs
);
addRoute(
	router,
	'post',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateWebhook,
	webhooksRateLimit,
	createWebhook
);
addRoute(
	router,
	'put',
	'/:webhookId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateWebhook,
	webhooksRateLimit,
	updateWebhook
);
addRoute(
	router,
	'delete',
	'/:webhookId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	webhooksRateLimit,
	deleteWebhook
);
addRoute(
	router,
	'post',
	'/:webhookId/test',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	webhooksRateLimit,
	testWebhook
);

addRoute(
	router,
	'post',
	'/bot/command',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	webhooksRateLimit,
	sendBotCommand
);
addRoute(
	router,
	'get',
	'/discord/events',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildWebhooksRateLimit,
	getDiscordEventHistory
);
addRoute(
	router,
	'get',
	'/discord/stats',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildWebhooksRateLimit,
	getDiscordEventStats
);

// Global endpoints
router.post('/discord/webhook', handleDiscordWebhook);
addRoute(
	router,
	'get',
	'/bot/shards',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildWebhooksRateLimit,
	getShardStatus
);
addRoute(
	router,
	'get',
	'/websocket/stats',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildWebhooksRateLimit,
	getWebSocketStats
);

export default router;
