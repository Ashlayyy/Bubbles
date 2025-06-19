import { Router } from 'express';
import {
	getChannel,
	createChannel,
	modifyChannel,
	deleteChannel,
	editChannelPermissions,
	deleteChannelPermission,
	getChannelInvites,
	createChannelInvite,
} from '../controllers/channelController.js';
import { authenticateToken } from '../middleware/auth.js';
// Validation is handled at the controller level

const router = Router();

// ============================================================================
// CHANNEL OPERATIONS
// ============================================================================

// GET /api/channels/:channelId - Get channel information
router.get('/:channelId', authenticateToken, getChannel);

// POST /api/channels/guilds/:guildId - Create a new channel in guild
router.post('/guilds/:guildId', authenticateToken, createChannel);

// PATCH /api/channels/:channelId - Modify channel
router.patch('/:channelId', authenticateToken, modifyChannel);

// DELETE /api/channels/:channelId - Delete channel
router.delete('/:channelId', authenticateToken, deleteChannel);

// ============================================================================
// CHANNEL PERMISSIONS
// ============================================================================

// PUT /api/channels/:channelId/permissions/:overwriteId - Edit channel permissions
router.put(
	'/:channelId/permissions/:overwriteId',
	authenticateToken,
	editChannelPermissions
);

// DELETE /api/channels/:channelId/permissions/:overwriteId - Delete channel permission
router.delete(
	'/:channelId/permissions/:overwriteId',
	authenticateToken,
	deleteChannelPermission
);

// ============================================================================
// CHANNEL INVITES
// ============================================================================

// GET /api/channels/:channelId/invites - Get channel invites
router.get('/:channelId/invites', authenticateToken, getChannelInvites);

// POST /api/channels/:channelId/invites - Create channel invite
router.post('/:channelId/invites', authenticateToken, createChannelInvite);

export default router;
