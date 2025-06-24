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

const router = Router({ mergeParams: true });

// All automation routes require authentication and guild access
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Automation rules
router.get(
	'/rules',
	validatePagination,
	automationRateLimit,
	requireAdminPermissions,
	getAutomationRules
);

router.post(
	'/rules',
	automationRateLimit,
	requireAdminPermissions,
	createAutomationRule
);

router.get(
	'/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	getAutomationRule
);

router.put(
	'/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	updateAutomationRule
);

router.delete(
	'/rules/:ruleId',
	automationRateLimit,
	requireAdminPermissions,
	deleteAutomationRule
);

// Available triggers and actions
router.get(
	'/triggers',
	automationRateLimit,
	requireAdminPermissions,
	getAvailableTriggers
);

router.get(
	'/actions',
	automationRateLimit,
	requireAdminPermissions,
	getAvailableActions
);

export default router;
