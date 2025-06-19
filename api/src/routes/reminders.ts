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

const router = Router();

// All reminder routes require authentication and guild access
router.use(
	'/guilds/:guildId/reminders',
	validateGuildId,
	authenticateToken,
	validateGuildAccess
);

// Reminders
router.get(
	'/guilds/:guildId/reminders',
	validatePagination,
	generalRateLimit,
	requireAdminPermissions,
	getReminders
);

router.get(
	'/guilds/:guildId/reminders/:reminderId',
	generalRateLimit,
	requireAdminPermissions,
	getReminder
);

router.post(
	'/guilds/:guildId/reminders',
	validateReminder,
	generalRateLimit,
	requireAdminPermissions,
	createReminder
);

router.put(
	'/guilds/:guildId/reminders/:reminderId',
	validateReminder,
	generalRateLimit,
	requireAdminPermissions,
	updateReminder
);

router.delete(
	'/guilds/:guildId/reminders/:reminderId',
	generalRateLimit,
	requireAdminPermissions,
	deleteReminder
);

router.post(
	'/guilds/:guildId/reminders/:reminderId/cancel',
	generalRateLimit,
	requireAdminPermissions,
	cancelReminder
);

router.post(
	'/guilds/:guildId/reminders/:reminderId/test',
	generalRateLimit,
	requireAdminPermissions,
	testReminder
);

// Statistics
router.get(
	'/guilds/:guildId/reminders/statistics',
	generalRateLimit,
	requireAdminPermissions,
	getReminderStatistics
);

export default router;
