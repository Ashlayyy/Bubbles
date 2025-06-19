import { Router } from 'express';
import {
	sendMessage,
	getChannels,
	getMessages,
	getMessage,
	editMessage,
	deleteMessage,
	bulkDeleteMessages,
	addReaction,
	removeReaction,
	getReactions,
	deleteAllReactions,
	pinMessage,
	unpinMessage,
	getPinnedMessages,
	startThreadFromMessage,
	startThread,
	joinThread,
	leaveThread,
	addThreadMember,
	removeThreadMember,
	getThreadMembers,
	getActiveThreads,
	getArchivedThreads,
	crosspostMessage,
} from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';
// Validation is handled at the controller level

const router = Router();

// ============================================================================
// CHANNEL OPERATIONS
// ============================================================================

// GET /api/messages/channels/:guildId - Get channels for a guild
router.get('/channels/:guildId', authenticateToken, getChannels);

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

// POST /api/messages/send - Send a message to a channel
router.post('/send', authenticateToken, sendMessage);

// GET /api/messages/:channelId - Get messages from a channel
router.get('/:channelId', authenticateToken, getMessages);

// GET /api/messages/:channelId/:messageId - Get a specific message
router.get('/:channelId/:messageId', authenticateToken, getMessage);

// PATCH /api/messages/:channelId/:messageId - Edit a message
router.patch('/:channelId/:messageId', authenticateToken, editMessage);

// DELETE /api/messages/:channelId/:messageId - Delete a message
router.delete('/:channelId/:messageId', authenticateToken, deleteMessage);

// POST /api/messages/:channelId/bulk-delete - Bulk delete messages
router.post('/:channelId/bulk-delete', authenticateToken, bulkDeleteMessages);

// ============================================================================
// REACTION OPERATIONS
// ============================================================================

// PUT /api/messages/:channelId/:messageId/reactions - Add reaction
router.put('/:channelId/:messageId/reactions', authenticateToken, addReaction);

// DELETE /api/messages/:channelId/:messageId/reactions - Remove reaction
router.delete(
	'/:channelId/:messageId/reactions',
	authenticateToken,
	removeReaction
);

// GET /api/messages/:channelId/:messageId/reactions/:emoji - Get reaction users
router.get(
	'/:channelId/:messageId/reactions/:emoji',
	authenticateToken,
	getReactions
);

// DELETE /api/messages/:channelId/:messageId/reactions/all - Delete all reactions
router.delete(
	'/:channelId/:messageId/reactions/all',
	authenticateToken,
	deleteAllReactions
);

// ============================================================================
// PIN OPERATIONS
// ============================================================================

// PUT /api/messages/:channelId/:messageId/pin - Pin a message
router.put('/:channelId/:messageId/pin', authenticateToken, pinMessage);

// DELETE /api/messages/:channelId/:messageId/pin - Unpin a message
router.delete('/:channelId/:messageId/pin', authenticateToken, unpinMessage);

// GET /api/messages/:channelId/pins - Get pinned messages
router.get('/:channelId/pins', authenticateToken, getPinnedMessages);

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

// POST /api/messages/:channelId/:messageId/threads - Start thread from message
router.post(
	'/:channelId/:messageId/threads',
	authenticateToken,
	startThreadFromMessage
);

// POST /api/messages/:channelId/threads - Start thread in channel
router.post('/:channelId/threads', authenticateToken, startThread);

// PUT /api/messages/threads/:threadId/members/@me - Join thread
router.put('/threads/:threadId/members/@me', authenticateToken, joinThread);

// DELETE /api/messages/threads/:threadId/members/@me - Leave thread
router.delete('/threads/:threadId/members/@me', authenticateToken, leaveThread);

// PUT /api/messages/threads/:threadId/members/:userId - Add user to thread
router.put(
	'/threads/:threadId/members/:userId',
	authenticateToken,
	addThreadMember
);

// DELETE /api/messages/threads/:threadId/members/:userId - Remove user from thread
router.delete(
	'/threads/:threadId/members/:userId',
	authenticateToken,
	removeThreadMember
);

// GET /api/messages/threads/:threadId/members - Get thread members
router.get('/threads/:threadId/members', authenticateToken, getThreadMembers);

// GET /api/messages/guilds/:guildId/threads/active - Get active threads
router.get(
	'/guilds/:guildId/threads/active',
	authenticateToken,
	getActiveThreads
);

// GET /api/messages/:channelId/threads/archived - Get archived threads
router.get(
	'/:channelId/threads/archived',
	authenticateToken,
	getArchivedThreads
);

// ============================================================================
// CROSSPOST OPERATIONS
// ============================================================================

// POST /api/messages/:channelId/:messageId/crosspost - Crosspost message
router.post(
	'/:channelId/:messageId/crosspost',
	authenticateToken,
	crosspostMessage
);

export default router;
