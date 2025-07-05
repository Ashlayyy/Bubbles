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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

const writePerm = {
	discordPermissions: ['MANAGE_MESSAGES'],
	permissionsOverride: true,
};

addRoute(router, 'get', '/channels', {}, getChannels);

addRoute(router, 'post', '/send', writePerm, sendMessage);

addRoute(router, 'get', '/:channelId', {}, getMessages);
addRoute(router, 'get', '/:channelId/:messageId', {}, getMessage);
addRoute(router, 'patch', '/:channelId/:messageId', writePerm, editMessage);
addRoute(router, 'delete', '/:channelId/:messageId', writePerm, deleteMessage);
addRoute(
	router,
	'post',
	'/:channelId/bulk-delete',
	writePerm,
	bulkDeleteMessages
);

addRoute(router, 'put', '/:channelId/:messageId/reactions', {}, addReaction);
addRoute(
	router,
	'delete',
	'/:channelId/:messageId/reactions',
	{},
	removeReaction
);
addRoute(
	router,
	'get',
	'/:channelId/:messageId/reactions/:emoji',
	{},
	getReactions
);
addRoute(
	router,
	'delete',
	'/:channelId/:messageId/reactions/all',
	writePerm,
	deleteAllReactions
);

addRoute(router, 'put', '/:channelId/:messageId/pin', writePerm, pinMessage);
addRoute(
	router,
	'delete',
	'/:channelId/:messageId/pin',
	writePerm,
	unpinMessage
);
addRoute(router, 'get', '/:channelId/pins', {}, getPinnedMessages);

addRoute(
	router,
	'post',
	'/:channelId/:messageId/threads',
	writePerm,
	startThreadFromMessage
);
addRoute(router, 'post', '/:channelId/threads', writePerm, startThread);
addRoute(router, 'put', '/threads/:threadId/members/@me', {}, joinThread);
addRoute(router, 'delete', '/threads/:threadId/members/@me', {}, leaveThread);
addRoute(
	router,
	'put',
	'/threads/:threadId/members/:userId',
	writePerm,
	addThreadMember
);
addRoute(
	router,
	'delete',
	'/threads/:threadId/members/:userId',
	writePerm,
	removeThreadMember
);
addRoute(router, 'get', '/threads/:threadId/members', {}, getThreadMembers);
addRoute(router, 'get', '/threads/active', {}, getActiveThreads);
addRoute(router, 'get', '/:channelId/threads/archived', {}, getArchivedThreads);

addRoute(
	router,
	'post',
	'/:channelId/:messageId/crosspost',
	writePerm,
	crosspostMessage
);

export default router;
