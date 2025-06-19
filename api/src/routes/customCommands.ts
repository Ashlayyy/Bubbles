import { Router } from 'express';
import {
	getCustomCommands,
	getCustomCommand,
	createCustomCommand,
	updateCustomCommand,
	deleteCustomCommand,
	executeCustomCommand,
	getCommandStatistics,
} from '../controllers/customCommandsController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateCustomCommand,
	validatePagination,
} from '../middleware/validation.js';
import {
	customCommandsRateLimit,
	guildCustomCommandsRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All custom commands routes require authentication and guild access
router.use(
	'/guilds/:guildId/custom-commands',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Get all custom commands
router.get(
	'/guilds/:guildId/custom-commands',
	validatePagination,
	guildCustomCommandsRateLimit,
	requireAdminPermissions,
	getCustomCommands
);

// Get command statistics
router.get(
	'/guilds/:guildId/custom-commands/statistics',
	guildCustomCommandsRateLimit,
	requireAdminPermissions,
	getCommandStatistics
);

// Get single custom command
router.get(
	'/guilds/:guildId/custom-commands/:commandId',
	guildCustomCommandsRateLimit,
	requireAdminPermissions,
	getCustomCommand
);

// Create custom command
router.post(
	'/guilds/:guildId/custom-commands',
	validateCustomCommand,
	customCommandsRateLimit,
	requireAdminPermissions,
	createCustomCommand
);

// Update custom command
router.put(
	'/guilds/:guildId/custom-commands/:commandId',
	validateCustomCommand,
	customCommandsRateLimit,
	requireAdminPermissions,
	updateCustomCommand
);

// Delete custom command
router.delete(
	'/guilds/:guildId/custom-commands/:commandId',
	customCommandsRateLimit,
	requireAdminPermissions,
	deleteCustomCommand
);

// Execute custom command (for testing)
router.post(
	'/guilds/:guildId/custom-commands/:commandId/execute',
	customCommandsRateLimit,
	requireAdminPermissions,
	executeCustomCommand
);

export default router;
