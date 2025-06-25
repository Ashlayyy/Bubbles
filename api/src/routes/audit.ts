import { Router } from 'express';
import {
	getGuildAuditLog,
	getAuditLogAnalytics,
	getAuditLogsByUser,
	getAuditLogsByAction,
	getSecurityAlerts,
	getModerationHistory,
} from '../controllers/auditController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken);

router.get('/', getGuildAuditLog);
router.get('/analytics', getAuditLogAnalytics);
router.get('/users/:userId', getAuditLogsByUser);
router.get('/actions/:actionType', getAuditLogsByAction);
router.get('/security', getSecurityAlerts);
router.get('/moderation', getModerationHistory);

export default router;
