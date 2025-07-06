import { Request, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../services/databaseService.js';
import type { AuthRequest } from '../middleware/auth.js';

const prisma = getPrismaClient();

// Helper function to validate request
function validateRequest<T>(schema: z.ZodSchema<T>, data: any) {
	return schema.safeParse(data);
}

// Validation schemas
const createTemplateSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	category: z.string().min(1).max(50),
	title: z.string().min(1).max(200),
	content: z.string().max(2000).optional(),
	priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
	tags: z.array(z.string()).default([]),
	autoAssignRoles: z.array(z.string()).default([]),
	autoAssignUsers: z.array(z.string()).default([]),
	isActive: z.boolean().default(true),
	isPublic: z.boolean().default(true),
	fields: z
		.array(
			z.object({
				name: z.string().min(1).max(50),
				label: z.string().min(1).max(100),
				description: z.string().max(200).optional(),
				type: z.enum([
					'TEXT',
					'TEXTAREA',
					'SELECT',
					'MULTISELECT',
					'BOOLEAN',
					'NUMBER',
					'DATE',
					'USER',
					'ROLE',
					'CHANNEL',
				]),
				required: z.boolean().default(false),
				options: z.array(z.string()).default([]),
				defaultValue: z.string().optional(),
				placeholder: z.string().optional(),
				validation: z.record(z.any()).optional(),
				displayOrder: z.number().int().min(0).default(0),
			})
		)
		.default([]),
	actions: z
		.array(
			z.object({
				name: z.string().min(1).max(100),
				type: z.enum([
					'MESSAGE',
					'ROLE_ASSIGN',
					'NOTIFICATION',
					'WORKFLOW_TRIGGER',
					'STATUS_CHANGE',
				]),
				trigger: z
					.enum(['ON_CREATE', 'ON_ASSIGN', 'ON_FIRST_RESPONSE', 'DELAYED'])
					.default('ON_CREATE'),
				delay: z.number().int().min(1).optional(),
				config: z.record(z.any()),
				conditions: z.record(z.any()).optional(),
				isActive: z.boolean().default(true),
				executionOrder: z.number().int().min(0).default(0),
			})
		)
		.default([]),
});

const updateTemplateSchema = createTemplateSchema.partial();

const createTypeSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	emoji: z.string().optional(),
	color: z
		.string()
		.regex(/^#[0-9A-F]{6}$/i)
		.optional(),
	category: z.string().min(1).max(50),
	priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
	estimatedTime: z.number().int().min(1).optional(),
	slaTime: z.number().int().min(1).optional(),
	autoClose: z.boolean().default(false),
	autoCloseTime: z.number().int().min(1).optional(),
	requiresApproval: z.boolean().default(false),
	approvalRoles: z.array(z.string()).default([]),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().min(0).default(0),
});

const useTemplateSchema = z.object({
	fieldValues: z.record(z.any()).default({}),
	customTitle: z.string().max(200).optional(),
	customContent: z.string().max(2000).optional(),
	customPriority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
	customTags: z.array(z.string()).optional(),
});

/**
 * Get all ticket templates for a guild
 */
export const getTicketTemplates = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const { category, isPublic, isActive } = req.query;

		const whereClause: any = { guildId };

		if (category) {
			whereClause.category = category;
		}

		if (isPublic !== undefined) {
			whereClause.isPublic = isPublic === 'true';
		}

		if (isActive !== undefined) {
			whereClause.isActive = isActive === 'true';
		}

		const templates = await prisma.ticketTemplate.findMany({
			where: whereClause,
			include: {
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
				actions: {
					orderBy: { executionOrder: 'asc' },
				},
			},
			orderBy: [{ category: 'asc' }, { name: 'asc' }],
		});

		res.json({
			success: true,
			data: templates,
		});
	} catch (error) {
		console.error('Error fetching ticket templates:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket templates',
		});
	}
};

/**
 * Get a specific ticket template
 */
export const getTicketTemplate = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, templateId } = req.params;

		const template = await prisma.ticketTemplate.findFirst({
			where: {
				id: templateId,
				guildId,
			},
			include: {
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
				actions: {
					orderBy: { executionOrder: 'asc' },
				},
			},
		});

		if (!template) {
			res.status(404).json({
				success: false,
				error: 'Ticket template not found',
			});
			return;
		}

		res.json({
			success: true,
			data: template,
		});
	} catch (error) {
		console.error('Error fetching ticket template:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket template',
		});
	}
};

