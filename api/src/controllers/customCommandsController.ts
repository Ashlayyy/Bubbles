import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
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

		res.json({
			success: true,
			data: {
				commands: formattedCommands,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching custom commands:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch custom commands',
		} as ApiResponse);
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
			return res.status(404).json({
				success: false,
				error: 'Custom command not found',
			} as ApiResponse);
		}

		res.json({
			success: true,
			data: command,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching custom command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch custom command',
		} as ApiResponse);
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
			return res.status(400).json({
				success: false,
				error: 'Name and content are required',
			} as ApiResponse);
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
			return res.status(400).json({
				success: false,
				error: 'Command name or alias already exists',
			} as ApiResponse);
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
				return res.status(400).json({
					success: false,
					error: 'One or more aliases conflict with existing commands',
				} as ApiResponse);
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

		res.status(201).json({
			success: true,
			message: 'Custom command created successfully',
			data: command,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating custom command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create custom command',
		} as ApiResponse);
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
			return res.status(404).json({
				success: false,
				error: 'Custom command not found',
			} as ApiResponse);
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
				return res.status(400).json({
					success: false,
					error: 'Command name conflicts with existing command',
				} as ApiResponse);
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

		res.json({
			success: true,
			message: 'Custom command updated successfully',
			data: updatedCommand,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating custom command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update custom command',
		} as ApiResponse);
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
			return res.status(404).json({
				success: false,
				error: 'Custom command not found',
			} as ApiResponse);
		}

		// Delete command and its logs
		await prisma.customCommand.delete({
			where: { id: commandId },
		});

		// Broadcast command deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('customCommandDelete', {
				id: commandId,
			})
		);

		logger.info(`Deleted custom command ${commandId} from guild ${guildId}`);

		res.json({
			success: true,
			message: 'Custom command deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting custom command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete custom command',
		} as ApiResponse);
	}
};

// Execute custom command (for testing)
export const executeCustomCommand = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, commandId } = req.params;
		const { userId, channelId, args = [] } = req.body;
		const prisma = getPrismaClient();

		// Get command
		const command = await prisma.customCommand.findFirst({
			where: {
				id: commandId,
				guildId,
			},
		});

		if (!command) {
			return res.status(404).json({
				success: false,
				error: 'Custom command not found',
			} as ApiResponse);
		}

		if (!command.enabled) {
			return res.status(400).json({
				success: false,
				error: 'Command is disabled',
			} as ApiResponse);
		}

		// Check cooldown
		if (command.cooldownSeconds > 0 && command.lastUsed) {
			const cooldownEnd = new Date(
				command.lastUsed.getTime() + command.cooldownSeconds * 1000
			);
			if (new Date() < cooldownEnd) {
				return res.status(400).json({
					success: false,
					error: 'Command is still in cooldown period',
				} as ApiResponse);
			}
		}

		// Process content with variable replacement
		let processedContent = command.content;

		// Replace variables
		processedContent = processedContent.replace(/\{user\}/g, `<@${userId}>`);
		processedContent = processedContent.replace(
			/\{channel\}/g,
			`<#${channelId}>`
		);
		processedContent = processedContent.replace(/\{server\}/g, 'Server');

		// Replace argument variables
		args.forEach((arg: string, index: number) => {
			const regex = new RegExp(`\\{${index + 1}\\}`, 'g');
			processedContent = processedContent.replace(regex, arg);
		});

		// Log execution
		await prisma.customCommandLog.create({
			data: {
				guildId,
				commandName: command.name,
				userId,
				channelId,
				args,
				success: true,
				timestamp: new Date(),
			},
		});

		// Update command usage
		await prisma.customCommand.update({
			where: { id: commandId },
			data: {
				usageCount: { increment: 1 },
				lastUsed: new Date(),
			},
		});

		logger.info(`Executed custom command ${command.name}`, {
			commandId,
			userId,
		});

		res.json({
			success: true,
			message: 'Command executed successfully',
			data: {
				content: processedContent,
				originalContent: command.content,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error executing custom command:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to execute custom command',
		} as ApiResponse);
	}
};

// Get command execution logs
export const getCommandLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, commandName, userId, success } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (commandName) where.commandName = commandName;
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
			args: log.args,
			success: log.success,
			error: log.error,
			timestamp: log.timestamp,
		}));

		res.json({
			success: true,
			data: {
				logs: formattedLogs,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching command logs:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch command logs',
		} as ApiResponse);
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
			categoryBreakdown,
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
			prisma.customCommand.groupBy({
				by: ['category'],
				where: { guildId },
				_count: { category: true },
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
			breakdown: {
				categories: categoryBreakdown.reduce((acc: any, cat: any) => {
					acc[cat.category] = cat._count.category;
					return acc;
				}, {}),
			},
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.json({
			success: true,
			data: statistics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching command statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch command statistics',
		} as ApiResponse);
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
