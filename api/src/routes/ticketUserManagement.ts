import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermissions } from '../middleware/permissions.js';
import {
	getTicketUsers,
	addUserToTicket,
	updateUserPermissions,
	removeUserFromTicket,
	createAccessRequest,
	getAccessRequests,
	reviewAccessRequest,
	getTicketUserActivity,
	getPermissionPresets,
	createPermissionPreset,
	getSharingConfig,
	updateSharingConfig,
} from '../controllers/ticketUserManagementController.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all users in a ticket
router.get(
	'/guilds/:guildId/tickets/:ticketId/users',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketUsers
);

// Add a user to a ticket
router.post(
	'/guilds/:guildId/tickets/:ticketId/users',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	addUserToTicket
);

// Update user permissions in a ticket
router.put(
	'/guilds/:guildId/tickets/:ticketId/users/:userId/permissions',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	updateUserPermissions
);

// Remove a user from a ticket
router.delete(
	'/guilds/:guildId/tickets/:ticketId/users/:userId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	removeUserFromTicket
);

// Create an access request (public endpoint for users)
router.post(
	'/guilds/:guildId/tickets/:ticketId/access-requests',
	createAccessRequest
);

// Get access requests for a ticket
router.get(
	'/guilds/:guildId/tickets/:ticketId/access-requests',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getAccessRequests
);

// Review an access request
router.put(
	'/guilds/:guildId/tickets/:ticketId/access-requests/:requestId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	reviewAccessRequest
);

// Get ticket user activity
router.get(
	'/guilds/:guildId/tickets/:ticketId/user-activity',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketUserActivity
);

// Get permission presets
router.get(
	'/guilds/:guildId/ticket-permission-presets',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getPermissionPresets
);

// Create a permission preset
router.post(
	'/guilds/:guildId/ticket-permission-presets',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createPermissionPreset
);

// Get sharing configuration
router.get(
	'/guilds/:guildId/ticket-sharing-config',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getSharingConfig
);

// Update sharing configuration
router.put(
	'/guilds/:guildId/ticket-sharing-config',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	updateSharingConfig
);

export default router;
