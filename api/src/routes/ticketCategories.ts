import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermissions } from '../middleware/permissions.js';
import {
	getTicketCategories,
	getTicketCategory,
	createTicketCategory,
	updateTicketCategory,
	deleteTicketCategory,
	createCategoryWorkflow,
	createCategoryField,
	getCategoryStatistics,
	executeWorkflow,
} from '../controllers/ticketCategoriesController.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all ticket categories for a guild
router.get(
	'/guilds/:guildId/ticket-categories',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketCategories
);

// Get a specific ticket category
router.get(
	'/guilds/:guildId/ticket-categories/:categoryId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getTicketCategory
);

// Create a new ticket category
router.post(
	'/guilds/:guildId/ticket-categories',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createTicketCategory
);

// Update a ticket category
router.put(
	'/guilds/:guildId/ticket-categories/:categoryId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	updateTicketCategory
);

// Delete a ticket category
router.delete(
	'/guilds/:guildId/ticket-categories/:categoryId',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	deleteTicketCategory
);

// Create a workflow for a category
router.post(
	'/guilds/:guildId/ticket-categories/:categoryId/workflows',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createCategoryWorkflow
);

// Create a custom field for a category
router.post(
	'/guilds/:guildId/ticket-categories/:categoryId/fields',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	createCategoryField
);

// Get category statistics
router.get(
	'/guilds/:guildId/ticket-categories/:categoryId/statistics',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	getCategoryStatistics
);

// Execute a workflow for a ticket
router.post(
	'/guilds/:guildId/ticket-categories/:categoryId/workflows/:workflowId/execute',
	requirePermissions(['MANAGE_GUILD', 'MANAGE_CHANNELS']),
	executeWorkflow
);

export default router;
