import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@bubbles/shared';
import { validateRequest } from '../validation/zodValidate.js';

// Validation schemas
const addUserSchema = z.object({
	userId: z.string().min(1),
	permissions: z
		.array(z.enum(['VIEW', 'MESSAGE', 'MANAGE', 'CLOSE']))
		.default(['VIEW', 'MESSAGE']),
	reason: z.string().max(500).optional(),
});

const updateUserPermissionsSchema = z.object({
	permissions: z.array(z.enum(['VIEW', 'MESSAGE', 'MANAGE', 'CLOSE'])),
	reason: z.string().max(500).optional(),
});

const removeUserSchema = z.object({
	reason: z.string().max(500).optional(),
});

const accessRequestSchema = z.object({
	userId: z.string().min(1),
	reason: z.string().max(500).optional(),
});

const reviewAccessRequestSchema = z.object({
	status: z.enum(['APPROVED', 'DENIED']),
	reviewNotes: z.string().max(500).optional(),
});

const createPresetSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	permissions: z.array(z.enum(['VIEW', 'MESSAGE', 'MANAGE', 'CLOSE'])),
	isDefault: z.boolean().default(false),
});

const updateSharingConfigSchema = z.object({
	allowUserAdditions: z.boolean().optional(),
	requireApproval: z.boolean().optional(),
	approvalRoles: z.array(z.string()).optional(),
	maxUsersPerTicket: z.number().int().min(1).max(50).optional(),
	defaultPermissions: z
		.array(z.enum(['VIEW', 'MESSAGE', 'MANAGE', 'CLOSE']))
		.optional(),
	autoRemoveInactive: z.boolean().optional(),
	inactiveThresholdDays: z.number().int().min(1).max(365).optional(),
	logChannel: z.string().optional(),
});

/**
 * Get all users in a ticket
 */
export const getTicketUsers = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const { includeInactive } = req.query;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		const whereClause: any = { ticketId };
		if (includeInactive !== 'true') {
			whereClause.isActive = true;
		}

		const users = await prisma.ticketUser.findMany({
			where: whereClause,
			orderBy: { addedAt: 'asc' },
		});

		res.json({
			success: true,
			data: users,
		});
	} catch (error) {
		console.error('Error fetching ticket users:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket users',
		});
	}
};

/**
 * Add a user to a ticket
 */
export const addUserToTicket = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const validation = validateRequest(addUserSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { userId, permissions, reason } = validation.data;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		// Check sharing configuration
		const sharingConfig = await prisma.ticketSharingConfig.findUnique({
			where: { guildId },
		});

		if (sharingConfig) {
			// Check if user additions are allowed
			if (!sharingConfig.allowUserAdditions) {
				res.status(403).json({
					success: false,
					error: 'User additions are disabled for this server',
				});
				return;
			}

			// Check max users limit
			const currentUserCount = await prisma.ticketUser.count({
				where: {
					ticketId,
					isActive: true,
				},
			});

			if (currentUserCount >= sharingConfig.maxUsersPerTicket) {
				res.status(409).json({
					success: false,
					error: `Maximum users per ticket (${sharingConfig.maxUsersPerTicket}) reached`,
				});
				return;
			}

			// Check if approval is required
			if (sharingConfig.requireApproval) {
				// Create access request instead
				const existingRequest = await prisma.ticketAccessRequest.findFirst({
					where: {
						ticketId,
						userId,
						status: 'PENDING',
					},
				});

				if (existingRequest) {
					res.status(409).json({
						success: false,
						error: 'Access request already pending for this user',
					});
					return;
				}

				const accessRequest = await prisma.ticketAccessRequest.create({
					data: {
						ticketId,
						userId,
						requestedBy: req.user?.id || 'system',
						reason,
					},
				});

				res.status(201).json({
					success: true,
					message: 'Access request created - awaiting approval',
					data: accessRequest,
				});
				return;
			}
		}

		// Check if user is already in ticket
		const existingUser = await prisma.ticketUser.findFirst({
			where: {
				ticketId,
				userId,
				isActive: true,
			},
		});

		if (existingUser) {
			res.status(409).json({
				success: false,
				error: 'User is already in this ticket',
			});
			return;
		}

		// Add user to ticket
		const ticketUser = await prisma.ticketUser.create({
			data: {
				ticketId,
				userId,
				addedBy: req.user?.id || 'system',
				permissions:
					permissions.length > 0
						? permissions
						: sharingConfig?.defaultPermissions || ['VIEW', 'MESSAGE'],
				reason,
			},
		});

		// Log activity
		await prisma.ticketUserActivity.create({
			data: {
				ticketId,
				userId,
				action: 'ADDED',
				details: {
					permissions: ticketUser.permissions,
					reason,
				},
				performedBy: req.user?.id || 'system',
			},
		});

		res.status(201).json({
			success: true,
			data: ticketUser,
		});
	} catch (error) {
		console.error('Error adding user to ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add user to ticket',
		});
	}
};

