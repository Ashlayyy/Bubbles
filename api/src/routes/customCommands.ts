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
	validateGuildAccess,
	validateCustomCommand,
	validatePagination,
} from '../middleware/validation.js';
import {
	customCommandsRateLimit,
	guildCustomCommandsRateLimit,
} from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All custom commands routes require authentication and admin permissions
router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

// Get all custom commands
router.get(
	'/',
	validatePagination,
	guildCustomCommandsRateLimit,
	getCustomCommands
);

// Get command statistics
router.get('/statistics', guildCustomCommandsRateLimit, getCommandStatistics);

// Get single custom command
router.get('/:commandId', guildCustomCommandsRateLimit, getCustomCommand);

// Create custom command
router.post(
	'/',
	validateCustomCommand,
	customCommandsRateLimit,
	createCustomCommand
);

// Update custom command
router.put(
	'/:commandId',
	validateCustomCommand,
	customCommandsRateLimit,
	updateCustomCommand
);

// Delete custom command
router.delete('/:commandId', customCommandsRateLimit, deleteCustomCommand);

// Execute custom command (for testing)
router.post(
	'/:commandId/execute',
	customCommandsRateLimit,
	executeCustomCommand
);

export default router;
