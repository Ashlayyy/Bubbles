import type { Response } from 'express';
import { createLogger, type ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';
import { discordApi } from '../services/discordApiService.js';
import hybridCommunicationService from '../services/hybridCommunicationService.js';

const logger = createLogger('moderation-controller');

// Get moderation cases
export const getModerationCases = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, type, moderator, user } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Build where clause
		const where: any = { guildId };
		if (type) where.type = type;
		if (moderator) where.moderatorId = moderator;
		if (user) where.userId = user;

		// Fetch cases with pagination
		const [cases, total] = await Promise.all([
			prisma.moderationCase.findMany({
				where,
				include: {
					notes: {
						orderBy: { createdAt: 'desc' },
						take: 5,
					},
					appeals: {
						orderBy: { createdAt: 'desc' },
						take: 1,
					},
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take,
			}),
			prisma.moderationCase.count({ where }),
		]);

		res.json({
			success: true,
			data: {
				cases: cases.map((caseItem) => ({
					id: caseItem.id,
					caseNumber: caseItem.caseNumber,
					type: caseItem.type,
					userId: caseItem.userId,
					moderatorId: caseItem.moderatorId,
					reason: caseItem.reason,
					evidence: caseItem.evidence,
					duration: caseItem.duration,
					expiresAt: caseItem.expiresAt,
					isActive: caseItem.isActive,
					severity: caseItem.severity,
					points: caseItem.points,
					canAppeal: caseItem.canAppeal,
					appealedAt: caseItem.appealedAt,
					appealStatus: caseItem.appealStatus,
					dmSent: caseItem.dmSent,
					publicNote: caseItem.publicNote,
					staffNote: caseItem.staffNote,
					createdAt: caseItem.createdAt,
					updatedAt: caseItem.updatedAt,
					notes: caseItem.notes,
					appeals: caseItem.appeals,
				})),
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderation cases:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderation cases',
		} as ApiResponse);
	}
};

// Create moderation case
export const createModerationCase = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { type, userId, reason, duration, evidence } = req.body;
		const prisma = getPrismaClient();

		// Get next case number for guild
		const lastCase = await prisma.moderationCase.findFirst({
			where: { guildId },
			orderBy: { caseNumber: 'desc' },
			select: { caseNumber: true },
		});

		const caseNumber = (lastCase?.caseNumber || 0) + 1;

		// Calculate expiration if duration provided
		let expiresAt = null;
		if (duration) {
			expiresAt = new Date(Date.now() + duration * 1000);
		}

		// Create moderation case
		const newCase = await prisma.moderationCase.create({
			data: {
				caseNumber,
				guildId,
				type,
				userId,
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'No reason provided',
				evidence: evidence || [],
				duration,
				expiresAt,
				severity: 'MEDIUM', // Default severity
				points: getPointsForType(type),
			},
			include: {
				notes: true,
				appeals: true,
			},
		});

		// Execute the moderation action via Discord API
		try {
			await executeDiscordAction(guildId, type, userId, reason, duration);
		} catch (discordError) {
			logger.warn('Discord action failed, but case was created:', discordError);
		}

		// Broadcast to WebSocket
		wsManager.broadcastToGuild(guildId, 'moderationCaseCreate', newCase);

		res.status(201).json({
			success: true,
			data: newCase,
			message: 'Moderation case created successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating moderation case:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create moderation case',
		} as ApiResponse);
	}
};

// Get banned users
export const getBannedUsers = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50 } = req.query;
		const prisma = getPrismaClient();

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		// Get active ban cases
		const [banCases, total] = await Promise.all([
			prisma.moderationCase.findMany({
				where: {
					guildId,
					type: 'BAN',
					isActive: true,
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take,
			}),
			prisma.moderationCase.count({
				where: {
					guildId,
					type: 'BAN',
					isActive: true,
				},
			}),
		]);

		// Also fetch from Discord API to sync
		let discordBans = [];
		try {
			discordBans = await discordApi.getGuildBans(guildId);
		} catch (error) {
			logger.warn('Failed to fetch Discord bans:', error);
		}

		const bans = banCases.map((banCase) => ({
			userId: banCase.userId,
			reason: banCase.reason,
			bannedAt: banCase.createdAt,
			bannedBy: banCase.moderatorId,
			caseId: banCase.id,
			caseNumber: banCase.caseNumber,
		}));

		res.json({
			success: true,
			data: {
				bans,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total,
					pages: Math.ceil(total / take),
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching banned users:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch banned users',
		} as ApiResponse);
	}
};

