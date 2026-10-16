import { Request, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';
import { createConsoleLogger } from '@bubbles/shared';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createConsoleLogger('reminder-controller');

// Helper function to create WebSocket message
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'SYSTEM',
		event: event,
		data,
		timestamp: Date.now(),
		messageId: generateId(),
	};
}

// Helper function to generate ID
function generateId(): string {
	return Math.random().toString(36).substr(2, 9);
}

// Validation schemas
const createReminderSchema = z.object({
	title: z.string().min(1).max(100),
	description: z.string().max(1000).optional(),
	remindAt: z.string().datetime(),
	recurring: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
	channelId: z.string().optional(),
	userId: z.string(),
	isPrivate: z.boolean().default(false),
	priority: z.enum(['low', 'medium', 'high']).default('medium'),
	tags: z.array(z.string()).optional(),
});

const updateReminderSchema = z.object({
	title: z.string().min(1).max(100).optional(),
	description: z.string().max(1000).optional(),
	remindAt: z.string().datetime().optional(),
	recurring: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
	channelId: z.string().optional(),
	isPrivate: z.boolean().optional(),
	priority: z.enum(['low', 'medium', 'high']).optional(),
	tags: z.array(z.string()).optional(),
	status: z.enum(['pending', 'completed', 'cancelled']).optional(),
});

const reminderQuerySchema = z.object({
	page: z.coerce.number().min(1).default(1),
	limit: z.coerce.number().min(1).max(100).default(20),
	status: z.enum(['pending', 'completed', 'cancelled']).optional(),
	priority: z.enum(['low', 'medium', 'high']).optional(),
	userId: z.string().optional(),
	recurring: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
	search: z.string().optional(),
	upcoming: z.coerce.boolean().optional(),
	overdue: z.coerce.boolean().optional(),
});

// Create a reminder
export const createReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const validation = createReminderSchema.safeParse(req.body);

		if (!validation.success) {
			return res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
		}

		const data = validation.data;

		// Create reminder
		const reminder = await prisma.reminderAdvanced.create({
			data: {
				guildId,
				userId: data.userId,
				title: data.title,
				description: data.description,
				remindAt: new Date(data.remindAt),
				recurring: data.recurring,
				channelId: data.channelId,
				isPrivate: data.isPrivate,
				priority: data.priority,
				tags: data.tags || [],
				status: 'pending',
				createdBy: req.user?.id || 'system',
			},
		});

		// Broadcast reminder creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('reminderCreated', {
				reminder,
				createdBy: req.user?.id,
			})
		);

		logger.info(`Created reminder: ${reminder.id}`, {
			guildId,
			userId: data.userId,
			title: data.title,
		});

		res.json({
			success: true,
			data: reminder,
		});
	} catch (error) {
		logger.error('Error creating reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create reminder',
		});
	}
};

// Get reminders
export const getReminders = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const validation = reminderQuerySchema.safeParse(req.query);

		if (!validation.success) {
			return res.status(400).json({
				success: false,
				error: 'Invalid query parameters',
				details: validation.error.issues,
			});
		}

		const {
			page,
			limit,
			status,
			priority,
			userId,
			recurring,
			search,
			upcoming,
			overdue,
		} = validation.data;

		const offset = (page - 1) * limit;

		// Build where clause
		const whereClause: any = {
			guildId,
		};

		if (status) {
			whereClause.status = status;
		}

		if (priority) {
			whereClause.priority = priority;
		}

		if (userId) {
			whereClause.userId = userId;
		}

		if (recurring) {
			whereClause.recurring = recurring;
		}

		if (search) {
			whereClause.OR = [
				{ title: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		if (upcoming) {
			whereClause.remindAt = {
				gte: new Date(),
			};
		}

		if (overdue) {
			whereClause.remindAt = {
				lt: new Date(),
			};
			whereClause.status = 'pending';
		}

		const [reminders, totalCount] = await Promise.all([
			prisma.reminderAdvanced.findMany({
				where: whereClause,
				orderBy: { remindAt: 'asc' },
				take: limit,
				skip: offset,
			}),
			prisma.reminderAdvanced.count({
				where: whereClause,
			}),
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.json({
			success: true,
			data: {
				reminders,
				pagination: {
					currentPage: page,
					totalPages,
					totalItems: totalCount,
					itemsPerPage: limit,
				},
			},
		});
	} catch (error) {
		logger.error('Error fetching reminders:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reminders',
		});
	}
};

// Get single reminder
export const getReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		const reminder = await prisma.reminderAdvanced.findFirst({
			where: {
				id: reminderId,
				guildId,
			},
		});

		if (!reminder) {
			return res.status(404).json({
				success: false,
				error: 'Reminder not found',
			});
		}

		res.json({
			success: true,
			data: reminder,
		});
	} catch (error) {
		logger.error('Error fetching reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reminder',
		});
	}
};

