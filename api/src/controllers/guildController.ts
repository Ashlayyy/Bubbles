import { Request, Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';
import { createLogger } from '../types/shared.js';

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		username: string;
		guilds: string[];
	};
}

const logger = createLogger('guild-controller');

export const getGuilds = async (req: AuthenticatedRequest, res: Response) => {
	try {
		// Fetch guilds from Discord API
		const guilds = await discordApi.getGuilds();

		// Filter guilds the user has access to based on their permissions
		const userGuilds = guilds.filter(
			(guild) => req.user?.guilds?.includes(guild.id) || guild.owner
		);

		res.json({
			success: true,
			data: {
				guilds: userGuilds.map((guild) => ({
					id: guild.id,
					name: guild.name,
					icon: guild.icon,
					owner: guild.owner,
					permissions: guild.permissions,
					memberCount: guild.approximate_member_count,
					description: guild.description,
					features: guild.features,
				})),
				total: userGuilds.length,
			},
		});
	} catch (error) {
		logger.error('Failed to fetch guilds:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guilds',
		});
	}
};

export const getGuild = async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// Fetch guild details from Discord API
		const guild = await discordApi.getGuild(guildId);
		const channels = await discordApi.getGuildChannels(guildId);
		const roles = await discordApi.getGuildRoles(guildId);

		const guildData = {
			id: guild.id,
			name: guild.name,
			description: guild.description,
			icon: guild.icon,
			banner: guild.banner,
			splash: guild.splash,
			ownerId: guild.owner_id,
			afkChannelId: guild.afk_channel_id,
			afkTimeout: guild.afk_timeout,
			verificationLevel: guild.verification_level,
			defaultMessageNotifications: guild.default_message_notifications,
			explicitContentFilter: guild.explicit_content_filter,
			features: guild.features,
			mfaLevel: guild.mfa_level,
			systemChannelId: guild.system_channel_id,
			systemChannelFlags: guild.system_channel_flags,
			rulesChannelId: guild.rules_channel_id,
			maxPresences: guild.max_presences,
			maxMembers: guild.max_members,
			vanityUrlCode: guild.vanity_url_code,
			premiumTier: guild.premium_tier,
			premiumSubscriptionCount: guild.premium_subscription_count,
			preferredLocale: guild.preferred_locale,
			publicUpdatesChannelId: guild.public_updates_channel_id,
			maxVideoChannelUsers: guild.max_video_channel_users,
			nsfwLevel: guild.nsfw_level,
			premiumProgressBarEnabled: guild.premium_progress_bar_enabled,
			memberCount: guild.approximate_member_count,
			channels: channels.map((channel) => ({
				id: channel.id,
				name: channel.name,
				type: channel.type,
				position: channel.position,
				parentId: channel.parent_id,
				permissionOverwrites: channel.permission_overwrites,
			})),
			roles: roles.map((role) => ({
				id: role.id,
				name: role.name,
				color: role.color,
				hoist: role.hoist,
				position: role.position,
				permissions: role.permissions,
				managed: role.managed,
				mentionable: role.mentionable,
			})),
		};

		res.json({
			success: true,
			data: guildData,
		});
	} catch (error) {
		logger.error(`Failed to fetch guild ${req.params.guildId}:`, error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild details',
		});
	}
};

