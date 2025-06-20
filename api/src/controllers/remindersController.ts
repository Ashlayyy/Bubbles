import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
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

		return res.json({
			success: true,
			data: {
				reminders,
				pagination: {
					page: parseInt(page as string),
					limit: take,
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reminders:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to fetch reminders',
			} as ApiResponse);
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
			return res
				.status(404)
				.json({ success: false, error: 'Reminder not found' } as ApiResponse);
		}

		return res.json({ success: true, data: reminder } as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to fetch reminder',
			} as ApiResponse);
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
			return res
				.status(400)
				.json({
					success: false,
					error: 'channelId, content and triggerAt are required',
				} as ApiResponse);
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

		return res
			.status(201)
			.json({
				success: true,
				message: 'Reminder created successfully',
				data: reminder,
			} as ApiResponse);
	} catch (error) {
		logger.error('Error creating reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to create reminder',
			} as ApiResponse);
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
			return res
				.status(404)
				.json({ success: false, error: 'Reminder not found' } as ApiResponse);
		}

		const updated = await prisma.reminder.update({
			where: { id: reminderId },
			data: { ...updates, updatedAt: new Date() },
		});

		return res.json({
			success: true,
			message: 'Reminder updated successfully',
			data: updated,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to update reminder',
			} as ApiResponse);
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
			return res
				.status(404)
				.json({ success: false, error: 'Reminder not found' } as ApiResponse);
		}

		await prisma.reminder.delete({ where: { id: reminderId } });
		return res.json({
			success: true,
			message: 'Reminder deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to delete reminder',
			} as ApiResponse);
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
			return res
				.status(404)
				.json({ success: false, error: 'Reminder not found' } as ApiResponse);
		}

		await prisma.reminder.update({
			where: { id: reminderId },
			data: { isActive: false },
		});
		return res.json({
			success: true,
			message: 'Reminder cancelled successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error cancelling reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to cancel reminder',
			} as ApiResponse);
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
			return res
				.status(404)
				.json({ success: false, error: 'Reminder not found' } as ApiResponse);
		}

		const result = await hybridCommunicationService.execute('SEND_MESSAGE', {
			channelId: reminder.channelId,
			content: reminder.content,
		});

		return res.json({
			success: true,
			data: { method: result.method },
			message: 'Test reminder sent',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error testing reminder:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to test reminder',
			} as ApiResponse);
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

		return res.json({
			success: true,
			data: {
				total,
				active,
				completed,
				cancelled,
				recurring,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching reminder statistics:', error);
		return res
			.status(500)
			.json({
				success: false,
				error: 'Failed to fetch reminder statistics',
			} as ApiResponse);
	}
};
