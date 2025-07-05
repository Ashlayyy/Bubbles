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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

const channelPerm = {
	discordPermissions: ['MANAGE_CHANNELS'],
	permissionsOverride: true,
};

addRoute(
	router,
	'get',
	'/:channelId',
	channelPerm,
	authenticateToken,
	getChannel
);
addRoute(router, 'post', '/', channelPerm, authenticateToken, createChannel);
addRoute(
	router,
	'patch',
	'/:channelId',
	channelPerm,
	authenticateToken,
	modifyChannel
);
addRoute(
	router,
	'delete',
	'/:channelId',
	channelPerm,
	authenticateToken,
	deleteChannel
);

addRoute(
	router,
	'put',
	'/:channelId/permissions/:overwriteId',
	channelPerm,
	authenticateToken,
	editChannelPermissions
);
addRoute(
	router,
	'delete',
	'/:channelId/permissions/:overwriteId',
	channelPerm,
	authenticateToken,
	deleteChannelPermission
);

addRoute(
	router,
	'get',
	'/:channelId/invites',
	channelPerm,
	authenticateToken,
	getChannelInvites
);
addRoute(
	router,
	'post',
	'/:channelId/invites',
	channelPerm,
	authenticateToken,
	createChannelInvite
);

export default router;
