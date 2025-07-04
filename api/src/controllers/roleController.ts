import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';

const logger = createLogger('role-controller');

// Helper function to create WebSocket messages
function createWebSocketMessage(event: string, data: any) {
	return {
		type: 'ROLE_EVENT',
		event,
		data,
		timestamp: Date.now(),
		messageId: `msg_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 9)}`,
	};
}

// Get all roles for a guild
export const getRoles = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { includeMembers = false, includePermissions = false } = req.query;

		// Get roles from Discord API
		const discordRoles = await discordApi.getGuildRoles(guildId);

		// Get role configurations from database
		const prisma = getPrismaClient();
		const roleConfigs = await prisma.roleConfig.findMany({
			where: { guildId },
		});

		// Merge Discord roles with database configurations
		const rolesWithConfig = discordRoles.map((role: any) => {
			const config = roleConfigs.find((c: any) => c.roleId === role.id);

			return {
				id: role.id,
				name: role.name,
				color: role.color,
				position: role.position,
				permissions:
					includePermissions === 'true' ? role.permissions : undefined,
				mentionable: role.mentionable,
				hoist: role.hoist,
				managed: role.managed,
				memberCount: includeMembers === 'true' ? 0 : undefined, // Would need separate call
				config: config
					? {
							id: config.id,
							autoAssign: config.autoAssign,
							selfAssignable: config.selfAssignable,
							requiredRoles: config.requiredRoles,
							blacklistedRoles: config.blacklistedRoles,
							maxUses: config.maxUses,
							currentUses: config.currentUses,
							description: config.description,
							category: config.category,
							enabled: config.enabled,
					  }
					: null,
			};
		});

		res.success({
			roles: rolesWithConfig,
			total: rolesWithConfig.length,
		});
	} catch (error) {
		logger.error('Error fetching roles:', error);
		res.failure('Failed to fetch roles', 500);
	}
};

// Get single role with detailed information
export const getRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const prisma = getPrismaClient();

		// Get roles from Discord API and find the specific role
		const discordRoles = await discordApi.getGuildRoles(guildId);
		const discordRole = discordRoles.find((r: any) => r.id === roleId);

		if (!discordRole) {
			return res.status(404).json({
				success: false,
				error: 'Role not found',
			} as ApiResponse);
		}

		// Get role configuration from database
		const roleConfig = await prisma.roleConfig.findFirst({
			where: { guildId, roleId },
		});

		// Get recent role assignments/removals
		const recentActivity = await prisma.roleLog.findMany({
			where: { guildId, roleId },
			orderBy: { timestamp: 'desc' },
			take: 50,
		});

		const roleWithDetails = {
			id: discordRole.id,
			name: discordRole.name,
			color: discordRole.color,
			position: discordRole.position,
			permissions: discordRole.permissions,
			mentionable: discordRole.mentionable,
			hoist: discordRole.hoist,
			managed: discordRole.managed,
			config: roleConfig
				? {
						id: roleConfig.id,
						autoAssign: roleConfig.autoAssign,
						selfAssignable: roleConfig.selfAssignable,
						requiredRoles: roleConfig.requiredRoles,
						blacklistedRoles: roleConfig.blacklistedRoles,
						maxUses: roleConfig.maxUses,
						currentUses: roleConfig.currentUses,
						description: roleConfig.description,
						category: roleConfig.category,
						enabled: roleConfig.enabled,
						createdAt: roleConfig.createdAt,
						updatedAt: roleConfig.updatedAt,
				  }
				: null,
			recentActivity: recentActivity.map((log: any) => ({
				id: log.id,
				userId: log.userId,
				action: log.action,
				moderatorId: log.moderatorId,
				reason: log.reason,
				timestamp: log.timestamp,
			})),
		};

		res.success(roleWithDetails);
	} catch (error) {
		logger.error('Error fetching role:', error);
		res.failure('Failed to fetch role', 500);
	}
};

// Create new role
export const createRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			name,
			color = 0,
			permissions = '0',
			hoist = false,
			mentionable = false,
			reason,
			config,
		} = req.body;

		// Create role via Discord API
		const newRole = await discordApi.createRole(
			guildId,
			{
				name,
				color,
				permissions,
				hoist,
				mentionable,
			},
			reason
		);

		// Create role configuration if provided
		let roleConfig = null;
		if (config) {
			const prisma = getPrismaClient();
			roleConfig = await prisma.roleConfig.create({
				data: {
					guildId,
					roleId: newRole.id,
					autoAssign: config.autoAssign || false,
					selfAssignable: config.selfAssignable || false,
					requiredRoles: config.requiredRoles || [],
					blacklistedRoles: config.blacklistedRoles || [],
					maxUses: config.maxUses || null,
					currentUses: 0,
					description: config.description || null,
					category: config.category || 'general',
					enabled: config.enabled !== false,
				},
			});
		}

		// Log role creation
		const prisma = getPrismaClient();
		await prisma.roleLog.create({
			data: {
				guildId,
				roleId: newRole.id,
				userId: req.user?.id || null,
				action: 'CREATE',
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'Role created via API',
		});

		// Broadcast role creation
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('roleCreate', {
				role: newRole,
				config: roleConfig,
			})
		);

		logger.info(`Created role '${name}' for guild ${guildId}`, {
			roleId: newRole.id,
		});

		res.success(
			{
				role: newRole,
				config: roleConfig,
			},
			201
		);
	} catch (error) {
		logger.error('Error creating role:', error);
		res.failure('Failed to create role', 500);
	}
};

