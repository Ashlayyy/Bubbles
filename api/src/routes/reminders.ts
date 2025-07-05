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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

router.use('/', validateGuildId, authenticateToken, validateGuildAccess);

// List reminders
addRoute(
	router,
	'get',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validatePagination,
	generalRateLimit,
	getReminders
);

// Single reminder
addRoute(
	router,
	'get',
	'/:reminderId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getReminder
);

// Create reminder
addRoute(
	router,
	'post',
	'/',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateReminder,
	generalRateLimit,
	createReminder
);

// Update
addRoute(
	router,
	'put',
	'/:reminderId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	validateReminder,
	generalRateLimit,
	updateReminder
);

// Delete
addRoute(
	router,
	'delete',
	'/:reminderId',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	deleteReminder
);

// Cancel
addRoute(
	router,
	'post',
	'/:reminderId/cancel',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	cancelReminder
);

// Test
addRoute(
	router,
	'post',
	'/:reminderId/test',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	testReminder
);

// Stats
addRoute(
	router,
	'get',
	'/statistics',
	{ discordPermissions: ['ADMINISTRATOR'], permissionsOverride: true },
	generalRateLimit,
	getReminderStatistics
);

export default router;
