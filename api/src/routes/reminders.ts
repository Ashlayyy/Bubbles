import { Router } from 'express';
import {
	getReminders,
	getReminder,
	createReminder,
	updateReminder,
	deleteReminder,
	cancelReminder,
	testReminder,
	getReminderStatistics,
} from '../controllers/remindersController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
	validateGuildId,
	validateGuildAccess,
	validateReminder,
	validatePagination,
} from '../middleware/validation.js';
import { generalRateLimit } from '../middleware/rateLimiting.js';
import { requireAdminPermissions } from '../middleware/permissions.js';

const router = Router({ mergeParams: true });

// All reminder routes require authentication and guild access
router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// Reminders
router.get(
	'/',
	validatePagination,
	generalRateLimit,
	requireAdminPermissions,
	getReminders
);

router.get(
	'/:reminderId',
	generalRateLimit,
	requireAdminPermissions,
	getReminder
);

router.post(
	'/',
	validateReminder,
	generalRateLimit,
	requireAdminPermissions,
	createReminder
);

router.put(
	'/:reminderId',
	validateReminder,
	generalRateLimit,
	requireAdminPermissions,
	updateReminder
);

router.delete(
	'/:reminderId',
	generalRateLimit,
	requireAdminPermissions,
	deleteReminder
);

router.post(
	'/:reminderId/cancel',
	generalRateLimit,
	requireAdminPermissions,
	cancelReminder
);

router.post(
	'/:reminderId/test',
	generalRateLimit,
	requireAdminPermissions,
	testReminder
);

// Statistics
router.get(
	'/statistics',
	generalRateLimit,
	requireAdminPermissions,
	getReminderStatistics
);

export default router;