// Update role
export const updateRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const { roleData, config } = req.body;
		const prisma = getPrismaClient();

		// Update role via Discord API if role data provided
		let updatedRole = null;
		if (roleData) {
			updatedRole = await discordApi.modifyGuildRole(guildId, roleId, roleData);
		}

		// Update role configuration if provided
		let updatedConfig = null;
		if (config) {
			updatedConfig = await prisma.roleConfig.upsert({
				where: {
					guildId_roleId: { guildId, roleId },
				},
				update: {
					...config,
					updatedAt: new Date(),
				},
				create: {
					guildId,
					roleId,
					autoAssign: config.autoAssign || false,
					selfAssignable: config.selfAssignable || false,
					requiredRoles: config.requiredRoles || [],
					blacklistedRoles: config.blacklistedRoles || [],
					maxUses: config.maxUses || null,
					currentUses: config.currentUses || 0,
					description: config.description || null,
					category: config.category || 'general',
					enabled: config.enabled !== false,
				},
			});
		}

		// Log role update
		await prisma.roleLog.create({
			data: {
				guildId,
				roleId,
				userId: 'system',
				action: 'UPDATE',
				moderatorId: req.user?.id || 'unknown',
				reason: 'Role updated via API',
			},
		});

		// Broadcast role update
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('roleUpdate', {
				role: updatedRole,
				config: updatedConfig,
			})
		);

		logger.info(`Updated role ${roleId} for guild ${guildId}`);

		res.success({
			role: updatedRole,
			config: updatedConfig,
		});
	} catch (error) {
		logger.error('Error updating role:', error);
		res.failure('Failed to update role', 500);
	}
};

// Delete role
export const deleteRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const { reason } = req.body;
		const prisma = getPrismaClient();

		// Delete role via Discord API
		await discordApi.deleteGuildRole(guildId, roleId, reason);

		// Delete role configuration from database
		try {
			await prisma.roleConfig.delete({
				where: {
					guildId_roleId: { guildId, roleId },
				},
			});
		} catch (error) {
			// Role config might not exist, which is fine
			logger.debug('No role config to delete:', error);
		}

		// Log role deletion
		await prisma.roleLog.create({
			data: {
				guildId,
				roleId,
				userId: 'system',
				action: 'DELETE',
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'Role deleted via API',
			},
		});

		// Broadcast role deletion
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('roleDelete', { roleId })
		);

		logger.info(`Deleted role ${roleId} for guild ${guildId}`);

		res.success({ message: 'Role deleted successfully' });
	} catch (error) {
		logger.error('Error deleting role:', error);
		res.failure('Failed to delete role', 500);
	}
};

// Assign role to user
export const assignRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const { userId, reason } = req.body;
		const prisma = getPrismaClient();

		// Check role configuration for restrictions
		const roleConfig = await prisma.roleConfig.findFirst({
			where: { guildId, roleId },
		});

		if (roleConfig && !roleConfig.enabled) {
			return res.failure('Role assignment is disabled', 400);
		}

		if (roleConfig?.maxUses && roleConfig.currentUses >= roleConfig.maxUses) {
			return res.failure('Role has reached maximum usage limit', 400);
		}

		// Assign role via Discord API
		await discordApi.addRoleToMember(guildId, userId, roleId, reason);

		// Update usage counter
		if (roleConfig) {
			await prisma.roleConfig.update({
				where: { id: roleConfig.id },
				data: { currentUses: { increment: 1 } },
			});
		}

		// Log role assignment
		await prisma.roleLog.create({
			data: {
				guildId,
				roleId,
				userId,
				action: 'ASSIGN',
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'Role assigned via API',
			},
		});

		// Broadcast role assignment
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('roleAssign', {
				userId,
				roleId,
				moderatorId: req.user?.id,
			})
		);

		logger.info(
			`Assigned role ${roleId} to user ${userId} in guild ${guildId}`
		);

		res.success({ message: 'Role assigned successfully' });
	} catch (error) {
		logger.error('Error assigning role:', error);
		res.failure('Failed to assign role', 500);
	}
};

