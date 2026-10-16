import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@shared/database';
// import { validateRequest } from '../validation/zodValidate.js';

// Validation schemas
const createCategorySchema = z.object({
	name: z.string().min(1).max(50),
	description: z.string().optional(),
	emoji: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9A-F]{6}$/i)
		.optional(),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().min(0).default(0),
	maxTickets: z.number().int().min(1).optional(),
	autoAssignRoles: z.array(z.string()).default([]),
	requiredRoles: z.array(z.string()).default([]),
	allowedChannels: z.array(z.string()).default([]),
});

const updateCategorySchema = createCategorySchema.partial();

const createWorkflowSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	isDefault: z.boolean().default(false),
	steps: z
		.array(
			z.object({
				stepOrder: z.number().int().min(0),
				name: z.string().min(1).max(100),
				description: z.string().optional(),
				type: z.enum([
					'MESSAGE',
					'ROLE_ASSIGN',
					'STATUS_CHANGE',
					'ESCALATION',
					'NOTIFICATION',
					'DELAY',
					'CONDITION',
				]),
				config: z.record(z.any()),
				conditions: z.record(z.any()).optional(),
				autoExecute: z.boolean().default(false),
				timeoutMinutes: z.number().int().min(1).optional(),
			})
		)
		.min(1),
});

const createFieldSchema = z.object({
	name: z.string().min(1).max(50),
	label: z.string().min(1).max(100),
	description: z.string().optional(),
	type: z.enum([
		'TEXT',
		'TEXTAREA',
		'SELECT',
		'MULTISELECT',
		'BOOLEAN',
		'NUMBER',
		'DATE',
	]),
	required: z.boolean().default(false),
	options: z.array(z.string()).default([]),
	defaultValue: z.string().optional(),
	validation: z.record(z.any()).optional(),
	displayOrder: z.number().int().min(0).default(0),
});

/**
 * Get all ticket categories for a guild
 */
export const getTicketCategories = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const { includeInactive } = req.query;

		const categories = await prisma.ticketCategory.findMany({
			where: {
				guildId,
				...(includeInactive !== 'true' && { isActive: true }),
			},
			include: {
				workflows: {
					include: {
						steps: {
							orderBy: { stepOrder: 'asc' },
						},
					},
				},
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
			},
			orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
		});

		res.json({
			success: true,
			data: categories,
		});
	} catch (error) {
		console.error('Error fetching ticket categories:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket categories',
		});
	}
};

/**
 * Get a specific ticket category
 */
export const getTicketCategory = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;

		const category = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
			include: {
				workflows: {
					include: {
						steps: {
							orderBy: { stepOrder: 'asc' },
						},
					},
				},
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
			},
		});

		if (!category) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		res.json({
			success: true,
			data: category,
		});
	} catch (error) {
		console.error('Error fetching ticket category:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket category',
		});
	}
};

/**
 * Create a new ticket category
 */
export const createTicketCategory = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = createCategorySchema.safeParse(req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if category name already exists
		const existingCategory = await prisma.ticketCategory.findFirst({
			where: {
				guildId,
				name: data.name,
			},
		});

		if (existingCategory) {
			res.status(409).json({
				success: false,
				error: 'A category with this name already exists',
			});
			return;
		}

		const category = await prisma.ticketCategory.create({
			data: {
				...data,
				guildId,
			},
			include: {
				workflows: true,
				fields: true,
			},
		});

		res.status(201).json({
			success: true,
			data: category,
		});
	} catch (error) {
		console.error('Error creating ticket category:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create ticket category',
		});
	}
};

/**
 * Update a ticket category
 */
export const updateTicketCategory = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;
		const validation = updateCategorySchema.safeParse(req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if category exists
		const existingCategory = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
		});

		if (!existingCategory) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		// Check if new name conflicts with existing category
		if (data.name && data.name !== existingCategory.name) {
			const nameConflict = await prisma.ticketCategory.findFirst({
				where: {
					guildId,
					name: data.name,
					id: { not: categoryId },
				},
			});

			if (nameConflict) {
				res.status(409).json({
					success: false,
					error: 'A category with this name already exists',
				});
				return;
			}
		}

		const category = await prisma.ticketCategory.update({
			where: { id: categoryId },
			data,
			include: {
				workflows: {
					include: {
						steps: {
							orderBy: { stepOrder: 'asc' },
						},
					},
				},
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
			},
		});

		res.json({
			success: true,
			data: category,
		});
	} catch (error) {
		console.error('Error updating ticket category:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update ticket category',
		});
	}
};

/**
 * Delete a ticket category
 */
export const deleteTicketCategory = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;

		// Check if category exists
		const existingCategory = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
		});

		if (!existingCategory) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		// Check if there are active tickets using this category
		const activeTickets = await prisma.ticket.count({
			where: {
				guildId,
				category: existingCategory.name,
				status: { not: 'CLOSED' },
			},
		});

		if (activeTickets > 0) {
			res.status(409).json({
				success: false,
				error: 'Cannot delete category with active tickets',
				activeTickets,
			});
			return;
		}

		await prisma.ticketCategory.delete({
			where: { id: categoryId },
		});

		res.json({
			success: true,
			message: 'Ticket category deleted successfully',
		});
	} catch (error) {
		console.error('Error deleting ticket category:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete ticket category',
		});
	}
};

/**
 * Create a workflow for a category
 */