/**
 * Update user permissions in a ticket
 */
export const updateUserPermissions = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId, userId } = req.params;
		const validation = validateRequest(updateUserPermissionsSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { permissions, reason } = validation.data;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		// Check if user is in ticket
		const ticketUser = await prisma.ticketUser.findFirst({
			where: {
				ticketId,
				userId,
				isActive: true,
			},
		});

		if (!ticketUser) {
			res.status(404).json({
				success: false,
				error: 'User not found in this ticket',
			});
			return;
		}

		const oldPermissions = ticketUser.permissions;

		// Update permissions
		const updatedUser = await prisma.ticketUser.update({
			where: { id: ticketUser.id },
			data: { permissions },
		});

		// Log activity
		await prisma.ticketUserActivity.create({
			data: {
				ticketId,
				userId,
				action: 'PERMISSION_CHANGED',
				details: {
					oldPermissions,
					newPermissions: permissions,
					reason,
				},
				performedBy: req.user?.id || 'system',
			},
		});

		res.json({
			success: true,
			data: updatedUser,
		});
	} catch (error) {
		console.error('Error updating user permissions:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update user permissions',
		});
	}
};

/**
 * Remove a user from a ticket
 */
export const removeUserFromTicket = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId, userId } = req.params;
		const validation = validateRequest(removeUserSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { reason } = validation.data;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		// Check if user is in ticket
		const ticketUser = await prisma.ticketUser.findFirst({
			where: {
				ticketId,
				userId,
				isActive: true,
			},
		});

		if (!ticketUser) {
			res.status(404).json({
				success: false,
				error: 'User not found in this ticket',
			});
			return;
		}

		// Remove user from ticket
		await prisma.ticketUser.update({
			where: { id: ticketUser.id },
			data: {
				isActive: false,
				removedAt: new Date(),
				removedBy: req.user?.id || 'system',
				reason,
			},
		});

		// Log activity
		await prisma.ticketUserActivity.create({
			data: {
				ticketId,
				userId,
				action: 'REMOVED',
				details: {
					reason,
					permissions: ticketUser.permissions,
				},
				performedBy: req.user?.id || 'system',
			},
		});

		res.json({
			success: true,
			message: 'User removed from ticket successfully',
		});
	} catch (error) {
		console.error('Error removing user from ticket:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to remove user from ticket',
		});
	}
};

/**
 * Create an access request
 */
export const createAccessRequest = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const validation = validateRequest(accessRequestSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { userId, reason } = validation.data;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		// Check if user is already in ticket
		const existingUser = await prisma.ticketUser.findFirst({
			where: {
				ticketId,
				userId,
				isActive: true,
			},
		});

		if (existingUser) {
			res.status(409).json({
				success: false,
				error: 'User is already in this ticket',
			});
			return;
		}

		// Check if there's already a pending request
		const existingRequest = await prisma.ticketAccessRequest.findFirst({
			where: {
				ticketId,
				userId,
				status: 'PENDING',
			},
		});

		if (existingRequest) {
			res.status(409).json({
				success: false,
				error: 'Access request already pending for this user',
			});
			return;
		}

		const accessRequest = await prisma.ticketAccessRequest.create({
			data: {
				ticketId,
				userId,
				requestedBy: req.user?.id || 'system',
				reason,
			},
		});

		res.status(201).json({
			success: true,
			data: accessRequest,
		});
	} catch (error) {
		console.error('Error creating access request:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create access request',
		});
	}
};

/**
 * Get access requests for a ticket
 */
export const getAccessRequests = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const { status } = req.query;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		const whereClause: any = { ticketId };
		if (status) {
			whereClause.status = status;
		}

		const requests = await prisma.ticketAccessRequest.findMany({
			where: whereClause,
			orderBy: { requestedAt: 'desc' },
		});

		res.json({
			success: true,
			data: requests,
		});
	} catch (error) {
		console.error('Error fetching access requests:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch access requests',
		});
	}
};

/**
 * Review an access request
 */
