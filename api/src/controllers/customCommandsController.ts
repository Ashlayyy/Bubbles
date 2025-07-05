import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('custom-commands-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'CUSTOM_COMMAND_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Get custom commands
export const getCustomCommands = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 20, category, enabled, search } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (category) where.category = category;
		if (enabled !== undefined) where.enabled = enabled === 'true';
		if (search) {
			where.OR = [
				{ name: { contains: search as string, mode: 'insensitive' } },
				{ description: { contains: search as string, mode: 'insensitive' } },
				{ aliases: { has: search as string } },
			];
		}

		// Fetch commands with pagination
		const [commands, total] = await Promise.all([
			prisma.customCommand.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					logs: {
						orderBy: { timestamp: 'desc' },
						take: 5,
					},
				},
			}),
			prisma.customCommand.count({ where }),
		]);

		const formattedCommands = commands.map((command: any) => ({
			id: command.id,
			name: command.name,
			description: command.description,
			content: command.content,
			aliases: command.aliases,
			category: command.category,
			enabled: command.enabled,
			cooldownSeconds: command.cooldownSeconds,
			requiredRoles: command.requiredRoles,
			requiredPermissions: command.requiredPermissions,
			allowedChannels: command.allowedChannels,
			usageCount: command.usageCount,
			lastUsed: command.lastUsed,
			createdAt: command.createdAt,
			updatedAt: command.updatedAt,
			recentExecutions: command.logs.map((log: any) => ({
				id: log.id,
				userId: log.userId,
				success: log.success,
				error: log.error,
				timestamp: log.timestamp,
			})),
		}));

		res.success({
			commands: formattedCommands,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching custom commands:', error);
		res.failure('Failed to fetch custom commands', 500);
	}
};

// Get single custom command
export const getCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, commandId } = req.params;
		const prisma = getPrismaClient();

		const command = await prisma.customCommand.findFirst({
			where: {
				id: commandId,
				guildId,
			},
			include: {
				logs: {
					orderBy: { timestamp: 'desc' },
					take: 50,
				},
			},
		});

		if (!command) {
			return res.failure('Custom command not found', 404);
		}

		res.success(command);
	} catch (error) {
		logger.error('Error fetching custom command:', error);
		res.failure('Failed to fetch custom command', 500);
	}
};

// Create custom command
export const createCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			name,
			description,
			content,
			aliases = [],
			category = 'general',
			enabled = true,
			cooldownSeconds = 0,
			requiredRoles = [],
			requiredPermissions = [],
			allowedChannels = [],
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (!name || !content) {
			return res.failure('Name and content are required', 400);
		}

		// Check for name conflicts
		const existingCommand = await prisma.customCommand.findFirst({
			where: {
				guildId,
				OR: [
					{ name: name.toLowerCase() },
					{ aliases: { has: name.toLowerCase() } },
				],
			},
		});

		if (existingCommand) {
			return res.failure('Command name or alias already exists', 400);
		}

		// Check alias conflicts
		if (aliases.length > 0) {
			const aliasConflicts = await prisma.customCommand.findFirst({
				where: {
					guildId,
					OR: [
						{ name: { in: aliases.map((a: string) => a.toLowerCase()) } },
						{
							aliases: { hasSome: aliases.map((a: string) => a.toLowerCase()) },
						},
					],
				},
			});

			if (aliasConflicts) {
				return res.failure(
					'One or more aliases conflict with existing commands',
					400
				);
			}
		}

		// Create command
		const command = await prisma.customCommand.create({
			data: {
				guildId,
				name: name.toLowerCase(),
				description,
				content,
				aliases: aliases.map((a: string) => a.toLowerCase()),
				category,
				enabled,
				cooldownSeconds,
				requiredRoles,
				requiredPermissions,
				allowedChannels,
				usageCount: 0,
			},
		});

		// Broadcast command creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('customCommandCreate', command)
		);

		logger.info(`Created custom command '${name}' for guild ${guildId}`, {
			commandId: command.id,
		});

		res.success(
			{
				message: 'Custom command created successfully',
				data: command,
			},
			201
		);
	} catch (error) {
		logger.error('Error creating custom command:', error);
		res.failure('Failed to create custom command', 500);
	}
};

// Update custom command
export const updateCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, commandId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if command exists
		const existingCommand = await prisma.customCommand.findFirst({
			where: {
				id: commandId,
				guildId,
			},
		});

		if (!existingCommand) {
			return res.failure('Custom command not found', 404);
		}

		// Check for name conflicts if updating name
		if (updateData.name && updateData.name !== existingCommand.name) {
			const nameConflict = await prisma.customCommand.findFirst({
				where: {
					guildId,
					id: { not: commandId },
					OR: [
						{ name: updateData.name.toLowerCase() },
						{ aliases: { has: updateData.name.toLowerCase() } },
					],
				},
			});

			if (nameConflict) {
				return res.failure('Command name conflicts with existing command', 400);
			}
		}

		// Update command
		const updatedCommand = await prisma.customCommand.update({
			where: { id: commandId },
			data: {
				...updateData,
				name: updateData.name ? updateData.name.toLowerCase() : undefined,
				aliases: updateData.aliases
					? updateData.aliases.map((a: string) => a.toLowerCase())
					: undefined,
				updatedAt: new Date(),
			},
		});

		// Broadcast command update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('customCommandUpdate', updatedCommand)
		);

		logger.info(`Updated custom command ${commandId} for guild ${guildId}`);

		res.success({
			message: 'Custom command updated successfully',
			data: updatedCommand,
		});
	} catch (error) {
		logger.error('Error updating custom command:', error);
		res.failure('Failed to update custom command', 500);
	}
};

