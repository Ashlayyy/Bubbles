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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

const manageGuildPerm = {
	discordPermissions: ['MANAGE_GUILD'],
	permissionsOverride: true,
};

addRoute(
	router,
	'get',
	'/',
	manageGuildPerm,
	authenticateToken,
	getGuildInvites
);
addRoute(
	router,
	'get',
	'/analytics',
	manageGuildPerm,
	authenticateToken,
	getInviteAnalytics
);
addRoute(
	router,
	'post',
	'/bulk-delete',
	manageGuildPerm,
	authenticateToken,
	bulkDeleteInvites
);
addRoute(
	router,
	'post',
	'/purge-expired',
	manageGuildPerm,
	authenticateToken,
	purgeExpiredInvites
);

// Public invite info (no auth)
addRoute(
	router,
	'get',
	'/:inviteCode',
	{ authRequired: false, tokenRequired: false, permissionsOverride: true },
	getInvite
);

addRoute(
	router,
	'delete',
	'/:inviteCode',
	manageGuildPerm,
	authenticateToken,
	deleteInvite
);

addRoute(
	router,
	'get',
	'/channels/:channelId',
	manageGuildPerm,
	authenticateToken,
	getChannelInvites
);
addRoute(
	router,
	'post',
	'/channels/:channelId',
	manageGuildPerm,
	authenticateToken,
	createChannelInvite
);

export default router;
