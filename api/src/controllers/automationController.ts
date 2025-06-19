import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('automation-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'AUTOMATION_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

// Get automation rules
export const getAutomationRules = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			page = 1,
			limit = 20,
			category,
			trigger,
			enabled,
			search,
		} = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (category) where.category = category;
		if (trigger) where.trigger = trigger;
		if (enabled !== undefined) where.enabled = enabled === 'true';
		if (search) {
			where.OR = [
				{ name: { contains: search as string, mode: 'insensitive' } },
				{ description: { contains: search as string, mode: 'insensitive' } },
			];
		}

		// Fetch rules with pagination
		const [rules, total] = await Promise.all([
			prisma.automationRule.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					executions: {
						orderBy: { timestamp: 'desc' },
						take: 5,
					},
				},
			}),
			prisma.automationRule.count({ where }),
		]);

		const formattedRules = rules.map((rule: any) => ({
			id: rule.id,
			name: rule.name,
			description: rule.description,
			category: rule.category,
			trigger: rule.trigger,
			conditions: rule.conditions,
			actions: rule.actions,
			enabled: rule.enabled,
			priority: rule.priority,
			cooldownSeconds: rule.cooldownSeconds,
			maxExecutions: rule.maxExecutions,
			currentExecutions: rule.currentExecutions,
			lastExecuted: rule.lastExecuted,
			createdAt: rule.createdAt,
			updatedAt: rule.updatedAt,
			recentExecutions: rule.executions.map((execution: any) => ({
				id: execution.id,
				success: execution.success,
				error: execution.error,
				timestamp: execution.timestamp,
				context: execution.context,
			})),
		}));

		res.json({
			success: true,
			data: {
				rules: formattedRules,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching automation rules:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch automation rules',
		} as ApiResponse);
	}
};

// Get single automation rule
export const getAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const prisma = getPrismaClient();

		const rule = await prisma.automationRule.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
			include: {
				executions: {
					orderBy: { timestamp: 'desc' },
					take: 50,
				},
			},
		});

		if (!rule) {
			return res.status(404).json({
				success: false,
				error: 'Automation rule not found',
			} as ApiResponse);
		}

		res.json({
			success: true,
			data: rule,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching automation rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch automation rule',
		} as ApiResponse);
	}
};

// Create automation rule
export const createAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			name,
			description,
			category = 'general',
			trigger,
			conditions = [],
			actions = [],
			enabled = true,
			priority = 0,
			cooldownSeconds = 0,
			maxExecutions = null,
		} = req.body;
		const prisma = getPrismaClient();

		// Validate required fields
		if (!name || !trigger || !actions.length) {
			return res.status(400).json({
				success: false,
				error: 'Name, trigger, and at least one action are required',
			} as ApiResponse);
		}

		// Create automation rule
		const rule = await prisma.automationRule.create({
			data: {
				guildId,
				name,
				description,
				category,
				trigger,
				conditions,
				actions,
				enabled,
				priority,
				cooldownSeconds,
				maxExecutions,
				currentExecutions: 0,
			},
		});

		// Broadcast rule creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('automationRuleCreate', rule)
		);

		logger.info(`Created automation rule '${name}' for guild ${guildId}`, {
			ruleId: rule.id,
			trigger,
		});

		res.status(201).json({
			success: true,
			message: 'Automation rule created successfully',
			data: rule,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating automation rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create automation rule',
		} as ApiResponse);
	}
};

// Update automation rule
export const updateAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if rule exists
		const existingRule = await prisma.automationRule.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!existingRule) {
			return res.status(404).json({
				success: false,
				error: 'Automation rule not found',
			} as ApiResponse);
		}

		// Update rule
		const updatedRule = await prisma.automationRule.update({
			where: { id: ruleId },
			data: {
				...updateData,
				updatedAt: new Date(),
			},
		});

		// Broadcast rule update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('automationRuleUpdate', updatedRule)
		);

		logger.info(`Updated automation rule ${ruleId} for guild ${guildId}`);

		res.json({
			success: true,
			message: 'Automation rule updated successfully',
			data: updatedRule,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating automation rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update automation rule',
		} as ApiResponse);
	}
};

