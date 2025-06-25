import type { Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { getDiscordEventForwarder } from '../services/discordEventForwarder.js';
import { createLogger } from '../types/shared.js';
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
			return res.failure('Invite code is required', 400);
		}

		const invite = await discordApi.getInvite(
			inviteCode,
			with_counts === 'true',
			with_expiration === 'true',
			guild_scheduled_event_id as string
		);

		res.success(invite);
	} catch (error) {
		logger.error('Error fetching invite:', error);
		res.failure('Invite not found or expired', 404);
	}
};

export const deleteInvite = async (req: AuthRequest, res: Response) => {
	try {
		const { inviteCode } = req.params;
		const { reason } = req.body;

		if (!inviteCode) {
			return res.failure('Invite code is required', 400);
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

		res.success({
			message: 'Invite deleted successfully',
			data: deletedInvite,
		});
	} catch (error) {
		logger.error('Error deleting invite:', error);
		res.failure('Failed to delete invite', 500);
	}
};

// ============================================================================
// GUILD INVITE OPERATIONS
// ============================================================================

export const getGuildInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		if (!guildId) {
			return res.failure('Guild ID is required', 400);
		}

		const invites = await discordApi.getGuildInvites(guildId);

		res.success(invites);
	} catch (error) {
		logger.error('Error fetching guild invites:', error);
		res.failure('Failed to fetch guild invites', 500);
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
			return res.failure('Channel ID is required', 400);
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

		res.success({
			message: 'Channel invite created successfully',
			data: invite,
		});
	} catch (error) {
		logger.error('Error creating channel invite:', error);
		res.failure('Failed to create channel invite', 500);
	}
};

export const getChannelInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;

		if (!channelId) {
			return res.failure('Channel ID is required', 400);
		}

		const invites = await discordApi.getChannelInvites(channelId);

		res.success(invites);
	} catch (error) {
		logger.error('Error fetching channel invites:', error);
		res.failure('Failed to fetch channel invites', 500);
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
			return res.failure('Guild ID is required', 400);
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

		res.success(analytics);
	} catch (error) {
		logger.error('Error fetching invite analytics:', error);
		res.failure('Failed to fetch invite analytics', 500);
	}
};

export const bulkDeleteInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { inviteCodes, reason } = req.body;

		if (!guildId || !inviteCodes || !Array.isArray(inviteCodes)) {
			return res.failure('Guild ID and invite codes array are required', 400);
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

		res.success({
			message: `Bulk invite deletion completed: ${results.length} successful, ${errors.length} failed`,
			data: { results, errors },
		});
	} catch (error) {
		logger.error('Error in bulk delete invites:', error);
		res.failure('Failed to perform bulk invite deletion', 500);
	}
};

export const purgeExpiredInvites = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { reason } = req.body;

		if (!guildId) {
			return res.failure('Guild ID is required', 400);
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

		res.success({
			message: `Purged ${results.length} expired invites successfully`,
			data: {
				purged: results.length,
				total_expired: expiredInvites.length,
				results,
				errors,
			},
		});
	} catch (error) {
		logger.error('Error purging expired invites:', error);
		res.failure('Failed to purge expired invites', 500);
	}
};