export const createCategoryWorkflow = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;
		const validation = createWorkflowSchema.safeParse(req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if category exists
		const category = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
		});

		if (!category) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		// Check if workflow name already exists for this category
		const existingWorkflow = await prisma.ticketCategoryWorkflow.findFirst({
			where: {
				categoryId,
				name: data.name,
			},
		});

		if (existingWorkflow) {
			res.status(409).json({
				success: false,
				error: 'A workflow with this name already exists for this category',
			});
			return;
		}

		// If this is set as default, unset other defaults
		if (data.isDefault) {
			await prisma.ticketCategoryWorkflow.updateMany({
				where: { categoryId },
				data: { isDefault: false },
			});
		}

		const workflow = await prisma.ticketCategoryWorkflow.create({
			data: {
				categoryId,
				name: data.name,
				description: data.description,
				isDefault: data.isDefault,
				steps: {
					create: data.steps,
				},
			},
			include: {
				steps: {
					orderBy: { stepOrder: 'asc' },
				},
			},
		});

		res.status(201).json({
			success: true,
			data: workflow,
		});
	} catch (error) {
		console.error('Error creating category workflow:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create category workflow',
		});
	}
};

/**
 * Create a custom field for a category
 */
export const createCategoryField = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;
		const validation = createFieldSchema.safeParse(req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if category exists
		const category = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
		});

		if (!category) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		// Check if field name already exists for this category
		const existingField = await prisma.ticketCategoryField.findFirst({
			where: {
				categoryId,
				name: data.name,
			},
		});

		if (existingField) {
			res.status(409).json({
				success: false,
				error: 'A field with this name already exists for this category',
			});
			return;
		}

		const field = await prisma.ticketCategoryField.create({
			data: {
				...data,
				categoryId,
			},
		});

		res.status(201).json({
			success: true,
			data: field,
		});
	} catch (error) {
		console.error('Error creating category field:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create category field',
		});
	}
};

/**
 * Get category statistics
 */
export const getCategoryStatistics = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId } = req.params;

		// Check if category exists
		const category = await prisma.ticketCategory.findFirst({
			where: {
				id: categoryId,
				guildId,
			},
		});

		if (!category) {
			res.status(404).json({
				success: false,
				error: 'Ticket category not found',
			});
			return;
		}

		// Get ticket statistics
		const [totalTickets, activeTickets, closedTickets, avgResponseTime] =
			await Promise.all([
				prisma.ticket.count({
					where: {
						guildId,
						category: category.name,
					},
				}),
				prisma.ticket.count({
					where: {
						guildId,
						category: category.name,
						status: { not: 'CLOSED' },
					},
				}),
				prisma.ticket.count({
					where: {
						guildId,
						category: category.name,
						status: 'CLOSED',
					},
				}),
				prisma.ticket.aggregate({
					where: {
						guildId,
						category: category.name,
						status: 'CLOSED',
						closedAt: { not: null },
					},
					_avg: {
						ticketNumber: true, // This would need to be calculated differently for actual response time
					},
				}),
			]);

		// Get workflow execution statistics
		const workflowStats = await prisma.ticketWorkflowExecution.groupBy({
			by: ['status'],
			where: {
				workflowId: {
					in: (
						await prisma.ticketCategoryWorkflow.findMany({
							where: { categoryId },
							select: { id: true },
						})
					).map((w) => w.id),
				},
			},
			_count: {
				id: true,
			},
		});

		res.json({
			success: true,
			data: {
				totalTickets,
				activeTickets,
				closedTickets,
				avgResponseTime: avgResponseTime._avg.ticketNumber || 0,
				workflowStats: workflowStats.reduce((acc, stat) => {
					acc[stat.status] = stat._count.id;
					return acc;
				}, {} as Record<string, number>),
			},
		});
	} catch (error) {
		console.error('Error fetching category statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch category statistics',
		});
	}
};

/**
 * Execute a workflow for a ticket
 */
export const executeWorkflow = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, categoryId, workflowId } = req.params;
		const { ticketId } = req.body;

		if (!ticketId) {
			res.status(400).json({
				success: false,
				error: 'Ticket ID is required',
			});
			return;
		}

		// Verify the workflow belongs to the category
		const workflow = await prisma.ticketCategoryWorkflow.findFirst({
			where: {
				id: workflowId,
				categoryId,
				category: {
					guildId,
				},
			},
			include: {
				steps: {
					orderBy: { stepOrder: 'asc' },
				},
			},
		});

		if (!workflow) {
			res.status(404).json({
				success: false,
				error: 'Workflow not found',
			});
			return;
		}

		// Check if execution already exists
		const existingExecution = await prisma.ticketWorkflowExecution.findFirst({
			where: {
				ticketId,
				workflowId,
			},
		});

		if (existingExecution) {
			res.status(409).json({
				success: false,
				error: 'Workflow already executed for this ticket',
			});
			return;
		}

		// Create workflow execution
		const execution = await prisma.ticketWorkflowExecution.create({
			data: {
				ticketId,
				workflowId,
				stepExecutions: {
					create: workflow.steps.map((step) => ({
						stepId: step.id,
						stepOrder: step.stepOrder,
						status: step.autoExecute ? 'RUNNING' : 'PENDING',
					})),
				},
			},
			include: {
				stepExecutions: {
					orderBy: { stepOrder: 'asc' },
				},
			},
		});

		res.status(201).json({
			success: true,
			data: execution,
		});
	} catch (error) {
		console.error('Error executing workflow:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to execute workflow',
		});
	}
};