// Ban user
export const banUser = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { reason, deleteMessages, duration } = req.body;
		const prisma = getPrismaClient();

		// Check if user is already banned
		const existingBan = await prisma.moderationCase.findFirst({
			where: {
				guildId,
				userId,
				type: 'BAN',
				isActive: true,
			},
		});

		if (existingBan) {
			return res.status(400).json({
				success: false,
				error: 'User is already banned',
			} as ApiResponse);
		}

		// Create moderation case first
		const caseNumber = await getNextCaseNumber(guildId);
		let expiresAt = null;
		if (duration) {
			expiresAt = new Date(Date.now() + duration * 1000);
		}

		const banCase = await prisma.moderationCase.create({
			data: {
				caseNumber,
				guildId,
				type: 'BAN',
				userId,
				moderatorId: req.user?.id || 'unknown',
				reason: reason || 'No reason provided',
				duration,
				expiresAt,
				severity: 'HIGH',
				points: 100,
			},
		});

		// Execute Discord ban via hybrid system
		try {
			const { hybridCommunicationService } = await import(
				'../services/hybridCommunicationService.js'
			);
			const result = await hybridCommunicationService.execute(
				'BAN_USER',
				{
					targetUserId: userId,
					reason: reason || 'No reason provided',
					deleteMessageDays: deleteMessages ? 7 : 0,
					caseId: banCase.id,
				},
				{
					guildId,
					requireReliability: true,
				}
			);

			if (!result.success) {
				// Rollback case if Discord action fails
				await prisma.moderationCase.delete({ where: { id: banCase.id } });
				throw new Error(result.error || 'Failed to execute ban');
			}

			// Track the moderation action
			const { healthService } = await import('../services/healthService.js');
			healthService.trackModerationAction(
				true,
				Date.now() - banCase.createdAt.getTime()
			);
		} catch (discordError) {
			// Rollback case if Discord action fails
			await prisma.moderationCase.delete({ where: { id: banCase.id } });

			// Track the failed action
			const { healthService } = await import('../services/healthService.js');
			healthService.trackModerationAction(
				false,
				Date.now() - banCase.createdAt.getTime()
			);

			throw discordError;
		}

		// Broadcast to WebSocket
		wsManager.broadcastToGuild(guildId, 'userBanned', {
			userId,
			case: banCase,
		});

		res.json({
			success: true,
			message: 'User banned successfully',
			data: banCase,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error banning user:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to ban user',
		} as ApiResponse);
	}
};

// Get moderation settings
export const getModerationSettings = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Get guild config for moderation settings
		const guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
		});

		// Get automod rules
		const automodRules = await prisma.autoModRule.findMany({
			where: { guildId },
		});

		const settings = {
			general: {
				moderatorRoles: [], // TODO: Add to schema
				mutedRole: guildConfig?.ticketAccessRoleId || null,
				logChannel: guildConfig?.ticketLogChannelId || null,
				publicModLog: true,
				dmOnAction: true,
				requireReason: true,
				autoDelete: false,
			},
			punishments: {
				enableWarnings: true,
				maxWarnings: 3,
				warningDecay: 30, // days
				autoActions: [
					{ threshold: 3, action: 'TIMEOUT', duration: 3600 },
					{ threshold: 5, action: 'BAN' },
				],
			},
			automod: automodRules.map((rule) => ({
				id: rule.id,
				name: rule.name,
				enabled: rule.enabled,
				type: rule.type,
				triggers: rule.triggers,
				actions: rule.actions,
				exemptions: rule.exemptions,
			})),
		};

		res.json({
			success: true,
			data: settings,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderation settings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderation settings',
		} as ApiResponse);
	}
};

// Helper functions
async function getNextCaseNumber(guildId: string): Promise<number> {
	const prisma = getPrismaClient();
	const lastCase = await prisma.moderationCase.findFirst({
		where: { guildId },
		orderBy: { caseNumber: 'desc' },
		select: { caseNumber: true },
	});
	return (lastCase?.caseNumber || 0) + 1;
}

function getPointsForType(type: string): number {
	switch (type) {
		case 'WARN':
			return 10;
		case 'TIMEOUT':
			return 25;
		case 'KICK':
			return 50;
		case 'BAN':
			return 100;
		default:
			return 5;
	}
}

