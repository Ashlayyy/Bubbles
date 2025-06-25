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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateGuildAccess);

addRoute(
	router,
	'get',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	guildCustomCommandsRateLimit,
	getCustomCommands
);

addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildCustomCommandsRateLimit,
	getCommandStatistics
);

addRoute(
	router,
	'get',
	'/:commandId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	guildCustomCommandsRateLimit,
	getCustomCommand
);

addRoute(
	router,
	'post',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateCustomCommand,
	customCommandsRateLimit,
	createCustomCommand
);

addRoute(
	router,
	'put',
	'/:commandId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateCustomCommand,
	customCommandsRateLimit,
	updateCustomCommand
);

addRoute(
	router,
	'delete',
	'/:commandId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	customCommandsRateLimit,
	deleteCustomCommand
);

addRoute(
	router,
	'post',
	'/:commandId/execute',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	customCommandsRateLimit,
	executeCustomCommand
);

export default router;