/**
 * Create a new ticket template
 */
export const createTicketTemplate = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const validation = createTemplateSchema.safeParse(req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { fields, actions, ...templateData } = validation.data;

		// Check if template name already exists
		const existingTemplate = await prisma.ticketTemplate.findFirst({
			where: {
				guildId,
				name: templateData.name,
			},
		});

		if (existingTemplate) {
			res.status(409).json({
				success: false,
				error: 'A template with this name already exists',
			});
			return;
		}

		// Create template with fields and actions
		const template = await prisma.ticketTemplate.create({
			data: {
				...templateData,
				guildId,
				createdBy: req.user?.id || 'system',
				fields: {
					create: fields,
				},
				actions: {
					create: actions,
				},
			},
			include: {
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
				actions: {
					orderBy: { executionOrder: 'asc' },
				},
			},
		});

		res.status(201).json({
			success: true,
			data: template,
		});
	} catch (error) {
		console.error('Error creating ticket template:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create ticket template',
		});
	}
};

/**
 * Update a ticket template
 */
export const updateTicketTemplate = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, templateId } = req.params;
		const validation = validateRequest(updateTemplateSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { fields, actions, ...templateData } = validation.data;

		// Check if template exists
		const existingTemplate = await prisma.ticketTemplate.findFirst({
			where: {
				id: templateId,
				guildId,
			},
		});

		if (!existingTemplate) {
			res.status(404).json({
				success: false,
				error: 'Ticket template not found',
			});
			return;
		}

		// Check if new name conflicts with existing template
		if (templateData.name && templateData.name !== existingTemplate.name) {
			const nameConflict = await prisma.ticketTemplate.findFirst({
				where: {
					guildId,
					name: templateData.name,
					id: { not: templateId },
				},
			});

			if (nameConflict) {
				res.status(409).json({
					success: false,
					error: 'A template with this name already exists',
				});
				return;
			}
		}

		// Update template
		const updateData: any = { ...templateData };

		// Handle fields update
		if (fields) {
			// Delete existing fields and create new ones
			await prisma.ticketTemplateField.deleteMany({
				where: { templateId },
			});

			updateData.fields = {
				create: fields,
			};
		}

		// Handle actions update
		if (actions) {
			// Delete existing actions and create new ones
			await prisma.ticketTemplateAction.deleteMany({
				where: { templateId },
			});

			updateData.actions = {
				create: actions,
			};
		}

		const template = await prisma.ticketTemplate.update({
			where: { id: templateId },
			data: updateData,
			include: {
				fields: {
					orderBy: { displayOrder: 'asc' },
				},
				actions: {
					orderBy: { executionOrder: 'asc' },
				},
			},
		});

		res.json({
			success: true,
			data: template,
		});
	} catch (error) {
		console.error('Error updating ticket template:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update ticket template',
		});
	}
};

/**
 * Delete a ticket template
 */
export const deleteTicketTemplate = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, templateId } = req.params;

		// Check if template exists
		const existingTemplate = await prisma.ticketTemplate.findFirst({
			where: {
				id: templateId,
				guildId,
			},
		});

		if (!existingTemplate) {
			res.status(404).json({
				success: false,
				error: 'Ticket template not found',
			});
			return;
		}

		// Check usage count
		const usageCount = await prisma.ticketTemplateUsage.count({
			where: { templateId },
		});

		await prisma.ticketTemplate.delete({
			where: { id: templateId },
		});

		res.json({
			success: true,
			message: 'Ticket template deleted successfully',
			usageCount,
		});
	} catch (error) {
		console.error('Error deleting ticket template:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete ticket template',
		});
	}
};

/**
 * Use a template to create a ticket
 */