// Remove role from user
export const removeRole = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, roleId } = req.params;
		const { userId, reason } = req.body;
		const prisma = getPrismaClient();

		// Remove role via Discord API
		await discordApi.removeRoleFromMember(guildId, userId, roleId, reason);

		// Update usage counter
		const roleConfig = await prisma.roleConfig.findFirst({
			where: { guildId, roleId },
		});

		if (roleConfig && roleConfig.currentUses > 0) {
			await prisma.roleConfig.update({
				where: { id: roleConfig.id },
				data: { currentUses: Math.max(0, roleConfig.currentUses - 1) },
			});
		}

		// Log role removal
		await prisma.roleLog.create({
			data: {
				guildId,
				roleId,
				userId,
				action: 'REMOVE',
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'Role removed via API',
			},
		});

		// Broadcast role removal
		wsManager.broadcastToGuild(
			guildId,
			createWebSocketMessage('roleRemove', {
				userId,
				roleId,
				moderatorId: req.user?.id,
			})
		);

		logger.info(
			`Removed role ${roleId} from user ${userId} in guild ${guildId}`
		);

		res.success({ message: 'Role removed successfully' });
	} catch (error) {
		logger.error('Error removing role:', error);
		res.failure('Failed to remove role', 500);
	}
};

// Get auto-role settings
export const getAutoRoleSettings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const autoRoles = await prisma.roleConfig.findMany({
			where: {
				guildId,
				autoAssign: true,
				enabled: true,
			},
			orderBy: { createdAt: 'desc' },
		});

		const settings = {
			enabled: autoRoles.length > 0,
			roles: autoRoles.map((role: any) => ({
				id: role.id,
				roleId: role.roleId,
				description: role.description,
				category: role.category,
				requiredRoles: role.requiredRoles,
				blacklistedRoles: role.blacklistedRoles,
				maxUses: role.maxUses,
				currentUses: role.currentUses,
			})),
		};

		res.success(settings);
	} catch (error) {
		logger.error('Error fetching auto-role settings:', error);
		res.failure('Failed to fetch auto-role settings', 500);
	}
};

// Get role logs
export const getRoleLogs = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, roleId, userId, action } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (roleId) where.roleId = roleId;
		if (userId) where.userId = userId;
		if (action) where.action = action;

		// Fetch logs with pagination
		const [logs, total] = await Promise.all([
			prisma.roleLog.findMany({
				where,
				orderBy: { timestamp: 'desc' },
				skip,
				take,
			}),
			prisma.roleLog.count({ where }),
		]);

		res.success({
			logs,
			pagination: {
				page: parseInt(page as string),
				limit: parseInt(limit as string),
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching role logs:', error);
		res.failure('Failed to fetch role logs', 500);
	}
};

// Get role statistics
export const getRoleStatistics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;
		const prisma = getPrismaClient();

		const periodMs = parsePeriod(period as string);
		const startDate = new Date(Date.now() - periodMs);

		// Get role activity counts
		const [totalLogs, actionBreakdown] = await Promise.all([
			prisma.roleLog.count({
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
			}),
			prisma.roleLog.groupBy({
				by: ['action'],
				where: {
					guildId,
					timestamp: { gte: startDate },
				},
				_count: { action: true },
			}),
		]);

		// Get most active roles
		const topRoles = await prisma.roleLog.groupBy({
			by: ['roleId'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { roleId: true },
			orderBy: { _count: { roleId: 'desc' } },
			take: 10,
		});

		// Get daily activity
		const dailyActivity = await prisma.roleLog.groupBy({
			by: ['timestamp'],
			where: {
				guildId,
				timestamp: { gte: startDate },
			},
			_count: { timestamp: true },
		});

		// Process daily activity
		const dailyMap = new Map();
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
				totalActivity: totalLogs,
				averagePerDay: Math.round(
					totalLogs / Math.max(1, periodMs / (24 * 60 * 60 * 1000))
				),
			},
			actions: {
				assigns:
					actionBreakdown.find((a: any) => a.action === 'ASSIGN')?._count
						.action || 0,
				removes:
					actionBreakdown.find((a: any) => a.action === 'REMOVE')?._count
						.action || 0,
				creates:
					actionBreakdown.find((a: any) => a.action === 'CREATE')?._count
						.action || 0,
				updates:
					actionBreakdown.find((a: any) => a.action === 'UPDATE')?._count
						.action || 0,
				deletes:
					actionBreakdown.find((a: any) => a.action === 'DELETE')?._count
						.action || 0,
			},
			topRoles: topRoles.map((role: any) => ({
				roleId: role.roleId,
				activity: role._count.roleId,
			})),
			dailyActivity: Array.from(dailyMap.entries()).map(([date, count]) => ({
				date,
				count,
			})),
		};

		res.success(statistics);
	} catch (error) {
		logger.error('Error fetching role statistics:', error);
		res.failure('Failed to fetch role statistics', 500);
	}
};

// Helper function
function parsePeriod(period: string): number {
	const match = period.match(/^(\d+)([dwmy])$/);
	if (!match) return 7 * 24 * 60 * 60 * 1000;

	const [, amount, unit] = match;
	const num = parseInt(amount);

	// Validate the number is positive and reasonable
	if (num <= 0 || num > 100) {
		return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
	}

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
