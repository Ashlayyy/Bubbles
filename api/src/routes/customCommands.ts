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

router.use(authenticateToken, validateGuildAccess, requireAdminPermissions);

router.get(
	'/',
	validatePagination,
	guildCustomCommandsRateLimit,
	getCustomCommands
);

router.get('/statistics', guildCustomCommandsRateLimit, getCommandStatistics);

router.get('/:commandId', guildCustomCommandsRateLimit, getCustomCommand);

router.post(
	'/',
	validateCustomCommand,
	customCommandsRateLimit,
	createCustomCommand
);

router.put(
	'/:commandId',
	validateCustomCommand,
	customCommandsRateLimit,
	updateCustomCommand
);

router.delete('/:commandId', customCommandsRateLimit, deleteCustomCommand);

router.post(
	'/:commandId/execute',
	customCommandsRateLimit,
	executeCustomCommand
);

export default router;