export const reviewAccessRequest = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId, requestId } = req.params;
		const validation = validateRequest(reviewAccessRequestSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const { status, reviewNotes } = validation.data;

		// Get access request
		const accessRequest = await prisma.ticketAccessRequest.findFirst({
			where: {
				id: requestId,
				ticketId,
			},
		});

		if (!accessRequest) {
			res.status(404).json({
				success: false,
				error: 'Access request not found',
			});
			return;
		}

		if (accessRequest.status !== 'PENDING') {
			res.status(409).json({
				success: false,
				error: 'Access request has already been reviewed',
			});
			return;
		}

		// Update request status
		const updatedRequest = await prisma.ticketAccessRequest.update({
			where: { id: requestId },
			data: {
				status,
				reviewedBy: req.user?.id || 'system',
				reviewedAt: new Date(),
				reviewNotes,
			},
		});

		// If approved, add user to ticket
		if (status === 'APPROVED') {
			const sharingConfig = await prisma.ticketSharingConfig.findUnique({
				where: { guildId },
			});

			await prisma.ticketUser.create({
				data: {
					ticketId,
					userId: accessRequest.userId,
					addedBy: req.user?.id || 'system',
					permissions: sharingConfig?.defaultPermissions || ['VIEW', 'MESSAGE'],
					reason: 'Access request approved',
				},
			});

			// Log activity
			await prisma.ticketUserActivity.create({
				data: {
					ticketId,
					userId: accessRequest.userId,
					action: 'ADDED',
					details: {
						permissions: sharingConfig?.defaultPermissions || [
							'VIEW',
							'MESSAGE',
						],
						reason: 'Access request approved',
						requestId,
					},
					performedBy: req.user?.id || 'system',
				},
			});
		}

		res.json({
			success: true,
			data: updatedRequest,
		});
	} catch (error) {
		console.error('Error reviewing access request:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to review access request',
		});
	}
};

/**
 * Get ticket user activity
 */
export const getTicketUserActivity = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const { limit = '50', userId } = req.query;

		// Verify ticket exists in guild
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		const whereClause: any = { ticketId };
		if (userId) {
			whereClause.userId = userId;
		}

		const activity = await prisma.ticketUserActivity.findMany({
			where: whereClause,
			orderBy: { timestamp: 'desc' },
			take: parseInt(limit as string),
		});

		res.json({
			success: true,
			data: activity,
		});
	} catch (error) {
		console.error('Error fetching ticket user activity:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket user activity',
		});
	}
};

/**
 * Get permission presets
 */
export const getPermissionPresets = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;

		const presets = await prisma.ticketPermissionPreset.findMany({
			where: {
				guildId,
				isActive: true,
			},
			orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
		});

		res.json({
			success: true,
			data: presets,
		});
	} catch (error) {
		console.error('Error fetching permission presets:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch permission presets',
		});
	}
};

/**
 * Create a permission preset
 */
export const createPermissionPreset = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(createPresetSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Check if preset name already exists
		const existingPreset = await prisma.ticketPermissionPreset.findFirst({
			where: {
				guildId,
				name: data.name,
			},
		});

		if (existingPreset) {
			res.status(409).json({
				success: false,
				error: 'A preset with this name already exists',
			});
			return;
		}

		// If setting as default, unset other defaults
		if (data.isDefault) {
			await prisma.ticketPermissionPreset.updateMany({
				where: { guildId },
				data: { isDefault: false },
			});
		}

		const preset = await prisma.ticketPermissionPreset.create({
			data: {
				...data,
				guildId,
				createdBy: req.user?.id || 'system',
			},
		});

		res.status(201).json({
			success: true,
			data: preset,
		});
	} catch (error) {
		console.error('Error creating permission preset:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create permission preset',
		});
	}
};

/**
 * Get sharing configuration
 */
export const getSharingConfig = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;

		const config = await prisma.ticketSharingConfig.findUnique({
			where: { guildId },
		});

		res.json({
			success: true,
			data: config,
		});
	} catch (error) {
		console.error('Error fetching sharing config:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch sharing config',
		});
	}
};

/**
 * Update sharing configuration
 */
export const updateSharingConfig = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(updateSharingConfigSchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid request data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		const config = await prisma.ticketSharingConfig.upsert({
			where: { guildId },
			update: data,
			create: {
				guildId,
				...data,
			},
		});

		res.json({
			success: true,
			data: config,
		});
	} catch (error) {
		console.error('Error updating sharing config:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update sharing config',
		});
	}
};