export const getGuildMembers = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
		const after = req.query.after as string;

		// Fetch members from Discord API
		const members = await discordApi.getGuildMembers(guildId, limit, after);

		res.json({
			success: true,
			data: {
				members: members.map((member) => ({
					user: {
						id: member.user.id,
						username: member.user.username,
						discriminator: member.user.discriminator,
						globalName: member.user.global_name,
						avatar: member.user.avatar,
						bot: member.user.bot,
						system: member.user.system,
						mfaEnabled: member.user.mfa_enabled,
						verified: member.user.verified,
						flags: member.user.flags,
						premiumType: member.user.premium_type,
						publicFlags: member.user.public_flags,
					},
					nick: member.nick,
					avatar: member.avatar,
					roles: member.roles,
					joinedAt: member.joined_at,
					premiumSince: member.premium_since,
					deaf: member.deaf,
					mute: member.mute,
					flags: member.flags,
					pending: member.pending,
					permissions: member.permissions,
					communicationDisabledUntil: member.communication_disabled_until,
				})),
				hasMore: members.length === limit,
			},
		});
	} catch (error) {
		logger.error(
			`Failed to fetch members for guild ${req.params.guildId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild members',
		});
	}
};

export const getGuildChannels = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;

		// Fetch channels from Discord API
		const channels = await discordApi.getGuildChannels(guildId);

		res.json({
			success: true,
			data: {
				channels: channels.map((channel) => ({
					id: channel.id,
					name: channel.name,
					type: channel.type,
					position: channel.position,
					permissionOverwrites: channel.permission_overwrites,
					topic: channel.topic,
					nsfw: channel.nsfw,
					lastMessageId: channel.last_message_id,
					bitrate: channel.bitrate,
					userLimit: channel.user_limit,
					rateLimitPerUser: channel.rate_limit_per_user,
					recipients: channel.recipients,
					icon: channel.icon,
					ownerId: channel.owner_id,
					applicationId: channel.application_id,
					parentId: channel.parent_id,
					lastPinTimestamp: channel.last_pin_timestamp,
					rtcRegion: channel.rtc_region,
					videoQualityMode: channel.video_quality_mode,
					messageCount: channel.message_count,
					memberCount: channel.member_count,
					threadMetadata: channel.thread_metadata,
					member: channel.member,
					defaultAutoArchiveDuration: channel.default_auto_archive_duration,
					permissions: channel.permissions,
					flags: channel.flags,
					totalMessageSent: channel.total_message_sent,
					availableTags: channel.available_tags,
					appliedTags: channel.applied_tags,
					defaultReactionEmoji: channel.default_reaction_emoji,
					defaultThreadRateLimitPerUser:
						channel.default_thread_rate_limit_per_user,
					defaultSortOrder: channel.default_sort_order,
					defaultForumLayout: channel.default_forum_layout,
				})),
				total: channels.length,
			},
		});
	} catch (error) {
		logger.error(
			`Failed to fetch channels for guild ${req.params.guildId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild channels',
		});
	}
};

