import { Router } from 'express';
import {
	getInvite,
	deleteInvite,
	getGuildInvites,
	createChannelInvite,
	getChannelInvites,
	getInviteAnalytics,
	bulkDeleteInvites,
	purgeExpiredInvites,
} from '../controllers/inviteController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// ============================================================================
// GLOBAL INVITE OPERATIONS
// ============================================================================

// GET /api/invites/:inviteCode - Get invite information
router.get('/:inviteCode', getInvite);

// DELETE /api/invites/:inviteCode - Delete invite
router.delete('/:inviteCode', authenticateToken, deleteInvite);

// ============================================================================
// GUILD INVITE OPERATIONS
// ============================================================================

// GET /api/invites/guilds/:guildId - Get all guild invites
router.get('/guilds/:guildId', authenticateToken, getGuildInvites);

// GET /api/invites/guilds/:guildId/analytics - Get invite analytics
router.get('/guilds/:guildId/analytics', authenticateToken, getInviteAnalytics);

// POST /api/invites/guilds/:guildId/bulk-delete - Bulk delete invites
router.post(
	'/guilds/:guildId/bulk-delete',
	authenticateToken,
	bulkDeleteInvites
);

// POST /api/invites/guilds/:guildId/purge-expired - Purge expired invites
router.post(
	'/guilds/:guildId/purge-expired',
	authenticateToken,
	purgeExpiredInvites
);

// ============================================================================
// CHANNEL INVITE OPERATIONS
// ============================================================================

// GET /api/invites/channels/:channelId - Get channel invites
router.get('/channels/:channelId', authenticateToken, getChannelInvites);

// POST /api/invites/channels/:channelId - Create channel invite
router.post('/channels/:channelId', authenticateToken, createChannelInvite);

export default router;
