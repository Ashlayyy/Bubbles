import { Router } from 'express';
import {
	getAutomationRules,
	createAutomationRule,
	getAutomationRule,
	updateAutomationRule,
	deleteAutomationRule,
	getAvailableTriggers,
	getAvailableActions,
} from '../controllers/automationController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validatePagination,
} from '../middleware/validation.js';
import { automationRateLimit } from '../middleware/rateLimiting.js';
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

// Common validation for all automation routes
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// List automation rules
addRoute(
	router,
	'get',
	'/rules',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	automationRateLimit,
	getAutomationRules
);

// Create rule
addRoute(
	router,
	'post',
	'/rules',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	createAutomationRule
);

// Get single rule
addRoute(
	router,
	'get',
	'/rules/:ruleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	getAutomationRule
);

// Update rule
addRoute(
	router,
	'put',
	'/rules/:ruleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	updateAutomationRule
);

// Delete rule
addRoute(
	router,
	'delete',
	'/rules/:ruleId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	deleteAutomationRule
);

// Available triggers
addRoute(
	router,
	'get',
	'/triggers',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	getAvailableTriggers
);

// Available actions
addRoute(
	router,
	'get',
	'/actions',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	automationRateLimit,
	getAvailableActions
);

export default router;
