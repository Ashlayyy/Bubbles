import type { Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { getDiscordEventForwarder } from '../services/discordEventForwarder.js';
import { createLogger } from '../types/shared.js';
import type { ApiResponse } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('api-invites');

// ============================================================================
// INVITE OPERATIONS
// ============================================================================

export const getInvite = async (req: AuthRequest, res: Response) => {
	try {
		const { inviteCode } = req.params;
		const { with_counts, with_expiration, guild_scheduled_event_id } =
			req.query;

		if (!inviteCode) {
			return res.status(400).json({
				success: false,
				error: 'Invite code is required',
			} as ApiResponse);
		}

		const invite = await discordApi.getInvite(
			inviteCode,
			with_counts === 'true',
			with_expiration === 'true',
			guild_scheduled_event_id as string
		);

		res.json({
			success: true,
			data: invite,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching invite:', error);
		res.status(404).json({
			success: false,
			error: 'Invite not found or expired',
		} as ApiResponse);
	}
};

export const deleteInvite = async (req: AuthRequest, res: Response) => {
	try {
		const { inviteCode } = req.params;
		const { reason } = req.body;

		if (!inviteCode) {
			return res.status(400).json({
				success: false,
				error: 'Invite code is required',
			} as ApiResponse);
		}

		// Get invite info before deletion for event forwarding
		const inviteInfo = await discordApi.getInvite(inviteCode);

		const deletedInvite = await discordApi.deleteInvite(inviteCode, reason);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'INVITE_DELETE',
				data: {
					...deletedInvite,
					guild_id: inviteInfo.guild?.id,
					channel_id: inviteInfo.channel?.id,
				},
				guildId: inviteInfo.guild?.id,
				channelId: inviteInfo.channel?.id,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Deleted invite ${inviteCode}`);

		res.json({
			success: true,
			message: 'Invite deleted successfully',
			data: deletedInvite,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error deleting invite:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete invite',
		} as ApiResponse);
	}
};

// ============================================================================
// GUILD INVITE OPERATIONS
// ============================================================================

export const getGuildInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		const invites = await discordApi.getGuildInvites(guildId);

		res.json({
			success: true,
			data: invites,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching guild invites:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild invites',
		} as ApiResponse);
	}
};

// ============================================================================
// CHANNEL INVITE OPERATIONS (Comprehensive)
// ============================================================================

export const createChannelInvite = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const {
			max_age,
			max_uses,
			temporary,
			unique,
			target_type,
			target_user_id,
			target_application_id,
			reason,
		} = req.body;

		if (!channelId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID is required',
			} as ApiResponse);
		}

		const inviteOptions = {
			...(max_age !== undefined && { max_age }),
			...(max_uses !== undefined && { max_uses }),
			...(temporary !== undefined && { temporary }),
			...(unique !== undefined && { unique }),
			...(target_type !== undefined && { target_type }),
			...(target_user_id && { target_user_id }),
			...(target_application_id && { target_application_id }),
		};

		const invite = await discordApi.createChannelInvite(
			channelId,
			inviteOptions,
			reason
		);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'INVITE_CREATE',
				data: invite,
				channelId,
				guildId: invite.guild?.id,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Created invite ${invite.code} for channel ${channelId}`);

		res.json({
			success: true,
			message: 'Channel invite created successfully',
			data: invite,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error creating channel invite:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create channel invite',
		} as ApiResponse);
	}
};

export const getChannelInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;

		if (!channelId) {
			return res.status(400).json({
				success: false,
				error: 'Channel ID is required',
			} as ApiResponse);
		}

		const invites = await discordApi.getChannelInvites(channelId);

		res.json({
			success: true,
			data: invites,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching channel invites:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch channel invites',
		} as ApiResponse);
	}
};

// ============================================================================
// INVITE ANALYTICS & MANAGEMENT
// ============================================================================

