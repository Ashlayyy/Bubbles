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

const router = Router({ mergeParams: true });


router.get('/:channelId', authenticateToken, getChannel);

router.post('/', authenticateToken, createChannel);

router.patch('/:channelId', authenticateToken, modifyChannel);

router.delete('/:channelId', authenticateToken, deleteChannel);


router.put(
	'/:channelId/permissions/:overwriteId',
	authenticateToken,
	editChannelPermissions
);

router.delete(
	'/:channelId/permissions/:overwriteId',
	authenticateToken,
	deleteChannelPermission
);


router.get('/:channelId/invites', authenticateToken, getChannelInvites);

router.post('/:channelId/invites', authenticateToken, createChannelInvite);

export default router;
