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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

// ── api/src/routes/audit.ts ──

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
} from '../middleware/validation.js';

const router = express.Router();

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// …rest of your audit log endpoints…
export default router;

const auditPerm = {
	discordPermissions: ['VIEW_AUDIT_LOG'],
	permissionsOverride: true,
};

addRoute(router, 'get', '/', auditPerm, getGuildAuditLog);
addRoute(router, 'get', '/analytics', auditPerm, getAuditLogAnalytics);
addRoute(router, 'get', '/users/:userId', auditPerm, getAuditLogsByUser);
addRoute(
	router,
	'get',
	'/actions/:actionType',
	auditPerm,
	getAuditLogsByAction
);
addRoute(router, 'get', '/security', auditPerm, getSecurityAlerts);
addRoute(router, 'get', '/moderation', auditPerm, getModerationHistory);

export default router;
