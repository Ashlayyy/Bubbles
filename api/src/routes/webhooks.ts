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

const router = Router();

// All webhooks routes require authentication and guild access
router.use(
	'/guilds/:guildId/webhooks',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Get all webhooks
router.get(
	'/guilds/:guildId/webhooks',
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhooks
);

// Get webhook statistics
router.get(
	'/guilds/:guildId/webhooks/statistics',
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhookStatistics
);

// Get single webhook
router.get(
	'/guilds/:guildId/webhooks/:webhookId',
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhook
);

// Get webhook logs
router.get(
	'/guilds/:guildId/webhooks/:webhookId/logs',
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebhookLogs
);

// Create webhook
router.post(
	'/guilds/:guildId/webhooks',
	validateWebhook,
	webhooksRateLimit,
	requireAdminPermissions,
	createWebhook
);

// Update webhook
router.put(
	'/guilds/:guildId/webhooks/:webhookId',
	validateWebhook,
	webhooksRateLimit,
	requireAdminPermissions,
	updateWebhook
);

// Delete webhook
router.delete(
	'/guilds/:guildId/webhooks/:webhookId',
	webhooksRateLimit,
	requireAdminPermissions,
	deleteWebhook
);

// Test webhook
router.post(
	'/guilds/:guildId/webhooks/:webhookId/test',
	webhooksRateLimit,
	requireAdminPermissions,
	testWebhook
);

// === Discord Bot Webhook Routes ===

// Handle Discord webhook events from bot instances (no auth required for bot webhooks)
router.post('/discord/webhook', handleDiscordWebhook);

// Send command to bot instances
router.post(
	'/guilds/:guildId/bot/command',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	webhooksRateLimit,
	requireAdminPermissions,
	sendBotCommand
);

// Get Discord event history
router.get(
	'/guilds/:guildId/discord/events',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	validatePagination,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getDiscordEventHistory
);

// Get Discord event statistics
router.get(
	'/guilds/:guildId/discord/stats',
	validateGuildId,
	authenticateToken,
	validateGuildAccess,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getDiscordEventStats
);

// Get shard status (global endpoint)
router.get(
	'/bot/shards',
	authenticateToken,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getShardStatus
);

// Get WebSocket connection statistics (global endpoint)
router.get(
	'/websocket/stats',
	authenticateToken,
	guildWebhooksRateLimit,
	requireAdminPermissions,
	getWebSocketStats
);

export default router;