export const useTicketTemplate = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const { guildId, templateId } = req.params;
		const validation = validateRequest(useTemplateSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const {
			fieldValues,
			customTitle,
			customContent,
			customPriority,
			customTags,
		} = validation.data;

		// Get template
		const template = await prisma.ticketTemplate.findFirst({
			where: {
				id: templateId,
				guildId,
				isActive: true,
			},
			include: {
				fields: true,
				actions: {
					where: { isActive: true },
					orderBy: { executionOrder: 'asc' },
				},
			},
		});

		if (!template) {
			res.status(404).json({
				success: false,
				error: 'Ticket template not found or inactive',
			});
			return;
		}

		// Validate required fields
		const missingFields = template.fields
			.filter((field: any) => field.required && !fieldValues?.[field.name])
			.map((field: any) => field.name);

		if (missingFields.length > 0) {
			res.status(400).json({
				success: false,
				error: 'Missing required fields',
				missingFields,
			});
			return;
		}

		// Get next ticket number
		const lastTicket = await prisma.ticket.findFirst({
			where: { guildId },
			orderBy: { ticketNumber: 'desc' },
			select: { ticketNumber: true },
		});

		const nextTicketNumber = (lastTicket?.ticketNumber || 0) + 1;

		// Create ticket
		const ticketData = {
			ticketNumber: nextTicketNumber,
			guildId,
			userId: req.user?.id || 'system',
			channelId: 'temp', // This would be set by the bot
			category: template.category,
			title: customTitle || template.title,
			description: customContent || template.content || '',
			tags: customTags || template.tags,
			priority: customPriority || template.priority,
		};

		const ticket = await prisma.ticket.create({
			data: ticketData,
		});

		// Store field values
		if (fieldValues && Object.keys(fieldValues).length > 0) {
			const fieldValueData = Object.entries(fieldValues).map(
				([fieldName, value]) => ({
					ticketId: ticket.id,
					fieldName,
					value: String(value),
				})
			);

			await prisma.ticketFieldValue.createMany({
				data: fieldValueData,
			});
		}

		// Track template usage
		await prisma.ticketTemplateUsage.create({
			data: {
				templateId,
				ticketId: ticket.id,
				userId: req.user?.id || 'system',
				fieldValues,
			},
		});

		// Increment usage count
		await prisma.ticketTemplate.update({
			where: { id: templateId },
			data: { usageCount: { increment: 1 } },
		});

		res.status(201).json({
			success: true,
			data: {
				ticket,
				template: {
					id: template.id,
					name: template.name,
					actions: template.actions,
				},
				fieldValues,
			},
		});
	} catch (error) {
		console.error('Error using ticket template:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to use ticket template',
		});
	}
};

/**
 * Get ticket types
 */
export const getTicketTypes = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const { category, isActive } = req.query;

		const whereClause: any = { guildId };

		if (category) {
			whereClause.category = category;
		}

		if (isActive !== undefined) {
			whereClause.isActive = isActive === 'true';
		}

		const types = await prisma.ticketType.findMany({
			where: whereClause,
			orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
		});

		res.json({
			success: true,
			data: types,
		});
	} catch (error) {
		console.error('Error fetching ticket types:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket types',
		});
	}
};

/**
 * Create a ticket type
 */
export const createTicketType = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(createTypeSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if type name already exists
		const existingType = await prisma.ticketType.findFirst({
			where: {
				guildId,
				name: data.name,
			},
		});

		if (existingType) {
			res.status(409).json({
				success: false,
				error: 'A ticket type with this name already exists',
			});
			return;
		}

		const type = await prisma.ticketType.create({
			data: {
				...data,
				guildId,
			},
		});

		res.status(201).json({
			success: true,
			data: type,
		});
	} catch (error) {
		console.error('Error creating ticket type:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create ticket type',
		});
	}
};

/**
 * Get template statistics
 */
export const getTemplateStatistics = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, templateId } = req.params;

		const template = await prisma.ticketTemplate.findFirst({
			where: {
				id: templateId,
				guildId,
			},
		});

		if (!template) {
			res.status(404).json({
				success: false,
				error: 'Ticket template not found',
			});
			return;
		}

		// Get usage statistics
		const [totalUsage, recentUsage, userUsage] = await Promise.all([
			prisma.ticketTemplateUsage.count({
				where: { templateId },
			}),

			prisma.ticketTemplateUsage.count({
				where: {
					templateId,
					usedAt: {
						gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
					},
				},
			}),

			prisma.ticketTemplateUsage.groupBy({
				by: ['userId'],
				where: { templateId },
				_count: {
					id: true,
				},
				orderBy: {
					_count: {
						id: 'desc',
					},
				},
				take: 10,
			}),
		]);

		res.json({
			success: true,
			data: {
				template: {
					id: template.id,
					name: template.name,
					usageCount: template.usageCount,
				},
				statistics: {
					totalUsage,
					recentUsage,
					topUsers: userUsage,
				},
			},
		});
	} catch (error) {
		console.error('Error fetching template statistics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch template statistics',
		});
	}
};
