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
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router();

// All automation routes require authentication and guild access
router.use(
	'/guilds/:guildId/automation',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Automation rules
router.get(
	'/guilds/:guildId/automation/rules',
	validatePagination,
	automationRateLimit,
	requireAdminPermissions,
	getAutomationRules
);

router.post(
	'/guilds/:guildId/automation/rules',
	automationRateLimit,
	requireAdminPermissions,
	createAutomationRule
);

router.get(
	'/guilds/:guildId/automation/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	getAutomationRule
);

router.put(
	'/guilds/:guildId/automation/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	updateAutomationRule
);

router.delete(
	'/guilds/:guildId/automation/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	deleteAutomationRule
);

// Available triggers and actions
router.get(
	'/guilds/:guildId/automation/triggers',
	automationRateLimit,
	requireAdminPermissions,
	getAvailableTriggers
);

router.get(
	'/guilds/:guildId/automation/actions',
	automationRateLimit,
	requireAdminPermissions,
	getAvailableActions
);

export default router;