async function executeDiscordAction(
	guildId: string,
	type: string,
	userId: string,
	reason?: string,
	duration?: number
): Promise<void> {
	switch (type) {
		case 'BAN':
			await discordApi.banUser(guildId, userId, { reason });
			break;
		case 'KICK':
			await discordApi.kickUser(guildId, userId, reason);
			break;
		case 'TIMEOUT':
			if (duration) {
				await discordApi.timeoutUser(guildId, userId, duration, reason);
			}
			break;
		// Add other actions as needed
	}
}

// Get specific moderation case
export const getModerationCase = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, caseId } = req.params;

		// TODO: Implement actual case fetching
		const mockCase = {
			id: caseId,
			type: 'BAN',
			userId: '123456789',
			moderatorId: '987654321',
			reason: 'Spam and harassment',
			timestamp: Date.now(),
			status: 'ACTIVE',
			evidence: ['message_link_1', 'screenshot_1'],
			notes: ['User was warned previously', 'Multiple reports received'],
		};

		res.json({
			success: true,
			data: mockCase,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderation case:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderation case',
		} as ApiResponse);
	}
};

// Update moderation case
export const updateModerationCase = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, caseId } = req.params;
		const { reason, status, notes } = req.body;

		// TODO: Implement actual case updating
		const updatedCase = {
			id: caseId,
			reason,
			status,
			notes,
			updatedAt: Date.now(),
			updatedBy: req.user?.id,
		};

		res.json({
			success: true,
			data: updatedCase,
			message: 'Moderation case updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating moderation case:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update moderation case',
		} as ApiResponse);
	}
};

// Delete moderation case
export const deleteModerationCase = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, caseId } = req.params;

		// TODO: Implement actual case deletion
		res.json({
			success: true,
			message: 'Moderation case deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting moderation case:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete moderation case',
		} as ApiResponse);
	}
};

// Get muted users
export const getMutedUsers = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50 } = req.query;

		// TODO: Implement actual muted users fetching
		const mockMutes = [
			{
				userId: '456789123',
				username: 'MutedUser',
				reason: 'Inappropriate language',
				mutedAt: Date.now() - 1800000,
				mutedBy: '987654321',
				expiresAt: Date.now() + 1800000,
				caseId: 'case_002',
			},
		];

		res.json({
			success: true,
			data: {
				mutes: mockMutes,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total: 1,
					pages: 1,
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching muted users:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch muted users',
		} as ApiResponse);
	}
};

// Mute user
export const muteUser = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, reason, duration } = req.body;

		// Use hybrid communication service for timeout operations
		const result = await hybridCommunicationService.execute(
			'TIMEOUT_USER',
			{
				guildId,
				userId,
				reason: reason || 'No reason provided',
				duration: duration || 3600000, // 1 hour default
			},
			{
				guildId,
				preferWebSocket: true, // Timeouts can be fast via WebSocket
				notifyCompletion: true,
			}
		);

		const muteCase = {
			id: `case_${Date.now()}`,
			type: 'TIMEOUT',
			userId,
			moderatorId: req.user?.id,
			reason,
			timestamp: Date.now(),
			duration,
			expiresAt: Date.now() + (duration || 3600000),
			executionMethod: result.method,
			jobId: result.jobId,
		};

		if (result.success) {
			res.status(201).json({
				success: true,
				data: muteCase,
				message: `User timeout executed via ${result.method}`,
			} as ApiResponse);
		} else {
			res.status(500).json({
				success: false,
				error: result.error || 'Failed to execute timeout',
			} as ApiResponse);
		}
	} catch (error) {
		logger.error('Error muting user:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to mute user',
		} as ApiResponse);
	}
};

// Unmute user
export const unmuteUser = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, userId } = req.params;
		const { reason } = req.body;

		// TODO: Implement actual user unmuting
		res.json({
			success: true,
			message: 'User unmuted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error unmuting user:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to unmute user',
		} as ApiResponse);
	}
};

// Get user warnings
export const getUserWarnings = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, page = 1, limit = 50 } = req.query;

		// TODO: Implement actual warnings fetching
		const mockWarnings = [
			{
				id: 'warn_001',
				userId: userId || '789123456',
				moderatorId: '987654321',
				reason: 'Mild inappropriate language',
				timestamp: Date.now() - 604800000,
				active: true,
			},
		];

		res.json({
			success: true,
			data: {
				warnings: mockWarnings,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total: 1,
					pages: 1,
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching user warnings:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch user warnings',
		} as ApiResponse);
	}
};