// Delete custom command
export const deleteCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, commandId } = req.params;
		const prisma = getPrismaClient();

		// Check if command exists
		const existingCommand = await prisma.customCommand.findFirst({
			where: {
				id: commandId,
				guildId,
			},
		});

		if (!existingCommand) {
			return res.failure('Custom command not found', 404);
		}

		// Delete command (cascade will handle logs)
		await prisma.customCommand.delete({
			where: { id: commandId },
		});

		// Broadcast command deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('customCommandDelete', { id: commandId })
		);

		logger.info(`Deleted custom command ${commandId} from guild ${guildId}`);

		res.success({ message: 'Custom command deleted successfully' });
	} catch (error) {
		logger.error('Error deleting custom command:', error);
		res.failure('Failed to delete custom command', 500);
	}
};

// Execute custom command
export const executeCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, commandId } = req.params;
		const { userId, channelId, content = '' } = req.body;
		const prisma = getPrismaClient();

		// Get command
		const command = await prisma.customCommand.findFirst({
			where: {
				id: commandId,
				guildId,
			},
		});

		if (!command) {
			return res.failure('Custom command not found', 404);
		}

		if (!command.enabled) {
			return res.failure('Custom command is disabled', 400);
		}

		// Check permissions and restrictions
		// This would typically be done by the bot, but we can validate here too

		// Update usage statistics
		await prisma.customCommand.update({
			where: { id: commandId },
			data: {
				usageCount: { increment: 1 },
				lastUsed: new Date(),
			},
		});

		// Log execution
		const executionLog = await prisma.customCommandLog.create({
			data: {
				guildId,
				commandId,
				commandName: command.name,
				userId: userId || 'unknown',
				channelId: channelId || null,
				success: true,
				timestamp: new Date(),
			},
		});

		logger.info(`Executed custom command ${command.name}`, {
			executionId: executionLog.id,
			guildId,
			userId,
		});

		res.success({
			message: 'Custom command executed successfully',
			data: {
				command: command.name,
				executed: true,
				content: command.content,
				timestamp: executionLog.timestamp,
			},
		});
	} catch (error) {
		logger.error('Error executing custom command:', error);
		res.failure('Failed to execute custom command', 500);
	}
};

// Get command execution logs
export const getCommandLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, commandId, userId, success } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (commandId) where.commandId = commandId;
		if (userId) where.userId = userId;
		if (success !== undefined) where.success = success === 'true';

		// Fetch logs with pagination
		const [logs, total] = await Promise.all([
			prisma.customCommandLog.findMany({
				where,
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.customCommandLog.count({ where }),
		]);

		const formattedLogs = logs.map((log: any) => ({
			id: log.id,
			commandName: log.commandName,
			userId: log.userId,
			channelId: log.channelId,
			success: log.success,
			error: log.error,
			timestamp: log.timestamp,
		}));

		res.success({
			logs: formattedLogs,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching command logs:', error);
		res.failure('Failed to fetch command logs', 500);
	}
};

// Get command statistics
export const getCommandStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get command statistics
		const [
			totalCommands,
			activeCommands,
			totalExecutions,
			successfulExecutions,
			commandBreakdown,
			dailyActivity,
		] = await Promise.all([
			prisma.customCommand.count({ where: { guildId } }),
			prisma.customCommand.count({ where: { guildId, enabled: true } }),
			prisma.customCommandLog.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
			prisma.customCommandLog.count({
				where: {
					guildId,
					success: true,
					timestamp: { gte: startDate },
				},
			}),
			prisma.customCommandLog.groupBy({
				by: ['commandName'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { commandName: true },
				orderBy: { _count: { commandName: 'desc' } },
				take: 10,
			}),
			prisma.customCommandLog.groupBy({
				by: ['timestamp'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { timestamp: true },
			}),
		]);

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.timestamp.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.timestamp
			);
		});

		const statistics = {
			period: period as string,
			overview: {
				totalCommands,
				activeCommands,
				totalExecutions,
				successfulExecutions,
				successRate:
					totalExecutions > 0
						? Math.round((successfulExecutions / totalExecutions) * 100)
						: 0,
				averagePerDay: Math.round(
					totalExecutions / Math.max(1, periodMs / (24 * 60 * 60 * 1000))
				),
			},
			topCommands: commandBreakdown.map((cmd: any) => ({
				name: cmd.commandName,
				executions: cmd._count.commandName,
			})),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching command statistics:', error);
		res.failure('Failed to fetch command statistics', 500);
	}
};

// Helper function
function parsePeriod(period: string): number {
	const match = period.match(/^(\d+)([dwmy])$/);
	if (!match) return 7 * 24 * 60 * 60 * 1000;

	const [, amount, unit] = match;
	const num = parseInt(amount);

	switch (unit) {
		case 'd':
			return num * 24 * 60 * 60 * 1000;
		case 'w':
			return num * 7 * 24 * 60 * 60 * 1000;
		case 'm':
			return num * 30 * 24 * 60 * 60 * 1000;
		case 'y':
			return num * 365 * 24 * 60 * 60 * 1000;
		default:
			return 7 * 24 * 60 * 60 * 1000;
	}
}
