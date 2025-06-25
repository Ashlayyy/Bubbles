import type { Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';
import { getDiscordEventForwarder } from '../services/discordEventForwarder.js';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';

const logger = createLogger('api-channels');

// ============================================================================
// CHANNEL OPERATIONS
// ============================================================================

export const getChannel = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;

		if (!channelId) {
			return res.failure('Channel ID is required', 400);
		}

		const channel = await discordApi.getChannel(channelId);

		res.success(channel);
	} catch (error) {
		logger.error('Error fetching channel:', error);
		res.failure('Failed to fetch channel', 500);
	}
};

export const createChannel = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const {
			name,
			type,
			topic,
			bitrate,
			user_limit,
			rate_limit_per_user,
			position,
			permission_overwrites,
			parent_id,
			nsfw,
			rtc_region,
			video_quality_mode,
			default_auto_archive_duration,
			default_reaction_emoji,
			available_tags,
			default_sort_order,
			default_forum_layout,
			default_thread_rate_limit_per_user,
			reason,
		} = req.body;

		if (!guildId || !name) {
			return res.failure('Guild ID and channel name are required', 400);
		}

		const channelOptions = {
			name,
			...(type !== undefined && { type }),
			...(topic && { topic }),
			...(bitrate && { bitrate }),
			...(user_limit && { user_limit }),
			...(rate_limit_per_user && { rate_limit_per_user }),
			...(position !== undefined && { position }),
			...(permission_overwrites && { permission_overwrites }),
			...(parent_id && { parent_id }),
			...(nsfw !== undefined && { nsfw }),
			...(rtc_region && { rtc_region }),
			...(video_quality_mode && { video_quality_mode }),
			...(default_auto_archive_duration && { default_auto_archive_duration }),
			...(default_reaction_emoji && { default_reaction_emoji }),
			...(available_tags && { available_tags }),
			...(default_sort_order && { default_sort_order }),
			...(default_forum_layout && { default_forum_layout }),
			...(default_thread_rate_limit_per_user && {
				default_thread_rate_limit_per_user,
			}),
		};

		const channel = await discordApi.createChannel(guildId, channelOptions);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'CHANNEL_CREATE',
				data: channel,
				guildId,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Created channel ${channel.id} in guild ${guildId}`);

		res.success({
			message: 'Channel created successfully',
			data: channel,
		});
	} catch (error) {
		logger.error('Error creating channel:', error);
		res.failure('Failed to create channel', 500);
	}
};

export const modifyChannel = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const {
			name,
			type,
			position,
			topic,
			nsfw,
			rate_limit_per_user,
			bitrate,
			user_limit,
			permission_overwrites,
			parent_id,
			rtc_region,
			video_quality_mode,
			default_auto_archive_duration,
			flags,
			available_tags,
			default_reaction_emoji,
			default_thread_rate_limit_per_user,
			default_sort_order,
			default_forum_layout,
			reason,
		} = req.body;

		if (!channelId) {
			return res.failure('Channel ID is required', 400);
		}

		const modifyOptions = {
			...(name && { name }),
			...(type !== undefined && { type }),
			...(position !== undefined && { position }),
			...(topic !== undefined && { topic }),
			...(nsfw !== undefined && { nsfw }),
			...(rate_limit_per_user !== undefined && { rate_limit_per_user }),
			...(bitrate && { bitrate }),
			...(user_limit !== undefined && { user_limit }),
			...(permission_overwrites && { permission_overwrites }),
			...(parent_id !== undefined && { parent_id }),
			...(rtc_region !== undefined && { rtc_region }),
			...(video_quality_mode && { video_quality_mode }),
			...(default_auto_archive_duration && { default_auto_archive_duration }),
			...(flags !== undefined && { flags }),
			...(available_tags && { available_tags }),
			...(default_reaction_emoji !== undefined && { default_reaction_emoji }),
			...(default_thread_rate_limit_per_user !== undefined && {
				default_thread_rate_limit_per_user,
			}),
			...(default_sort_order !== undefined && { default_sort_order }),
			...(default_forum_layout !== undefined && { default_forum_layout }),
		};

		const channel = await discordApi.modifyChannel(
			channelId,
			modifyOptions,
			reason
		);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'CHANNEL_UPDATE',
				data: channel,
				channelId,
				guildId: channel.guild_id,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Modified channel ${channelId}`);

		res.success({
			message: 'Channel modified successfully',
			data: channel,
		});
	} catch (error) {
		logger.error('Error modifying channel:', error);
		res.failure('Failed to modify channel', 500);
	}
};

export const deleteChannel = async (req: AuthRequest, res: Response) => {
	try {
		const { channelId } = req.params;
		const { reason } = req.body;

		if (!channelId) {
			return res.failure('Channel ID is required', 400);
		}

		// Get channel info before deletion for event forwarding
		const channelInfo = await discordApi.getChannel(channelId);

		await discordApi.deleteChannel(channelId, reason);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'CHANNEL_DELETE',
				data: channelInfo,
				channelId,
				guildId: channelInfo.guild_id,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(`Deleted channel ${channelId}`);

		res.success({
			message: 'Channel deleted successfully',
		});
	} catch (error) {
		logger.error('Error deleting channel:', error);
		res.failure('Failed to delete channel', 500);
	}
};

// ============================================================================
// CHANNEL PERMISSIONS
// ============================================================================

export const editChannelPermissions = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { channelId, overwriteId } = req.params;
		const { allow, deny, type, reason } = req.body;

		if (!channelId || !overwriteId) {
			return res.failure('Channel ID and overwrite ID are required', 400);
		}

		if (allow === undefined && deny === undefined) {
			return res.failure(
				'At least one of allow or deny permissions must be provided',
				400
			);
		}

		const permissionOptions = {
			...(allow !== undefined && { allow }),
			...(deny !== undefined && { deny }),
			...(type !== undefined && { type }),
		};

		await discordApi.editChannelPermissions(
			channelId,
			overwriteId,
			permissionOptions,
			reason
		);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'CHANNEL_UPDATE',
				data: {
					id: channelId,
					permission_overwrites: [{ id: overwriteId, ...permissionOptions }],
				},
				channelId,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(
			`Updated permissions for overwrite ${overwriteId} in channel ${channelId}`
		);

		res.success({ message: 'Channel permissions updated successfully' });
	} catch (error) {
		logger.error('Error updating channel permissions:', error);
		res.failure('Failed to update channel permissions', 500);
	}
};

export const deleteChannelPermission = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { channelId, overwriteId } = req.params;
		const { reason } = req.body;

		if (!channelId || !overwriteId) {
			return res.failure('Channel ID and overwrite ID are required', 400);
		}

		await discordApi.deleteChannelPermission(channelId, overwriteId, reason);

		// Broadcast real-time update
		const eventForwarder = getDiscordEventForwarder();
		if (eventForwarder) {
			eventForwarder.forwardDiscordEvent({
				type: 'CHANNEL_UPDATE',
				data: { id: channelId, deleted_permission_overwrite: overwriteId },
				channelId,
				userId: req.user?.id,
				timestamp: Date.now(),
			});
		}

		logger.info(
			`Deleted permission overwrite ${overwriteId} from channel ${channelId}`
		);

		res.success({ message: 'Channel permission deleted successfully' });
	} catch (error) {
		logger.error('Error deleting channel permission:', error);
		res.failure('Failed to delete channel permission', 500);
	}
};

// ============================================================================
// CHANNEL INVITES
// ============================================================================

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