export const getGuildRoles = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;

		// Fetch roles from Discord API
		const roles = await discordApi.getGuildRoles(guildId);

		res.json({
			success: true,
			data: {
				roles: roles.map((role) => ({
					id: role.id,
					name: role.name,
					color: role.color,
					hoist: role.hoist,
					icon: role.icon,
					unicodeEmoji: role.unicode_emoji,
					position: role.position,
					permissions: role.permissions,
					managed: role.managed,
					mentionable: role.mentionable,
					tags: role.tags,
					flags: role.flags,
				})),
				total: roles.length,
			},
		});
	} catch (error) {
		logger.error(
			`Failed to fetch roles for guild ${req.params.guildId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild roles',
		});
	}
};

export const updateGuild = async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const updates = req.body;

		// Send command to bot via WebSocket
		const command = {
			command: 'UPDATE_GUILD',
			data: {
				guildId,
				updates,
			},
		};

		// Broadcast to bot connections
		wsManager.broadcast(
			{
				type: 'BOT_COMMAND',
				event: 'UPDATE_GUILD',
				data: command,
				guildId,
				timestamp: Date.now(),
				messageId: `update-guild-${Date.now()}`,
			},
			['BOT']
		);

		// Also broadcast to clients for real-time updates
		wsManager.broadcast(
			{
				type: 'GUILD_UPDATE',
				event: 'GUILD_UPDATED',
				data: { guildId, updates },
				guildId,
				timestamp: Date.now(),
				messageId: `guild-updated-${Date.now()}`,
			},
			['CLIENT', 'ADMIN']
		);

		res.json({
			success: true,
			message: 'Guild update command sent',
		});
	} catch (error) {
		logger.error(`Failed to update guild ${req.params.guildId}:`, error);
		res.status(500).json({
			success: false,
			error: 'Failed to update guild',
		});
	}
};

export const deleteGuild = async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { guildId } = req.params;

		// Send leave guild command to bot
		const command = {
			command: 'LEAVE_GUILD',
			data: {
				guildId,
			},
		};

		// Broadcast to bot connections
		wsManager.broadcast(
			{
				type: 'BOT_COMMAND',
				event: 'LEAVE_GUILD',
				data: command,
				guildId,
				timestamp: Date.now(),
				messageId: `leave-guild-${Date.now()}`,
			},
			['BOT']
		);

		res.json({
			success: true,
			message: 'Leave guild command sent',
		});
	} catch (error) {
		logger.error(`Failed to leave guild ${req.params.guildId}:`, error);
		res.status(500).json({
			success: false,
			error: 'Failed to leave guild',
		});
	}
};

export const getGuildSettings = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		// Fetch guild config from database
		let guildConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
			include: {
				logSettings: true,
				appealSettings: true,
			},
		});

		// Create default config if none exists
		if (!guildConfig) {
			guildConfig = await prisma.guildConfig.create({
				data: {
					guildId,
					maxMessagesCleared: 100,
					musicChannelId: '',
					defaultRepeatMode: 0,
					reactionRoleChannels: [],
					logReactionRoles: false,
					welcomeEnabled: true,
					goodbyeEnabled: true,
					useTicketThreads: true,
					ticketSilentClaim: true,
				},
				include: {
					logSettings: true,
					appealSettings: true,
				},
			});
		}

		// Fetch additional data from Discord API
		const guild = await discordApi.getGuild(guildId);

		const settings = {
			// Basic guild info from Discord
			guild: {
				id: guild.id,
				name: guild.name,
				icon: guild.icon,
				memberCount: guild.approximate_member_count,
			},
			// Database configuration
			config: {
				maxMessagesCleared: guildConfig.maxMessagesCleared,
				musicChannelId: guildConfig.musicChannelId,
				defaultRepeatMode: guildConfig.defaultRepeatMode,
				reactionRoleChannels: guildConfig.reactionRoleChannels,
				logReactionRoles: guildConfig.logReactionRoles,
				welcomeChannelId: guildConfig.welcomeChannelId,
				goodbyeChannelId: guildConfig.goodbyeChannelId,
				welcomeEnabled: guildConfig.welcomeEnabled,
				goodbyeEnabled: guildConfig.goodbyeEnabled,
				ticketChannelId: guildConfig.ticketChannelId,
				ticketCategoryId: guildConfig.ticketCategoryId,
				useTicketThreads: guildConfig.useTicketThreads,
				ticketOnCallRoleId: guildConfig.ticketOnCallRoleId,
				ticketSilentClaim: guildConfig.ticketSilentClaim,
				ticketAccessType: guildConfig.ticketAccessType,
				ticketAccessRoleId: guildConfig.ticketAccessRoleId,
				ticketAccessPermission: guildConfig.ticketAccessPermission,
				ticketLogChannelId: guildConfig.ticketLogChannelId,
			},
			logging: guildConfig.logSettings,
			appeals: guildConfig.appealSettings,
		};

		// Broadcast settings update via WebSocket
		wsManager.broadcastToGuild(guildId, 'guildSettingsUpdate', settings);

		res.json({
			success: true,
			data: settings,
		});
	} catch (error) {
		logger.error(
			`Failed to fetch guild settings for ${req.params.guildId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch guild settings',
		});
	}
};