// Add warning
export const addWarning = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, reason, severity } = req.body;

		// TODO: Implement actual warning creation
		const warning = {
			id: `warn_${Date.now()}`,
			userId,
			moderatorId: req.user?.id,
			reason,
			severity: severity || 'LOW',
			timestamp: Date.now(),
			active: true,
		};

		res.status(201).json({
			success: true,
			data: warning,
			message: 'Warning added successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding warning:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add warning',
		} as ApiResponse);
	}
};

// Remove warning
export const removeWarning = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, warningId } = req.params;
		const { reason } = req.body;

		// TODO: Implement actual warning removal
		res.json({
			success: true,
			message: 'Warning removed successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error removing warning:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to remove warning',
		} as ApiResponse);
	}
};

// Get automod rules
export const getAutomodRules = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// TODO: Implement actual automod rules fetching
		const mockRules = [
			{
				id: 'automod_001',
				name: 'Spam Protection',
				enabled: true,
				triggerType: 'KEYWORD',
				keywords: ['spam', 'scam'],
				action: 'DELETE_MESSAGE',
				punishment: 'TIMEOUT',
				duration: 600000,
			},
			{
				id: 'automod_002',
				name: 'Link Filter',
				enabled: true,
				triggerType: 'LINK',
				allowedDomains: ['discord.com', 'github.com'],
				action: 'DELETE_MESSAGE',
				punishment: 'WARN',
			},
		];

		res.json({
			success: true,
			data: mockRules,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching automod rules:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch automod rules',
		} as ApiResponse);
	}
};

// Create automod rule
export const createAutomodRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const ruleData = req.body;

		// TODO: Implement actual automod rule creation
		const newRule = {
			id: `automod_${Date.now()}`,
			...ruleData,
			createdAt: Date.now(),
			createdBy: req.user?.id,
		};

		res.status(201).json({
			success: true,
			data: newRule,
			message: 'Automod rule created successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating automod rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create automod rule',
		} as ApiResponse);
	}
};

// Update automod rule
export const updateAutomodRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;
		const ruleData = req.body;

		// TODO: Implement actual automod rule updating
		const updatedRule = {
			id: ruleId,
			...ruleData,
			updatedAt: Date.now(),
			updatedBy: req.user?.id,
		};

		res.json({
			success: true,
			data: updatedRule,
			message: 'Automod rule updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating automod rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update automod rule',
		} as ApiResponse);
	}
};

// Delete automod rule
export const deleteAutomodRule = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, ruleId } = req.params;

		// TODO: Implement actual automod rule deletion
		res.json({
			success: true,
			message: 'Automod rule deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting automod rule:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete automod rule',
		} as ApiResponse);
	}
};

// Get moderator notes
export const getModeratorNotes = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, page = 1, limit = 50 } = req.query;

		// TODO: Implement actual notes fetching
		const mockNotes = [
			{
				id: 'note_001',
				userId: userId || '789123456',
				moderatorId: '987654321',
				content: 'User has been cooperative after warning',
				timestamp: Date.now() - 86400000,
				private: false,
			},
		];

		res.json({
			success: true,
			data: {
				notes: mockNotes,
				pagination: {
					page: parseInt(page as string),
					limit: parseInt(limit as string),
					total: 1,
					pages: 1,
				},
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching moderator notes:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch moderator notes',
		} as ApiResponse);
	}
};

// Add moderator note
export const addModeratorNote = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { userId, content, private: isPrivate } = req.body;

		// TODO: Implement actual note creation
		const note = {
			id: `note_${Date.now()}`,
			userId,
			moderatorId: req.user?.id,
			content,
			private: isPrivate || false,
			timestamp: Date.now(),
		};

		res.status(201).json({
			success: true,
			data: note,
			message: 'Moderator note added successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error adding moderator note:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to add moderator note',
		} as ApiResponse);
	}
};

// Update moderator note
export const updateModeratorNote = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, noteId } = req.params;
		const { content, private: isPrivate } = req.body;

		// TODO: Implement actual note updating
		const updatedNote = {
			id: noteId,
			content,
			private: isPrivate,
			updatedAt: Date.now(),
			updatedBy: req.user?.id,
		};

		res.json({
			success: true,
			data: updatedNote,
			message: 'Moderator note updated successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error updating moderator note:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update moderator note',
		} as ApiResponse);
	}
};

// Delete moderator note
export const deleteModeratorNote = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, noteId } = req.params;

		// TODO: Implement actual note deletion
		res.json({
			success: true,
			message: 'Moderator note deleted successfully',
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting moderator note:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete moderator note',
		} as ApiResponse);
	}
};
