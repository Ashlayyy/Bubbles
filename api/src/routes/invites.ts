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

const router = Router({ mergeParams: true });


router.get('/', authenticateToken, getGuildInvites);

router.get('/analytics', authenticateToken, getInviteAnalytics);

router.post('/bulk-delete', authenticateToken, bulkDeleteInvites);

router.post('/purge-expired', authenticateToken, purgeExpiredInvites);


router.get('/:inviteCode', getInvite);

router.delete('/:inviteCode', authenticateToken, deleteInvite);


router.get('/channels/:channelId', authenticateToken, getChannelInvites);

router.post('/channels/:channelId', authenticateToken, createChannelInvite);

export default router;
