import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import hybridCommunicationService from '../services/hybridCommunicationService.js';

const logger = createLogger('reminders-controller');

// Get all reminders
export const getReminders = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, status, userId, channelId } = req.query;
		const prisma = getPrismaClient();

		const where: any = { guildId };
		if (status) where.status = status as string;
		if (userId) where.userId = userId as string;
		if (channelId) where.channelId = channelId as string;

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		const [reminders, total] = await Promise.all([
			prisma.reminder.findMany({
				where,
				orderBy: { reminderTime: 'asc' },
				skip,
				take,
			}),
			prisma.reminder.count({ where }),
		]);

		return res.success({
			reminders,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching reminders:', error);
		return res.failure('Failed to fetch reminders', 500);
	}
};

// Get single reminder
export const getReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		const reminder = await prisma.reminder.findFirst({
			where: { id: reminderId, guildId },
			include: { logs: { orderBy: { executedAt: 'desc' } } },
		});

		if (!reminder) {
			return res.failure('Reminder not found', 404);
		}

		return res.success(reminder);
	} catch (error) {
		logger.error('Error fetching reminder:', error);
		return res.failure('Failed to fetch reminder', 500);
	}
};

// Create reminder
export const createReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const { channelId, content, triggerAt, recurring, mentions } = req.body;

		// basic validation
		if (!channelId || !content || !triggerAt) {
			return res.failure('channelId, content and triggerAt are required', 400);
		}

		const reminder = await prisma.reminder.create({
			data: {
				guildId,
				userId: req.user?.id || 'unknown',
				channelId,
				content,
				reminderTime: new Date(triggerAt),
				isRecurring: !!recurring,
				recurring: recurring || undefined,
				mentions: mentions || {},
			},
		});

		// Schedule via queue manager (best-effort)
		try {
			await hybridCommunicationService.schedule(
				'SEND_MESSAGE',
				{
					channelId,
					content,
					mentions: mentions || {},
				},
				new Date(triggerAt).getTime() - Date.now(),
				{ guildId }
			);
		} catch (schedErr) {
			logger.warn('Failed to schedule reminder job:', schedErr);
		}

		return res.success(reminder, 201);
	} catch (error) {
		logger.error('Error creating reminder:', error);
		return res.failure('Failed to create reminder', 500);
	}
};

// Update reminder
export const updateReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();
		const updates = req.body;

		const existing = await prisma.reminder.findFirst({
			where: { id: reminderId, guildId },
		});
		if (!existing) {
			return res.failure('Reminder not found', 404);
		}

		const updated = await prisma.reminder.update({
			where: { id: reminderId },
			data: { ...updates, updatedAt: new Date() },
		});

		return res.success(updated);
	} catch (error) {
		logger.error('Error updating reminder:', error);
		return res.failure('Failed to update reminder', 500);
	}
};

// Delete reminder
export const deleteReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		const existing = await prisma.reminder.findFirst({
			where: { id: reminderId, guildId },
		});
		if (!existing) {
			return res.failure('Reminder not found', 404);
		}

		await prisma.reminder.delete({ where: { id: reminderId } });
		return res.success({ message: 'Reminder deleted successfully' });
	} catch (error) {
		logger.error('Error deleting reminder:', error);
		return res.failure('Failed to delete reminder', 500);
	}
};

// Cancel reminder (set inactive)
export const cancelReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		const existing = await prisma.reminder.findFirst({
			where: { id: reminderId, guildId },
		});
		if (!existing) {
			return res.failure('Reminder not found', 404);
		}

		await prisma.reminder.update({
			where: { id: reminderId },
			data: { isActive: false },
		});
		return res.success({ message: 'Reminder cancelled successfully' });
	} catch (error) {
		logger.error('Error cancelling reminder:', error);
		return res.failure('Failed to cancel reminder', 500);
	}
};

// Test reminder (send immediately)
export const testReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		const reminder = await prisma.reminder.findFirst({
			where: { id: reminderId, guildId },
		});
		if (!reminder) {
			return res.failure('Reminder not found', 404);
		}

		const result = await hybridCommunicationService.execute('SEND_MESSAGE', {
			channelId: reminder.channelId,
			content: reminder.content,
		});

		return res.success({ method: result.method });
	} catch (error) {
		logger.error('Error testing reminder:', error);
		return res.failure('Failed to test reminder', 500);
	}
};

// Statistics
export const getReminderStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const [total, active, completed, cancelled, recurring] = await Promise.all([
			prisma.reminder.count({ where: { guildId } }),
			prisma.reminder.count({ where: { guildId, isActive: true } }),
			prisma.reminder.count({ where: { guildId, isExecuted: true } }),
			prisma.reminder.count({ where: { guildId, isActive: false } }),
			prisma.reminder.count({ where: { guildId, isRecurring: true } }),
		]);

		return res.success({
			total,
			active,
			completed,
			cancelled,
			recurring,
		});
	} catch (error) {
		logger.error('Error fetching reminder statistics:', error);
		return res.failure('Failed to fetch reminder statistics', 500);
	}
};
