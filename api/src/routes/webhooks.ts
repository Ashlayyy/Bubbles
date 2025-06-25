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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

router.get(
	'/',
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhooks
);
router.get(
	'/statistics',
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhookStatistics
);
router.get(
	'/:webhookId',
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhook
);
router.get(
	'/:webhookId/logs',
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhookLogs
);
router.post(
	'/',
	validateWebhook,
	webhooksRateLimit,
	requireAdminPermissions,
	createWebhook
);
router.put(
	'/:webhookId',
	validateWebhook,
	webhooksRateLimit,
	requireAdminPermissions,
	updateWebhook
);
router.delete(
	'/:webhookId',
	webhooksRateLimit,
	requireAdminPermissions,
	deleteWebhook
);
router.post(
	'/:webhookId/test',
	webhooksRateLimit,
	requireAdminPermissions,
	testWebhook
);

router.post(
	'/bot/command',
	webhooksRateLimit,
	requireAdminPermissions,
	sendBotCommand
);
router.get(
	'/discord/events',
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getDiscordEventHistory
);
router.get(
	'/discord/stats',
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getDiscordEventStats
);

// Global endpoints
router.post('/discord/webhook', handleDiscordWebhook);
router.get(
	'/bot/shards',
	authenticateToken,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getShardStatus
);
router.get(
	'/websocket/stats',
	authenticateToken,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebSocketStats
);

export default router;
