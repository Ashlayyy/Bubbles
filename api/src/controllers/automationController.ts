import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
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
			prisma.automation.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: {
					executions: {
						orderBy: { triggeredAt: 'desc' },
						take: 5,
					},
				},
			}),
			prisma.automation.count({ where }),
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

		res.success({
			rules: formattedRules,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching automation rules:', error);
		res.failure('Failed to fetch automation rules', 500);
	}
};

// Get single automation rule
export const getAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const prisma = getPrismaClient();

		const rule = await prisma.automation.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
			include: {
				executions: {
					orderBy: { triggeredAt: 'desc' },
					take: 50,
				},
			},
		});

		if (!rule) {
			return res.failure('Automation rule not found', 404);
		}

		res.success(rule);
	} catch (error) {
		logger.error('Error fetching automation rule:', error);
		res.failure('Failed to fetch automation rule', 500);
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
			return res.failure(
				'Name, trigger, and at least one action are required',
				400
			);
		}

		// Create automation rule
		const rule = await prisma.automation.create({
			data: {
				guildId,
				name,
				description,
				trigger,
				conditions,
				actions,
				enabled,
				createdBy: req.user?.id || 'unknown',
				runCount: 0,
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

		res.success(
			{ message: 'Automation rule created successfully', data: rule },
			201
		);
	} catch (error) {
		logger.error('Error creating automation rule:', error);
		res.failure('Failed to create automation rule', 500);
	}
};

// Update automation rule
export const updateAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const updateData = req.body;
		const prisma = getPrismaClient();

		// Check if rule exists
		const existingRule = await prisma.automation.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!existingRule) {
			return res.failure('Automation rule not found', 404);
		}

		// Update rule
		const updatedRule = await prisma.automation.update({
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

		res.success({
			message: 'Automation rule updated successfully',
			data: updatedRule,
		});
	} catch (error) {
		logger.error('Error updating automation rule:', error);
		res.failure('Failed to update automation rule', 500);
	}
};

// Delete automation rule
export const deleteAutomationRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const prisma = getPrismaClient();

		// Check if rule exists
		const existingRule = await prisma.automation.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!existingRule) {
			return res.failure('Automation rule not found', 404);
		}

		// Delete rule and its executions
		await prisma.automation.delete({
			where: { id: ruleId },
		});

		// Broadcast rule deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('automationRuleDelete', { id: ruleId })
		);

		logger.info(`Deleted automation rule ${ruleId} from guild ${guildId}`);

		res.success({ message: 'Automation rule deleted successfully' });
	} catch (error) {
		logger.error('Error deleting automation rule:', error);
		res.failure('Failed to delete automation rule', 500);
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
		const rule = await prisma.automation.findFirst({
			where: {
				id: ruleId,
				guildId,
			},
		});

		if (!rule) {
			return res.failure('Automation rule not found', 404);
		}

		if (!rule.enabled) {
			return res.failure('Automation rule is disabled', 400);
		}

		// Create execution record
		const execution = await prisma.automationExecution.create({
			data: {
				automationId: ruleId,
				triggeredBy: req.user?.id,
				status: 'completed',
				result: context,
			},
		});

		// Update rule execution count and last executed
		await prisma.automation.update({
			where: { id: ruleId },
			data: {
				runCount: { increment: 1 },
				lastRun: new Date(),
			},
		});

		logger.info(`Manually executed automation rule ${ruleId}`, {
			executionId: execution.id,
		});

		res.success({
			message: 'Automation rule executed successfully',
			data: execution,
		});
	} catch (error) {
		logger.error('Error executing automation rule:', error);
		res.failure('Failed to execute automation rule', 500);
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
		const where: any = { automationId: ruleId };
		if (success !== undefined)
			where.status = success === 'true' ? 'completed' : 'failed';

		// Fetch executions with pagination
		const [executions, total] = await Promise.all([
			prisma.automationExecution.findMany({
				where,
				orderBy: { triggeredAt: 'desc' },
				skip,
				take,
			}),
			prisma.automationExecution.count({ where }),
		]);

		const formattedExecutions = executions.map((execution: any) => ({
			id: execution.id,
			triggeredBy: execution.triggeredBy,
			status: execution.status,
			result: execution.result,
			errorMessage: execution.errorMessage,
			duration: execution.duration,
			timestamp: execution.triggeredAt,
		}));

		res.success({
			executions: formattedExecutions,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching rule executions:', error);
		res.failure('Failed to fetch rule executions', 500);
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
			triggerBreakdown,
			dailyActivity,
		] = await Promise.all([
			prisma.automation.count({ where: { guildId } }),
			prisma.automation.count({ where: { guildId, enabled: true } }),
			prisma.automationExecution.count({
				where: {
					automation: { guildId },
					triggeredAt: { gte: startDate },
				},
			}),
			prisma.automationExecution.count({
				where: {
					automation: { guildId },
					status: 'completed',
					triggeredAt: { gte: startDate },
				},
			}),
			prisma.automation.groupBy({
				by: ['trigger'],
				where: { guildId },
				_count: { trigger: true },
			}),
			prisma.automationExecution.groupBy({
				by: ['triggeredAt'],
				where: {
					automation: { guildId },
					triggeredAt: { gte: startDate },
				},
				_count: { triggeredAt: true },
			}),
		]);

		// Process daily activity
		const dailyMap = new Map<string, number>();
		dailyActivity.forEach((day: any) => {
			const dateKey = day.triggeredAt.toISOString().split('T')[0];
			dailyMap.set(
				dateKey,
				(dailyMap.get(dateKey) || 0) + day._count.triggeredAt
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

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching automation statistics:', error);
		res.failure('Failed to fetch automation statistics', 500);
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

// Get available triggers
export const getAvailableTriggers = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const triggers = await prisma.automation.findMany({
			where: { guildId },
			select: { trigger: true },
			distinct: ['trigger'],
		});

		res.success(triggers.map((t: { trigger: string }) => t.trigger));
	} catch (error) {
		logger.error('Error fetching triggers:', error);
		res.failure('Failed to fetch triggers', 500);
	}
};

// Get available actions
export const getAvailableActions = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const actionsRaw = await prisma.automation.findMany({
			where: { guildId },
			select: { actions: true },
		});

		const actionSet = new Set<string>();
		actionsRaw.forEach((rule: any) => {
			rule.actions.forEach((a: string) => actionSet.add(a));
		});

		res.success(Array.from(actionSet));
	} catch (error) {
		logger.error('Error fetching actions:', error);
		res.failure('Failed to fetch actions', 500);
	}
};
