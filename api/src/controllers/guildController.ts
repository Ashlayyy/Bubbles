import { Request, Response } from 'express';
import { discordApi } from '../services/discordApiService.js';
import { wsManager } from '../websocket/manager.js';
import { getPrismaClient } from '../services/databaseService.js';
import { createLogger } from '../types/shared.js';
import { Session, SessionData } from 'express-session';

interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		username: string;
		guilds: string[];
	};
	session: Session & Partial<SessionData> & { accessToken?: string };
}

const logger = createLogger('guild-controller');

// ------------------------------
// Simple in-memory caches
// ------------------------------
const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry<T> {
	data: T;
	fetchedAt: number;
}

let guildListCache: CacheEntry<any[]> | null = null;
const guildDetailsCache: Map<string, CacheEntry<any>> = new Map();

export const getGuilds = async (req: AuthenticatedRequest, res: Response) => {
	const now = Date.now();
	if (guildListCache && now - guildListCache.fetchedAt < CACHE_TTL_MS) {
		return res.success({
			guilds: guildListCache.data,
			total: guildListCache.data.length,
		});
	}

	try {
		const accessToken = req.session.accessToken;
		if (!accessToken) {
			return res.failure('Not authenticated', 401);
		}

		// Fetch guilds from Discord API
		const guilds = await discordApi.getGuilds(accessToken);

		// Discord permission bit for MANAGE_GUILD (1 << 5 = 32)
		const MANAGE_GUILD = BigInt(1 << 5);
		const userGuilds = guilds.filter((guild) => {
			if (guild.owner) return true;
			// permissions may come as string – convert to BigInt for bitwise check
			try {
				const perms = BigInt(guild.permissions);
				return (perms & MANAGE_GUILD) === MANAGE_GUILD;
			} catch {
				return false;
			}
		});

		// Fetch bot's guild list to mark presence
		let botGuildIds: Set<string> = new Set();
		try {
			const botGuilds = await discordApi.getGuilds();
			botGuildIds = new Set(botGuilds.map((g: any) => g.id));
		} catch (err) {
			logger.warn('Failed to fetch bot guilds', err);
		}

		const payload = userGuilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			icon: guild.icon,
			owner: guild.owner,
			permissions: guild.permissions,
			memberCount: guild.approximate_member_count,
			description: guild.description,
			features: guild.features,
			hasBubbles: botGuildIds.has(guild.id),
		}));

		guildListCache = { data: payload, fetchedAt: now } as any;

		res.success({ guilds: payload, total: payload.length });
	} catch (error) {
		logger.error('Failed to fetch guilds:', error);
		res.failure('Failed to fetch guilds', 500);
	}
};

export const getGuild = async (req: AuthenticatedRequest, res: Response) => {
	const { guildId } = req.params;
	const cached = guildDetailsCache.get(guildId);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return res.success(cached.data);
	}

	try {
		// Fetch guild details from Discord API
		const guild = await discordApi.getGuild(guildId);
		logger.debug('Discord guild payload:', guild);
		const channels = await discordApi.getGuildChannels(guildId);
		const roles = await discordApi.getGuildRoles(guildId);

		console.log(guild);

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

		guildDetailsCache.set(guildId, { data: guildData, fetchedAt: Date.now() });
		res.success(guildData);
	} catch (error) {
		logger.error(`Failed to fetch guild ${req.params.guildId}:`, error);
		res.failure('Failed to fetch guild details', 500);
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

		res.success({
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
		});
	} catch (error) {
		logger.error(
			`Failed to fetch members for guild ${req.params.guildId}:`,
			error
		);
		res.failure('Failed to fetch guild members', 500);
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

		res.success(channels);
	} catch (error) {
		logger.error(
			`Failed to fetch channels for guild ${req.params.guildId}:`,
			error
		);
		res.failure('Failed to fetch guild channels', 500);
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

		res.success(roles);
	} catch (error) {
		logger.error(
			`Failed to fetch roles for guild ${req.params.guildId}:`,
			error
		);
		res.failure('Failed to fetch guild roles', 500);
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

		res.success({ message: 'Guild update command sent' });
	} catch (error) {
		logger.error(`Failed to update guild ${req.params.guildId}:`, error);
		res.failure('Failed to update guild', 500);
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

		res.success({ message: 'Leave guild command sent' });
	} catch (error) {
		logger.error(`Failed to leave guild ${req.params.guildId}:`, error);
		res.failure('Failed to leave guild', 500);
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
				moderation_case_rules: (guildConfig as any).moderation_case_rules ?? {},
			},
			logging: guildConfig.logSettings,
			appeals: guildConfig.appealSettings,
		};

		// Broadcast settings update via WebSocket
		wsManager.broadcastToGuild(guildId, 'guildSettingsUpdate', settings);

		res.success(settings);
	} catch (error) {
		logger.error(
			`Failed to fetch guild settings for ${req.params.guildId}:`,
			error
		);
		res.failure('Failed to fetch guild settings', 500);
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
				moderation_case_rules: updates.config?.moderation_case_rules ?? {},
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

		res.success({
			message: 'Guild settings updated successfully',
			data: finalConfig,
		});
	} catch (error) {
		logger.error(
			`Failed to update guild settings for ${req.params.guildId}:`,
			error
		);
		res.failure('Failed to update guild settings', 500);
	}
};
