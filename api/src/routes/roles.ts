import { Router } from 'express';
import {
	getRoles,
	getRole,
	createRole,
	updateRole,
	deleteRole,
	assignRole,
	removeRole,
	getAutoRoleSettings,
	getRoleLogs,
	getRoleStatistics,
} from '../controllers/roleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// ============================================================================
// ROLE OPERATIONS
// ============================================================================

// GET /api/roles/guilds/:guildId - Get all roles in a guild
router.get('/guilds/:guildId', authenticateToken, getRoles);

// GET /api/roles/guilds/:guildId/roles/:roleId - Get specific role
router.get('/guilds/:guildId/roles/:roleId', authenticateToken, getRole);

// POST /api/roles/guilds/:guildId - Create new role in guild
router.post('/guilds/:guildId', authenticateToken, createRole);

// PATCH /api/roles/guilds/:guildId/roles/:roleId - Update role
router.patch('/guilds/:guildId/roles/:roleId', authenticateToken, updateRole);

// DELETE /api/roles/guilds/:guildId/roles/:roleId - Delete role
router.delete('/guilds/:guildId/roles/:roleId', authenticateToken, deleteRole);

// ============================================================================
// MEMBER ROLE OPERATIONS
// ============================================================================

// POST /api/roles/guilds/:guildId/roles/:roleId/assign - Assign role to user
router.post(
	'/guilds/:guildId/roles/:roleId/assign',
	authenticateToken,
	assignRole
);

// POST /api/roles/guilds/:guildId/roles/:roleId/remove - Remove role from user
router.post(
	'/guilds/:guildId/roles/:roleId/remove',
	authenticateToken,
	removeRole
);

// ============================================================================
// ROLE SETTINGS & LOGS
// ============================================================================

// GET /api/roles/guilds/:guildId/auto-role - Get auto-role settings
router.get(
	'/guilds/:guildId/auto-role',
	authenticateToken,
	getAutoRoleSettings
);

// GET /api/roles/guilds/:guildId/logs - Get role logs
router.get('/guilds/:guildId/logs', authenticateToken, getRoleLogs);

// GET /api/roles/guilds/:guildId/statistics - Get role statistics
router.get('/guilds/:guildId/statistics', authenticateToken, getRoleStatistics);

export default router;
