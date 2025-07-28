import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
	createReminder,
	getReminders,
	getReminder,
	updateReminder,
	deleteReminder,
	completeReminder,
	getReminderStatistics,
} from '../controllers/reminderController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create a reminder
router.post('/:guildId', createReminder);

// Get reminders
router.get('/:guildId', getReminders);

// Get reminder statistics
router.get('/:guildId/statistics', getReminderStatistics);

// Get single reminder
router.get('/:guildId/:reminderId', getReminder);

// Update reminder
router.put('/:guildId/:reminderId', updateReminder);

// Delete reminder
router.delete('/:guildId/:reminderId', deleteReminder);

// Complete reminder
router.patch('/:guildId/:reminderId/complete', completeReminder);

export default router;
