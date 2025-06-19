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

const router = Router();

// ============================================================================
// GUILD AUDIT LOG OPERATIONS
// ============================================================================

// GET /api/audit/guilds/:guildId - Get guild audit log
router.get('/guilds/:guildId', authenticateToken, getGuildAuditLog);

// GET /api/audit/guilds/:guildId/analytics - Get audit log analytics
router.get(
	'/guilds/:guildId/analytics',
	authenticateToken,
	getAuditLogAnalytics
);

// GET /api/audit/guilds/:guildId/users/:userId - Get audit logs by user
router.get(
	'/guilds/:guildId/users/:userId',
	authenticateToken,
	getAuditLogsByUser
);

// GET /api/audit/guilds/:guildId/actions/:actionType - Get audit logs by action type
router.get(
	'/guilds/:guildId/actions/:actionType',
	authenticateToken,
	getAuditLogsByAction
);

// ============================================================================
// SECURITY & MONITORING
// ============================================================================

// GET /api/audit/guilds/:guildId/security - Get security alerts
router.get('/guilds/:guildId/security', authenticateToken, getSecurityAlerts);

// GET /api/audit/guilds/:guildId/moderation - Get moderation history
router.get(
	'/guilds/:guildId/moderation',
	authenticateToken,
	getModerationHistory
);

export default router;