// Update reminder
export const updateReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();
		const validation = updateReminderSchema.safeParse(req.body);

		if (!validation.success) {
			return res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
		}

		const data = validation.data;

		// Check if reminder exists
		const existingReminder = await prisma.reminderAdvanced.findFirst({
			where: {
				id: reminderId,
				guildId,
			},
		});

		if (!existingReminder) {
			return res.status(404).json({
				success: false,
				error: 'Reminder not found',
			});
		}

		// Update reminder
		const updateData: any = {
			updatedAt: new Date(),
		};

		if (data.title) updateData.title = data.title;
		if (data.description !== undefined)
			updateData.description = data.description;
		if (data.remindAt) updateData.remindAt = new Date(data.remindAt);
		if (data.recurring) updateData.recurring = data.recurring;
		if (data.channelId !== undefined) updateData.channelId = data.channelId;
		if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
		if (data.priority) updateData.priority = data.priority;
		if (data.tags) updateData.tags = data.tags;
		if (data.status) updateData.status = data.status;

		const updatedReminder = await prisma.reminderAdvanced.update({
			where: { id: reminderId },
			data: updateData,
		});

		// Broadcast reminder update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('reminderUpdated', {
				reminder: updatedReminder,
				updatedBy: req.user?.id,
			})
		);

		logger.info(`Updated reminder: ${reminderId}`, {
			guildId,
			updatedBy: req.user?.id,
		});

		res.json({
			success: true,
			data: updatedReminder,
		});
	} catch (error) {
		logger.error('Error updating reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update reminder',
		});
	}
};

// Delete reminder
export const deleteReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		// Check if reminder exists
		const existingReminder = await prisma.reminderAdvanced.findFirst({
			where: {
				id: reminderId,
				guildId,
			},
		});

		if (!existingReminder) {
			return res.status(404).json({
				success: false,
				error: 'Reminder not found',
			});
		}

		// Delete reminder
		await prisma.reminderAdvanced.delete({
			where: { id: reminderId },
		});

		// Broadcast reminder deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('reminderDeleted', {
				reminderId,
				deletedBy: req.user?.id,
			})
		);

		logger.info(`Deleted reminder: ${reminderId}`, {
			guildId,
			deletedBy: req.user?.id,
		});

		res.json({
			success: true,
			message: 'Reminder deleted successfully',
		});
	} catch (error) {
		logger.error('Error deleting reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete reminder',
		});
	}
};

// Mark reminder as completed
export const completeReminder = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, reminderId } = req.params;
		const prisma = getPrismaClient();

		// Check if reminder exists
		const existingReminder = await prisma.reminderAdvanced.findFirst({
			where: {
				id: reminderId,
				guildId,
			},
		});

		if (!existingReminder) {
			return res.status(404).json({
				success: false,
				error: 'Reminder not found',
			});
		}

		// Mark as completed
		const updatedReminder = await prisma.reminderAdvanced.update({
			where: { id: reminderId },
			data: {
				status: 'completed',
				completedAt: new Date(),
				updatedAt: new Date(),
			},
		});

		// Handle recurring reminders
		if (existingReminder.recurring !== 'none') {
			const nextRemindAt = calculateNextReminder(
				existingReminder.remindAt,
				existingReminder.recurring
			);

			if (nextRemindAt) {
				await prisma.reminderAdvanced.create({
					data: {
						...existingReminder,
						id: undefined,
						remindAt: nextRemindAt,
						status: 'pending',
						completedAt: null,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				});
			}
		}

		// Broadcast reminder completion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('reminderCompleted', {
				reminder: updatedReminder,
				completedBy: req.user?.id,
			})
		);

		logger.info(`Completed reminder: ${reminderId}`, {
			guildId,
			completedBy: req.user?.id,
		});

		res.json({
			success: true,
			data: updatedReminder,
		});
	} catch (error) {
		logger.error('Error completing reminder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to complete reminder',
		});
	}
};

// Get reminder statistics
export const getReminderStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const [
			totalReminders,
			pendingReminders,
			completedReminders,
			overdueReminders,
			recurringReminders,
			priorityBreakdown,
		] = await Promise.all([
			prisma.reminderAdvanced.count({
				where: { guildId },
			}),
			prisma.reminderAdvanced.count({
				where: { guildId, status: 'pending' },
			}),
			prisma.reminderAdvanced.count({
				where: { guildId, status: 'completed' },
			}),
			prisma.reminderAdvanced.count({
				where: {
					guildId,
					status: 'pending',
					remindAt: { lt: new Date() },
				},
			}),
			prisma.reminderAdvanced.count({
				where: {
					guildId,
					recurring: { not: 'none' },
				},
			}),
			prisma.reminderAdvanced.groupBy({
				by: ['priority'],
				where: { guildId },
				_count: { priority: true },
			}),
		]);

		res.json({
			success: true,
			data: {
				totalReminders,
				pendingReminders,
				completedReminders,
				overdueReminders,
				recurringReminders,
				priorityBreakdown,
				completionRate:
					totalReminders > 0 ? (completedReminders / totalReminders) * 100 : 0,
			},
		});
	} catch (error) {
		logger.error('Error fetching reminder statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch reminder statistics',
		});
	}
};

// Helper function to calculate next reminder time
function calculateNextReminder(
	currentTime: Date,
	recurring: string
): Date | null {
	const nextTime = new Date(currentTime);

	switch (recurring) {
		case 'daily':
			nextTime.setDate(nextTime.getDate() + 1);
			break;
		case 'weekly':
			nextTime.setDate(nextTime.getDate() + 7);
			break;
		case 'monthly':
			nextTime.setMonth(nextTime.getMonth() + 1);
			break;
		default:
			return null;
	}

	return nextTime;
}
