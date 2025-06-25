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

const router = Router({ mergeParams: true });

router.use(authenticateToken);

// Guild channels list
router.get('/channels', getChannels);

// Send message to a channel (expects channelId in body)
router.post('/send', sendMessage);

// Channel message operations (require :channelId)
router.get('/:channelId', getMessages);
router.get('/:channelId/:messageId', getMessage);
router.patch('/:channelId/:messageId', editMessage);
router.delete('/:channelId/:messageId', deleteMessage);
router.post('/:channelId/bulk-delete', bulkDeleteMessages);

// Reactions
router.put('/:channelId/:messageId/reactions', addReaction);
router.delete('/:channelId/:messageId/reactions', removeReaction);
router.get('/:channelId/:messageId/reactions/:emoji', getReactions);
router.delete('/:channelId/:messageId/reactions/all', deleteAllReactions);

// Pinning
router.put('/:channelId/:messageId/pin', pinMessage);
router.delete('/:channelId/:messageId/pin', unpinMessage);
router.get('/:channelId/pins', getPinnedMessages);

// Threads
router.post('/:channelId/:messageId/threads', startThreadFromMessage);
router.post('/:channelId/threads', startThread);
router.put('/threads/:threadId/members/@me', joinThread);
router.delete('/threads/:threadId/members/@me', leaveThread);
router.put('/threads/:threadId/members/:userId', addThreadMember);
router.delete('/threads/:threadId/members/:userId', removeThreadMember);
router.get('/threads/:threadId/members', getThreadMembers);
router.get('/threads/active', getActiveThreads);
router.get('/:channelId/threads/archived', getArchivedThreads);

// Crosspost
router.post('/:channelId/:messageId/crosspost', crosspostMessage);

export default router;
