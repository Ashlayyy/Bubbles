import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermissions } from '../middleware/permissions.js';
import {
	getTicketTemplates,
	getTicketTemplate,
	createTicketTemplate,
	updateTicketTemplate,
	deleteTicketTemplate,
	useTicketTemplate,
	getTicketTypes,
	createTicketType,
	getTemplateStatistics,
} from '../controllers/ticketTemplatesController.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all ticket templates for a guild
router.get(
	'/guilds/:guildId/ticket-templates',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketTemplates
);

// Get a specific ticket template
router.get(
	'/guilds/:guildId/ticket-templates/:templateId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketTemplate
);

// Create a new ticket template
router.post(
	'/guilds/:guildId/ticket-templates',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createTicketTemplate
);

// Update a ticket template
router.put(
	'/guilds/:guildId/ticket-templates/:templateId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	updateTicketTemplate
);

// Delete a ticket template
router.delete(
	'/guilds/:guildId/ticket-templates/:templateId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	deleteTicketTemplate
);

// Use a template to create a ticket (public endpoint)
router.post(
	'/guilds/:guildId/ticket-templates/:templateId/use',
	useTicketTemplate
);

// Get template statistics
router.get(
	'/guilds/:guildId/ticket-templates/:templateId/statistics',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTemplateStatistics
);

// Get all ticket types for a guild
router.get(
	'/guilds/:guildId/ticket-types',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketTypes
);

// Create a new ticket type
router.post(
	'/guilds/:guildId/ticket-types',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createTicketType
);

export default router;