// Delete automation rule
export const deleteAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const prisma = getPrismaClient();

		// Check if rule exists
		const existingRule = await prisma.automationRule.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!existingRule) {
			return res.status(404).json({
				success: false,
				error: 'Automation rule not found',
			} as ApiResponse);
		}

		// Delete rule and its executions
		await prisma.automationRule.delete({
			where: { id: ruleId },
		});

		// Broadcast rule deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('automationRuleDelete', { id: ruleId })
		);

		logger.info(`Deleted automation rule ${ruleId} from guild ${guildId}`);

		res.json({
			success: true,
			message: 'Automation rule deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting automation rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete automation rule',
		} as ApiResponse);
	}
};

// Execute automation rule manually
export const executeAutomationRule = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId, ruleId } = req.params;
		const { context = {} } = req.body;
		const prisma = getPrismaClient();

		// Get rule
		const rule = await prisma.automationRule.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!rule) {
			return res.status(404).json({
				success: false,
				error: 'Automation rule not found',
			} as ApiResponse);
		}

		if (!rule.enabled) {
			return res.status(400).json({
				success: false,
				error: 'Automation rule is disabled',
			} as ApiResponse);
		}

		// Check execution limits
		if (rule.maxExecutions && rule.currentExecutions >= rule.maxExecutions) {
			return res.status(400).json({
				success: false,
				error: 'Rule has reached maximum execution limit',
			} as ApiResponse);
		}

		// Check cooldown
		if (rule.cooldownSeconds > 0 && rule.lastExecuted) {
			const cooldownEnd = new Date(
				rule.lastExecuted.getTime() + rule.cooldownSeconds * 1000
			);
			if (new Date() < cooldownEnd) {
				return res.status(400).json({
					success: false,
					error: 'Rule is still in cooldown period',
				} as ApiResponse);
			}
		}

		// Create execution record
		const execution = await prisma.automationRuleExecution.create({
			data: {
				guildId,
				ruleId,
				trigger: 'MANUAL',
				context,
				success: true, // Assume success for manual execution
				timestamp: new Date(),
			},
		});

		// Update rule execution count and last executed
		await prisma.automationRule.update({
			where: { id: ruleId },
			data: {
				currentExecutions: { increment: 1 },
				lastExecuted: new Date(),
			},
		});

		logger.info(`Manually executed automation rule ${ruleId}`, {
			executionId: execution.id,
		});

		res.json({
			success: true,
			message: 'Automation rule executed successfully',
			data: execution,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error executing automation rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to execute automation rule',
		} as ApiResponse);
	}
};

// Get rule execution history
export const getRuleExecutions = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const { page = 1, limit = 50, success } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId, ruleId };
		if (success !== undefined) where.success = success === 'true';

		// Fetch executions with pagination
		const [executions, total] = await Promise.all([
			prisma.automationRuleExecution.findMany({
				where,
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.automationRuleExecution.count({ where }),
		]);

		const formattedExecutions = executions.map((execution: any) => ({
			id: execution.id,
			trigger: execution.trigger,
			success: execution.success,
			error: execution.error,
			context: execution.context,
			timestamp: execution.timestamp,
		}));

		res.json({
			success: true,
			data: {
				executions: formattedExecutions,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching rule executions:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch rule executions',
		} as ApiResponse);
	}
};

// Get automation statistics
export const getAutomationStatistics = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get automation statistics
		const [
			totalRules,
			activeRules,
			totalExecutions,
			successfulExecutions,
			categoryBreakdown,
			triggerBreakdown,
			dailyActivity,
		] = await Promise.all([
			prisma.automationRule.count({ where: { guildId } }),
			prisma.automationRule.count({ where: { guildId, enabled: true } }),
			prisma.automationRuleExecution.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
			prisma.automationRuleExecution.count({
				where: {
					guildId,
					success: true,
					timestamp: { gte: startDate },
				},
			}),
			prisma.automationRule.groupBy({
				by: ['category'],
				where: { guildId },
				_count: { category: true },
			}),
			prisma.automationRule.groupBy({
				by: ['trigger'],
				where: { guildId },
				_count: { trigger: true },
			}),
			prisma.automationRuleExecution.groupBy({
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
				totalRules,
				activeRules,
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
				triggers: triggerBreakdown.reduce((acc: any, trigger: any) => {
					acc[trigger.trigger] = trigger._count.trigger;
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
		logger.error('Error fetching automation statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch automation statistics',
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