export const getInviteAnalytics = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { period = '7d' } = req.query;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		// Get all guild invites
		const invites = await discordApi.getGuildInvites(guildId);

		// Calculate analytics based on invite data
		const analytics = {
			totalInvites: invites.length,
			activeInvites: invites.filter(
				(invite: any) =>
					!invite.revoked &&
					(!invite.expires_at || new Date(invite.expires_at) > new Date())
			).length,
			expiredInvites: invites.filter(
				(invite: any) =>
					invite.expires_at && new Date(invite.expires_at) <= new Date()
			).length,
			revokedInvites: invites.filter((invite: any) => invite.revoked).length,
			totalUses: invites.reduce(
				(sum: number, invite: any) => sum + (invite.uses || 0),
				0
			),
			invitesByCreator: invites.reduce((acc: any, invite: any) => {
				const creatorId = invite.inviter?.id || 'unknown';
				acc[creatorId] = (acc[creatorId] || 0) + 1;
				return acc;
			}, {}),
			invitesByChannel: invites.reduce((acc: any, invite: any) => {
				const channelId = invite.channel?.id || 'unknown';
				acc[channelId] = (acc[channelId] || 0) + 1;
				return acc;
			}, {}),
			usageStats: invites.map((invite: any) => ({
				code: invite.code,
				uses: invite.uses || 0,
				maxUses: invite.max_uses,
				created: invite.created_at,
				expires: invite.expires_at,
				creator: invite.inviter?.username || 'Unknown',
				channel: invite.channel?.name || 'Unknown',
			})),
		};

		res.json({
			success: true,
			data: analytics,
		} as ApiResponse);
	} catch (error) {
		logger.error('Error fetching invite analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch invite analytics',
		} as ApiResponse);
	}
};

export const bulkDeleteInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { inviteCodes, reason } = req.body;

		if (!guildId || !inviteCodes || !Array.isArray(inviteCodes)) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID and invite codes array are required',
			} as ApiResponse);
		}

		const results = [];
		const errors = [];

		for (const inviteCode of inviteCodes) {
			try {
				const deletedInvite = await discordApi.deleteInvite(inviteCode, reason);
				results.push({ inviteCode, status: 'deleted', data: deletedInvite });
			} catch (error) {
				errors.push({
					inviteCode,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		// Broadcast real-time update for successful deletions
		if (results.length > 0) {
			const eventForwarder = getDiscordEventForwarder();
			if (eventForwarder) {
				eventForwarder.forwardDiscordEvent({
					type: 'INVITE_DELETE',
					data: {
						bulk_delete: {
							guild_id: guildId,
							deleted_invites: results.map((r) => r.inviteCode),
							count: results.length,
						},
					},
					guildId,
					userId: req.user?.id,
					timestamp: Date.now(),
				});
			}
		}

		logger.info(
			`Bulk deleted invites in guild ${guildId}: ${results.length} successful, ${errors.length} failed`
		);

		res.json({
			success: true,
			message: `Bulk invite deletion completed: ${results.length} successful, ${errors.length} failed`,
			data: { results, errors },
		} as ApiResponse);
	} catch (error) {
		logger.error('Error in bulk delete invites:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to perform bulk invite deletion',
		} as ApiResponse);
	}
};

export const purgeExpiredInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { reason } = req.body;

		if (!guildId) {
			return res.status(400).json({
				success: false,
				error: 'Guild ID is required',
			} as ApiResponse);
		}

		// Get all guild invites
		const invites = await discordApi.getGuildInvites(guildId);

		// Find expired invites
		const expiredInvites = invites.filter(
			(invite: any) =>
				invite.expires_at && new Date(invite.expires_at) <= new Date()
		);

		const results = [];
		const errors = [];

		for (const invite of expiredInvites) {
			try {
				const deletedInvite = await discordApi.deleteInvite(
					invite.code,
					reason || 'Purging expired invites'
				);
				results.push({
					inviteCode: invite.code,
					status: 'deleted',
					data: deletedInvite,
				});
			} catch (error) {
				errors.push({
					inviteCode: invite.code,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		// Broadcast real-time update
		if (results.length > 0) {
			const eventForwarder = getDiscordEventForwarder();
			if (eventForwarder) {
				eventForwarder.forwardDiscordEvent({
					type: 'INVITE_DELETE',
					data: {
						purge_expired: {
							guild_id: guildId,
							purged_count: results.length,
							purged_invites: results.map((r) => r.inviteCode),
						},
					},
					guildId,
					userId: req.user?.id,
					timestamp: Date.now(),
				});
			}
		}

		logger.info(
			`Purged expired invites in guild ${guildId}: ${results.length} successful, ${errors.length} failed`
		);

		res.json({
			success: true,
			message: `Purged ${results.length} expired invites successfully`,
			data: {
				purged: results.length,
				total_expired: expiredInvites.length,
				results,
				errors,
			},
		} as ApiResponse);
	} catch (error) {
		logger.error('Error purging expired invites:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to purge expired invites',
		} as ApiResponse);
	}
};