export const updateGuildSettings = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const updates = req.body;
		const prisma = getPrismaClient();

		// Update guild configuration
		const updatedConfig = await prisma.guildConfig.upsert({
			where: { guildId },
			update: {
				...updates.config,
			},
			create: {
				guildId,
				maxMessagesCleared: updates.config?.maxMessagesCleared || 100,
				musicChannelId: updates.config?.musicChannelId || '',
				defaultRepeatMode: updates.config?.defaultRepeatMode || 0,
				reactionRoleChannels: updates.config?.reactionRoleChannels || [],
				logReactionRoles: updates.config?.logReactionRoles || false,
				welcomeChannelId: updates.config?.welcomeChannelId,
				goodbyeChannelId: updates.config?.goodbyeChannelId,
				welcomeEnabled: updates.config?.welcomeEnabled ?? true,
				goodbyeEnabled: updates.config?.goodbyeEnabled ?? true,
				ticketChannelId: updates.config?.ticketChannelId,
				ticketCategoryId: updates.config?.ticketCategoryId,
				useTicketThreads: updates.config?.useTicketThreads ?? true,
				ticketOnCallRoleId: updates.config?.ticketOnCallRoleId,
				ticketSilentClaim: updates.config?.ticketSilentClaim ?? true,
				ticketAccessType: updates.config?.ticketAccessType,
				ticketAccessRoleId: updates.config?.ticketAccessRoleId,
				ticketAccessPermission: updates.config?.ticketAccessPermission,
				ticketLogChannelId: updates.config?.ticketLogChannelId,
			},
			include: {
				logSettings: true,
				appealSettings: true,
			},
		});

		// Handle log settings update
		if (updates.logging) {
			await prisma.logSettings.upsert({
				where: { guildId },
				update: {
					channelRouting: updates.logging.channelRouting || {},
					ignoredUsers: updates.logging.ignoredUsers || [],
					ignoredRoles: updates.logging.ignoredRoles || [],
					ignoredChannels: updates.logging.ignoredChannels || [],
					enabledLogTypes: updates.logging.enabledLogTypes || [],
					customFormats: updates.logging.customFormats,
					filterRules: updates.logging.filterRules,
				},
				create: {
					guildId,
					channelRouting: updates.logging.channelRouting || {},
					ignoredUsers: updates.logging.ignoredUsers || [],
					ignoredRoles: updates.logging.ignoredRoles || [],
					ignoredChannels: updates.logging.ignoredChannels || [],
					enabledLogTypes: updates.logging.enabledLogTypes || [],
					customFormats: updates.logging.customFormats,
					filterRules: updates.logging.filterRules,
				},
			});
		}

		// Handle appeal settings update
		if (updates.appeals) {
			await prisma.appealSettings.upsert({
				where: { guildId },
				update: {
					discordBotEnabled: updates.appeals.discordBotEnabled ?? true,
					webFormEnabled: updates.appeals.webFormEnabled ?? false,
					emailEnabled: updates.appeals.emailEnabled ?? false,
					separateServerEnabled: updates.appeals.separateServerEnabled ?? false,
					appealChannelId: updates.appeals.appealChannelId,
					appealServerId: updates.appeals.appealServerId,
					webFormUrl: updates.appeals.webFormUrl,
					appealEmail: updates.appeals.appealEmail,
					appealReceived: updates.appeals.appealReceived,
					appealApproved: updates.appeals.appealApproved,
					appealDenied: updates.appeals.appealDenied,
					appealCooldown: updates.appeals.appealCooldown || 86400,
					maxAppealsPerUser: updates.appeals.maxAppealsPerUser || 3,
				},
				create: {
					guildId,
					discordBotEnabled: updates.appeals.discordBotEnabled ?? true,
					webFormEnabled: updates.appeals.webFormEnabled ?? false,
					emailEnabled: updates.appeals.emailEnabled ?? false,
					separateServerEnabled: updates.appeals.separateServerEnabled ?? false,
					appealChannelId: updates.appeals.appealChannelId,
					appealServerId: updates.appeals.appealServerId,
					webFormUrl: updates.appeals.webFormUrl,
					appealEmail: updates.appeals.appealEmail,
					appealReceived: updates.appeals.appealReceived,
					appealApproved: updates.appeals.appealApproved,
					appealDenied: updates.appeals.appealDenied,
					appealCooldown: updates.appeals.appealCooldown || 86400,
					maxAppealsPerUser: updates.appeals.maxAppealsPerUser || 3,
				},
			});
		}

		// Fetch updated data
		const finalConfig = await prisma.guildConfig.findUnique({
			where: { guildId },
			include: {
				logSettings: true,
				appealSettings: true,
			},
		});

		// Broadcast update via WebSocket
		wsManager.broadcastToGuild(guildId, 'guildSettingsUpdate', finalConfig);

		logger.info(`Guild settings updated for ${guildId}`, { updates });

		res.json({
			success: true,
			message: 'Guild settings updated successfully',
			data: finalConfig,
		});
	} catch (error) {
		logger.error(
			`Failed to update guild settings for ${req.params.guildId}:`,
			error
		);
		res.status(500).json({
			success: false,
			error: 'Failed to update guild settings',
		});
	}
};
