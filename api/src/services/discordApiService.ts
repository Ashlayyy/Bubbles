import { createLogger } from '../types/shared.js';

const logger = createLogger('discord-api-service');

interface DiscordAPIOptions {
	reason?: string;
	delete_message_days?: number;
	communication_disabled_until?: string | null;
}

interface CreateChannelOptions {
	name: string;
	type?: number;
	topic?: string;
	bitrate?: number;
	user_limit?: number;
	rate_limit_per_user?: number;
	position?: number;
	permission_overwrites?: any[];
	parent_id?: string;
	nsfw?: boolean;
	rtc_region?: string;
	video_quality_mode?: number;
	default_auto_archive_duration?: number;
	default_reaction_emoji?: any;
	available_tags?: any[];
	default_sort_order?: number;
	default_forum_layout?: number;
	default_thread_rate_limit_per_user?: number;
}

interface ModifyChannelOptions {
	name?: string;
	type?: number;
	position?: number;
	topic?: string;
	nsfw?: boolean;
	rate_limit_per_user?: number;
	bitrate?: number;
	user_limit?: number;
	permission_overwrites?: any[];
	parent_id?: string;
	rtc_region?: string;
	video_quality_mode?: number;
	default_auto_archive_duration?: number;
	flags?: number;
	available_tags?: any[];
	default_reaction_emoji?: any;
	default_thread_rate_limit_per_user?: number;
	default_sort_order?: number;
	default_forum_layout?: number;
}

interface CreateMessageOptions {
	content?: string;
	embeds?: any[];
	files?: any[];
	components?: any[];
	stickers?: string[];
	flags?: number;
	message_reference?: {
		message_id?: string;
		channel_id?: string;
		guild_id?: string;
		fail_if_not_exists?: boolean;
	};
	allowed_mentions?: {
		parse?: string[];
		roles?: string[];
		users?: string[];
		replied_user?: boolean;
	};
}

interface EditMessageOptions {
	content?: string;
	embeds?: any[];
	components?: any[];
	flags?: number;
	allowed_mentions?: {
		parse?: string[];
		roles?: string[];
		users?: string[];
		replied_user?: boolean;
	};
}

interface CreateThreadOptions {
	name: string;
	auto_archive_duration?: number;
	type?: number;
	invitable?: boolean;
	rate_limit_per_user?: number;
	message?: CreateMessageOptions;
}

interface ModifyGuildMemberOptions {
	nick?: string;
	roles?: string[];
	mute?: boolean;
	deaf?: boolean;
	channel_id?: string;
	communication_disabled_until?: string | null;
	flags?: number;
}

interface CreateRoleOptions {
	name?: string;
	permissions?: string;
	color?: number;
	hoist?: boolean;
	icon?: string;
	unicode_emoji?: string;
	mentionable?: boolean;
}

interface ModifyRoleOptions {
	name?: string;
	permissions?: string;
	color?: number;
	hoist?: boolean;
	icon?: string;
	unicode_emoji?: string;
	mentionable?: boolean;
}

interface CreateInviteOptions {
	max_age?: number;
	max_uses?: number;
	temporary?: boolean;
	unique?: boolean;
	target_type?: number;
	target_user_id?: string;
	target_application_id?: string;
}

interface ModifyGuildOptions {
	name?: string;
	region?: string;
	verification_level?: number;
	default_message_notifications?: number;
	explicit_content_filter?: number;
	afk_channel_id?: string;
	afk_timeout?: number;
	icon?: string;
	owner_id?: string;
	splash?: string;
	discovery_splash?: string;
	banner?: string;
	system_channel_id?: string;
	system_channel_flags?: number;
	rules_channel_id?: string;
	public_updates_channel_id?: string;
	preferred_locale?: string;
	features?: string[];
	description?: string;
	premium_progress_bar_enabled?: boolean;
}

export class DiscordApiService {
	private botToken: string;
	private baseURL = 'https://discord.com/api/v10';

	constructor() {
		this.botToken = process.env.DISCORD_CLIENT_SECRET || '';
		if (!this.botToken) {
			throw new Error('DISCORD_CLIENT_SECRET environment variable is required');
		}
		logger.info('Discord API service initialized');
	}

	private async makeRequest(
		endpoint: string,
		options: RequestInit = {}
	): Promise<any> {
		const url = `${this.baseURL}${endpoint}`;

		const headers = {
			Authorization: `Bot ${this.botToken}`,
			'Content-Type': 'application/json',
			...options.headers,
		};

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const error = await response.text();
			logger.error(
				`Discord API request failed: ${response.status} ${response.statusText}`,
				error
			);
			throw new Error(
				`Discord API Error: ${response.status} ${response.statusText}`
			);
		}

		if (response.status === 204) {
			return null; // No content
		}

		return response.json();
	}

	// Guild operations
	async getGuild(guildId: string): Promise<any> {
		try {
			const guild = await this.makeRequest(`/guilds/${guildId}`);
			return guild;
		} catch (error) {
			logger.error(`Failed to fetch guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildMembers(
		guildId: string,
		limit: number = 100,
		after?: string
	): Promise<any[]> {
		try {
			const query = new URLSearchParams();
			query.set('limit', limit.toString());
			if (after) query.set('after', after);

			const members = await this.makeRequest(
				`/guilds/${guildId}/members?${query.toString()}`
			);
			return members || [];
		} catch (error) {
			logger.error(`Failed to fetch members for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildMember(guildId: string, userId: string): Promise<any> {
		try {
			const member = await this.makeRequest(
				`/guilds/${guildId}/members/${userId}`
			);
			return member;
		} catch (error) {
			logger.error(
				`Failed to fetch member ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildChannels(guildId: string): Promise<any[]> {
		try {
			const channels = await this.makeRequest(`/guilds/${guildId}/channels`);
			return channels || [];
		} catch (error) {
			logger.error(`Failed to fetch channels for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildRoles(guildId: string): Promise<any[]> {
		try {
			const roles = await this.makeRequest(`/guilds/${guildId}/roles`);
			return roles || [];
		} catch (error) {
			logger.error(`Failed to fetch roles for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildBans(guildId: string): Promise<any[]> {
		try {
			const bans = await this.makeRequest(`/guilds/${guildId}/bans`);
			return bans || [];
		} catch (error) {
			logger.error(`Failed to fetch bans for guild ${guildId}:`, error);
			throw error;
		}
	}

	// User operations
	async getUser(userId: string): Promise<any> {
		try {
			const user = await this.makeRequest(`/users/${userId}`);
			return user;
		} catch (error) {
			logger.error(`Failed to fetch user ${userId}:`, error);
			throw error;
		}
	}

	// Message operations
	async getChannelMessages(
		channelId: string,
		limit: number = 50,
		before?: string
	): Promise<any[]> {
		try {
			const query = new URLSearchParams();
			query.set('limit', limit.toString());
			if (before) query.set('before', before);

			const messages = await this.makeRequest(
				`/channels/${channelId}/messages?${query.toString()}`
			);
			return messages || [];
		} catch (error) {
			logger.error(`Failed to fetch messages for channel ${channelId}:`, error);
			throw error;
		}
	}

	async getMessage(channelId: string, messageId: string): Promise<any> {
		try {
			const message = await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}`
			);
			return message;
		} catch (error) {
			logger.error(
				`Failed to fetch message ${messageId} in channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	// Moderation operations (these will typically go through WebSocket to bot)
	async banUser(
		guildId: string,
		userId: string,
		options: DiscordAPIOptions = {}
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/bans/${userId}`, {
				method: 'PUT',
				body: JSON.stringify({
					reason: options.reason,
					delete_message_days: options.delete_message_days || 0,
				}),
			});
			logger.info(`Banned user ${userId} from guild ${guildId}`);
		} catch (error) {
			logger.error(`Failed to ban user ${userId} in guild ${guildId}:`, error);
			throw error;
		}
	}

	async unbanUser(
		guildId: string,
		userId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/bans/${userId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Unbanned user ${userId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to unban user ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async kickUser(
		guildId: string,
		userId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/members/${userId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Kicked user ${userId} from guild ${guildId}`);
		} catch (error) {
			logger.error(`Failed to kick user ${userId} in guild ${guildId}:`, error);
			throw error;
		}
	}

	async timeoutUser(
		guildId: string,
		userId: string,
		duration: number,
		reason?: string
	): Promise<void> {
		try {
			const timeoutUntil = new Date(Date.now() + duration).toISOString();
			await this.makeRequest(`/guilds/${guildId}/members/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					communication_disabled_until: timeoutUntil,
				}),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(
				`Timed out user ${userId} in guild ${guildId} until ${timeoutUntil}`
			);
		} catch (error) {
			logger.error(
				`Failed to timeout user ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async removeTimeout(
		guildId: string,
		userId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/members/${userId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					communication_disabled_until: null,
				}),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Removed timeout for user ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to remove timeout for user ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	// Message management
	async deleteMessage(
		channelId: string,
		messageId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/messages/${messageId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted message ${messageId} in channel ${channelId}`);
		} catch (error) {
			logger.error(
				`Failed to delete message ${messageId} in channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async sendMessage(channelId: string, content: any): Promise<any> {
		try {
			const message = await this.makeRequest(
				`/channels/${channelId}/messages`,
				{
					method: 'POST',
					body: JSON.stringify(content),
				}
			);
			logger.info(`Sent message to channel ${channelId}`);
			return message;
		} catch (error) {
			logger.error(`Failed to send message to channel ${channelId}:`, error);
			throw error;
		}
	}

	// Role operations
	async addRoleToMember(
		guildId: string,
		userId: string,
		roleId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/guilds/${guildId}/members/${userId}/roles/${roleId}`,
				{
					method: 'PUT',
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Added role ${roleId} to user ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to add role ${roleId} to user ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async removeRoleFromMember(
		guildId: string,
		userId: string,
		roleId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/guilds/${guildId}/members/${userId}/roles/${roleId}`,
				{
					method: 'DELETE',
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(
				`Removed role ${roleId} from user ${userId} in guild ${guildId}`
			);
		} catch (error) {
			logger.error(
				`Failed to remove role ${roleId} from user ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	// Channel operations
	async createChannel(guildId: string, options: any): Promise<any> {
		try {
			const channel = await this.makeRequest(`/guilds/${guildId}/channels`, {
				method: 'POST',
				body: JSON.stringify(options),
			});
			logger.info(`Created channel ${channel.id} in guild ${guildId}`);
			return channel;
		} catch (error) {
			logger.error(`Failed to create channel in guild ${guildId}:`, error);
			throw error;
		}
	}

	async deleteChannel(channelId: string, reason?: string): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted channel ${channelId}`);
		} catch (error) {
			logger.error(`Failed to delete channel ${channelId}:`, error);
			throw error;
		}
	}

	// Automod operations
	async getAutoModerationRules(guildId: string): Promise<any[]> {
		try {
			const rules = await this.makeRequest(
				`/guilds/${guildId}/auto-moderation/rules`
			);
			return rules || [];
		} catch (error) {
			logger.error(
				`Failed to fetch automod rules for guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async createAutoModerationRule(guildId: string, rule: any): Promise<any> {
		try {
			const createdRule = await this.makeRequest(
				`/guilds/${guildId}/auto-moderation/rules`,
				{
					method: 'POST',
					body: JSON.stringify(rule),
				}
			);
			logger.info(`Created automod rule in guild ${guildId}`);
			return createdRule;
		} catch (error) {
			logger.error(`Failed to create automod rule in guild ${guildId}:`, error);
			throw error;
		}
	}

	async updateAutoModerationRule(
		guildId: string,
		ruleId: string,
		rule: any
	): Promise<any> {
		try {
			const updatedRule = await this.makeRequest(
				`/guilds/${guildId}/auto-moderation/rules/${ruleId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(rule),
				}
			);
			logger.info(`Updated automod rule ${ruleId} in guild ${guildId}`);
			return updatedRule;
		} catch (error) {
			logger.error(
				`Failed to update automod rule ${ruleId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async deleteAutoModerationRule(
		guildId: string,
		ruleId: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/guilds/${guildId}/auto-moderation/rules/${ruleId}`,
				{
					method: 'DELETE',
				}
			);
			logger.info(`Deleted automod rule ${ruleId} in guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete automod rule ${ruleId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	// Utility methods
	async getCurrentUser(): Promise<any> {
		try {
			const user = await this.makeRequest('/users/@me');
			return user;
		} catch (error) {
			logger.error('Failed to fetch current user:', error);
			throw error;
		}
	}

	async getGuilds(): Promise<any[]> {
		try {
			const guilds = await this.makeRequest('/users/@me/guilds');
			return guilds || [];
		} catch (error) {
			logger.error('Failed to fetch guilds:', error);
			throw error;
		}
	}

	// ============================================================================
	// ENHANCED CHANNEL OPERATIONS
	// ============================================================================

	async getChannel(channelId: string): Promise<any> {
		try {
			const channel = await this.makeRequest(`/channels/${channelId}`);
			return channel;
		} catch (error) {
			logger.error(`Failed to fetch channel ${channelId}:`, error);
			throw error;
		}
	}

	async modifyChannel(
		channelId: string,
		options: ModifyChannelOptions,
		reason?: string
	): Promise<any> {
		try {
			const channel = await this.makeRequest(`/channels/${channelId}`, {
				method: 'PATCH',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified channel ${channelId}`);
			return channel;
		} catch (error) {
			logger.error(`Failed to modify channel ${channelId}:`, error);
			throw error;
		}
	}

	async getChannelInvites(channelId: string): Promise<any[]> {
		try {
			const invites = await this.makeRequest(`/channels/${channelId}/invites`);
			return invites || [];
		} catch (error) {
			logger.error(`Failed to fetch invites for channel ${channelId}:`, error);
			throw error;
		}
	}

	async createChannelInvite(
		channelId: string,
		options: CreateInviteOptions = {},
		reason?: string
	): Promise<any> {
		try {
			const invite = await this.makeRequest(`/channels/${channelId}/invites`, {
				method: 'POST',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Created invite for channel ${channelId}`);
			return invite;
		} catch (error) {
			logger.error(`Failed to create invite for channel ${channelId}:`, error);
			throw error;
		}
	}

	async deleteChannelPermission(
		channelId: string,
		overwriteId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/channels/${channelId}/permissions/${overwriteId}`,
				{
					method: 'DELETE',
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(
				`Deleted permission overwrite ${overwriteId} for channel ${channelId}`
			);
		} catch (error) {
			logger.error(
				`Failed to delete permission for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async editChannelPermissions(
		channelId: string,
		overwriteId: string,
		options: any,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/channels/${channelId}/permissions/${overwriteId}`,
				{
					method: 'PUT',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(
				`Updated permissions for ${overwriteId} in channel ${channelId}`
			);
		} catch (error) {
			logger.error(
				`Failed to edit permissions for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	// ============================================================================
	// ENHANCED MESSAGE OPERATIONS
	// ============================================================================

	async editMessage(
		channelId: string,
		messageId: string,
		options: EditMessageOptions
	): Promise<any> {
		try {
			const message = await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
				}
			);
			logger.info(`Edited message ${messageId} in channel ${channelId}`);
			return message;
		} catch (error) {
			logger.error(
				`Failed to edit message ${messageId} in channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async bulkDeleteMessages(
		channelId: string,
		messageIds: string[],
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/messages/bulk-delete`, {
				method: 'POST',
				body: JSON.stringify({ messages: messageIds }),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(
				`Bulk deleted ${messageIds.length} messages in channel ${channelId}`
			);
		} catch (error) {
			logger.error(
				`Failed to bulk delete messages in channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async addReaction(
		channelId: string,
		messageId: string,
		emoji: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(
					emoji
				)}/@me`,
				{
					method: 'PUT',
				}
			);
		} catch (error) {
			logger.error(`Failed to add reaction to message ${messageId}:`, error);
			throw error;
		}
	}

	async removeReaction(
		channelId: string,
		messageId: string,
		emoji: string,
		userId?: string
	): Promise<void> {
		try {
			const endpoint = userId
				? `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(
						emoji
				  )}/${userId}`
				: `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(
						emoji
				  )}/@me`;

			await this.makeRequest(endpoint, { method: 'DELETE' });
		} catch (error) {
			logger.error(
				`Failed to remove reaction from message ${messageId}:`,
				error
			);
			throw error;
		}
	}

	async getReactions(
		channelId: string,
		messageId: string,
		emoji: string,
		after?: string,
		limit: number = 25
	): Promise<any[]> {
		try {
			const query = new URLSearchParams();
			if (after) query.set('after', after);
			query.set('limit', limit.toString());

			const users = await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(
					emoji
				)}?${query.toString()}`
			);
			return users || [];
		} catch (error) {
			logger.error(`Failed to get reactions for message ${messageId}:`, error);
			throw error;
		}
	}

	async deleteAllReactions(
		channelId: string,
		messageId: string,
		emoji?: string
	): Promise<void> {
		try {
			const endpoint = emoji
				? `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(
						emoji
				  )}`
				: `/channels/${channelId}/messages/${messageId}/reactions`;

			await this.makeRequest(endpoint, { method: 'DELETE' });
		} catch (error) {
			logger.error(
				`Failed to delete reactions from message ${messageId}:`,
				error
			);
			throw error;
		}
	}

	async pinMessage(
		channelId: string,
		messageId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/pins/${messageId}`, {
				method: 'PUT',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Pinned message ${messageId} in channel ${channelId}`);
		} catch (error) {
			logger.error(`Failed to pin message ${messageId}:`, error);
			throw error;
		}
	}

	async unpinMessage(
		channelId: string,
		messageId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/pins/${messageId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Unpinned message ${messageId} in channel ${channelId}`);
		} catch (error) {
			logger.error(`Failed to unpin message ${messageId}:`, error);
			throw error;
		}
	}

	async getPinnedMessages(channelId: string): Promise<any[]> {
		try {
			const messages = await this.makeRequest(`/channels/${channelId}/pins`);
			return messages || [];
		} catch (error) {
			logger.error(
				`Failed to get pinned messages for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async crosspostMessage(channelId: string, messageId: string): Promise<any> {
		try {
			const message = await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}/crosspost`,
				{
					method: 'POST',
				}
			);
			logger.info(`Crossposted message ${messageId} in channel ${channelId}`);
			return message;
		} catch (error) {
			logger.error(`Failed to crosspost message ${messageId}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// THREAD OPERATIONS
	// ============================================================================

	async startThreadFromMessage(
		channelId: string,
		messageId: string,
		options: CreateThreadOptions,
		reason?: string
	): Promise<any> {
		try {
			const thread = await this.makeRequest(
				`/channels/${channelId}/messages/${messageId}/threads`,
				{
					method: 'POST',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Started thread from message ${messageId}`);
			return thread;
		} catch (error) {
			logger.error(`Failed to start thread from message ${messageId}:`, error);
			throw error;
		}
	}

	async startThreadWithoutMessage(
		channelId: string,
		options: CreateThreadOptions,
		reason?: string
	): Promise<any> {
		try {
			const thread = await this.makeRequest(`/channels/${channelId}/threads`, {
				method: 'POST',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Started thread in channel ${channelId}`);
			return thread;
		} catch (error) {
			logger.error(`Failed to start thread in channel ${channelId}:`, error);
			throw error;
		}
	}

	async joinThread(channelId: string): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/thread-members/@me`, {
				method: 'PUT',
			});
			logger.info(`Joined thread ${channelId}`);
		} catch (error) {
			logger.error(`Failed to join thread ${channelId}:`, error);
			throw error;
		}
	}

	async leaveThread(channelId: string): Promise<void> {
		try {
			await this.makeRequest(`/channels/${channelId}/thread-members/@me`, {
				method: 'DELETE',
			});
			logger.info(`Left thread ${channelId}`);
		} catch (error) {
			logger.error(`Failed to leave thread ${channelId}:`, error);
			throw error;
		}
	}

	async addThreadMember(channelId: string, userId: string): Promise<void> {
		try {
			await this.makeRequest(
				`/channels/${channelId}/thread-members/${userId}`,
				{
					method: 'PUT',
				}
			);
			logger.info(`Added user ${userId} to thread ${channelId}`);
		} catch (error) {
			logger.error(
				`Failed to add user ${userId} to thread ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async removeThreadMember(channelId: string, userId: string): Promise<void> {
		try {
			await this.makeRequest(
				`/channels/${channelId}/thread-members/${userId}`,
				{
					method: 'DELETE',
				}
			);
			logger.info(`Removed user ${userId} from thread ${channelId}`);
		} catch (error) {
			logger.error(
				`Failed to remove user ${userId} from thread ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async getThreadMember(
		channelId: string,
		userId: string,
		withMember?: boolean
	): Promise<any> {
		try {
			const query = withMember ? '?with_member=true' : '';
			const member = await this.makeRequest(
				`/channels/${channelId}/thread-members/${userId}${query}`
			);
			return member;
		} catch (error) {
			logger.error(
				`Failed to get thread member ${userId} in ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async listThreadMembers(
		channelId: string,
		withMember?: boolean,
		after?: string,
		limit: number = 100
	): Promise<any[]> {
		try {
			const query = new URLSearchParams();
			if (withMember) query.set('with_member', 'true');
			if (after) query.set('after', after);
			query.set('limit', limit.toString());

			const members = await this.makeRequest(
				`/channels/${channelId}/thread-members?${query.toString()}`
			);
			return members || [];
		} catch (error) {
			logger.error(`Failed to list thread members for ${channelId}:`, error);
			throw error;
		}
	}

	async getActiveThreads(guildId: string): Promise<any> {
		try {
			const result = await this.makeRequest(
				`/guilds/${guildId}/threads/active`
			);
			return result;
		} catch (error) {
			logger.error(`Failed to get active threads for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getPublicArchivedThreads(
		channelId: string,
		before?: string,
		limit: number = 50
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			if (before) query.set('before', before);
			query.set('limit', limit.toString());

			const result = await this.makeRequest(
				`/channels/${channelId}/threads/archived/public?${query.toString()}`
			);
			return result;
		} catch (error) {
			logger.error(
				`Failed to get public archived threads for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async getPrivateArchivedThreads(
		channelId: string,
		before?: string,
		limit: number = 50
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			if (before) query.set('before', before);
			query.set('limit', limit.toString());

			const result = await this.makeRequest(
				`/channels/${channelId}/threads/archived/private?${query.toString()}`
			);
			return result;
		} catch (error) {
			logger.error(
				`Failed to get private archived threads for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	async getJoinedPrivateArchivedThreads(
		channelId: string,
		before?: string,
		limit: number = 50
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			if (before) query.set('before', before);
			query.set('limit', limit.toString());

			const result = await this.makeRequest(
				`/channels/${channelId}/users/@me/threads/archived/private?${query.toString()}`
			);
			return result;
		} catch (error) {
			logger.error(
				`Failed to get joined private archived threads for channel ${channelId}:`,
				error
			);
			throw error;
		}
	}

	// ============================================================================
	// ENHANCED GUILD MANAGEMENT
	// ============================================================================

	async modifyGuild(
		guildId: string,
		options: ModifyGuildOptions,
		reason?: string
	): Promise<any> {
		try {
			const guild = await this.makeRequest(`/guilds/${guildId}`, {
				method: 'PATCH',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified guild ${guildId}`);
			return guild;
		} catch (error) {
			logger.error(`Failed to modify guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildPreview(guildId: string): Promise<any> {
		try {
			const preview = await this.makeRequest(`/guilds/${guildId}/preview`);
			return preview;
		} catch (error) {
			logger.error(`Failed to get guild preview ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildVanityUrl(guildId: string): Promise<any> {
		try {
			const vanity = await this.makeRequest(`/guilds/${guildId}/vanity-url`);
			return vanity;
		} catch (error) {
			logger.error(`Failed to get vanity URL for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildWelcomeScreen(guildId: string): Promise<any> {
		try {
			const screen = await this.makeRequest(
				`/guilds/${guildId}/welcome-screen`
			);
			return screen;
		} catch (error) {
			logger.error(`Failed to get welcome screen for guild ${guildId}:`, error);
			throw error;
		}
	}

	async modifyGuildWelcomeScreen(
		guildId: string,
		options: any,
		reason?: string
	): Promise<any> {
		try {
			const screen = await this.makeRequest(
				`/guilds/${guildId}/welcome-screen`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified welcome screen for guild ${guildId}`);
			return screen;
		} catch (error) {
			logger.error(
				`Failed to modify welcome screen for guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildWidget(guildId: string): Promise<any> {
		try {
			const widget = await this.makeRequest(`/guilds/${guildId}/widget`);
			return widget;
		} catch (error) {
			logger.error(`Failed to get widget for guild ${guildId}:`, error);
			throw error;
		}
	}

	async modifyGuildWidget(
		guildId: string,
		options: any,
		reason?: string
	): Promise<any> {
		try {
			const widget = await this.makeRequest(`/guilds/${guildId}/widget`, {
				method: 'PATCH',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified widget for guild ${guildId}`);
			return widget;
		} catch (error) {
			logger.error(`Failed to modify widget for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildInvites(guildId: string): Promise<any[]> {
		try {
			const invites = await this.makeRequest(`/guilds/${guildId}/invites`);
			return invites || [];
		} catch (error) {
			logger.error(`Failed to get invites for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildIntegrations(guildId: string): Promise<any[]> {
		try {
			const integrations = await this.makeRequest(
				`/guilds/${guildId}/integrations`
			);
			return integrations || [];
		} catch (error) {
			logger.error(`Failed to get integrations for guild ${guildId}:`, error);
			throw error;
		}
	}

	async deleteGuildIntegration(
		guildId: string,
		integrationId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(
				`/guilds/${guildId}/integrations/${integrationId}`,
				{
					method: 'DELETE',
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Deleted integration ${integrationId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete integration ${integrationId} from guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildPruneCount(
		guildId: string,
		days: number = 7,
		includeRoles?: string[]
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			query.set('days', days.toString());
			if (includeRoles && includeRoles.length > 0) {
				includeRoles.forEach((roleId) => query.append('include_roles', roleId));
			}

			const result = await this.makeRequest(
				`/guilds/${guildId}/prune?${query.toString()}`
			);
			return result;
		} catch (error) {
			logger.error(`Failed to get prune count for guild ${guildId}:`, error);
			throw error;
		}
	}

	async beginGuildPrune(
		guildId: string,
		days: number = 7,
		computePruneCount: boolean = true,
		includeRoles?: string[],
		reason?: string
	): Promise<any> {
		try {
			const body: any = { days, compute_prune_count: computePruneCount };
			if (includeRoles && includeRoles.length > 0) {
				body.include_roles = includeRoles;
			}

			const result = await this.makeRequest(`/guilds/${guildId}/prune`, {
				method: 'POST',
				body: JSON.stringify(body),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Started prune for guild ${guildId}, ${days} days`);
			return result;
		} catch (error) {
			logger.error(`Failed to begin prune for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildVoiceRegions(guildId: string): Promise<any[]> {
		try {
			const regions = await this.makeRequest(`/guilds/${guildId}/regions`);
			return regions || [];
		} catch (error) {
			logger.error(`Failed to get voice regions for guild ${guildId}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// ENHANCED MEMBER OPERATIONS
	// ============================================================================

	async modifyGuildMember(
		guildId: string,
		userId: string,
		options: ModifyGuildMemberOptions,
		reason?: string
	): Promise<any> {
		try {
			const member = await this.makeRequest(
				`/guilds/${guildId}/members/${userId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified member ${userId} in guild ${guildId}`);
			return member;
		} catch (error) {
			logger.error(
				`Failed to modify member ${userId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async modifyCurrentMember(
		guildId: string,
		options: { nick?: string },
		reason?: string
	): Promise<any> {
		try {
			const member = await this.makeRequest(`/guilds/${guildId}/members/@me`, {
				method: 'PATCH',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified current member in guild ${guildId}`);
			return member;
		} catch (error) {
			logger.error(
				`Failed to modify current member in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async searchGuildMembers(
		guildId: string,
		query: string,
		limit: number = 1
	): Promise<any[]> {
		try {
			const params = new URLSearchParams();
			params.set('query', query);
			params.set('limit', limit.toString());

			const members = await this.makeRequest(
				`/guilds/${guildId}/members/search?${params.toString()}`
			);
			return members || [];
		} catch (error) {
			logger.error(`Failed to search members in guild ${guildId}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// ENHANCED ROLE OPERATIONS
	// ============================================================================

	async createRole(
		guildId: string,
		options: CreateRoleOptions = {},
		reason?: string
	): Promise<any> {
		try {
			const role = await this.makeRequest(`/guilds/${guildId}/roles`, {
				method: 'POST',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Created role in guild ${guildId}`);
			return role;
		} catch (error) {
			logger.error(`Failed to create role in guild ${guildId}:`, error);
			throw error;
		}
	}

	async modifyGuildRolePositions(
		guildId: string,
		positions: Array<{ id: string; position?: number }>,
		reason?: string
	): Promise<any[]> {
		try {
			const roles = await this.makeRequest(`/guilds/${guildId}/roles`, {
				method: 'PATCH',
				body: JSON.stringify(positions),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified role positions in guild ${guildId}`);
			return roles || [];
		} catch (error) {
			logger.error(
				`Failed to modify role positions in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async modifyGuildRole(
		guildId: string,
		roleId: string,
		options: ModifyRoleOptions,
		reason?: string
	): Promise<any> {
		try {
			const role = await this.makeRequest(
				`/guilds/${guildId}/roles/${roleId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified role ${roleId} in guild ${guildId}`);
			return role;
		} catch (error) {
			logger.error(
				`Failed to modify role ${roleId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async deleteGuildRole(
		guildId: string,
		roleId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/roles/${roleId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted role ${roleId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete role ${roleId} from guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	// ============================================================================
	// AUDIT LOG OPERATIONS
	// ============================================================================

	async getGuildAuditLog(
		guildId: string,
		options: {
			user_id?: string;
			action_type?: number;
			before?: string;
			after?: string;
			limit?: number;
		} = {}
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			if (options.user_id) query.set('user_id', options.user_id);
			if (options.action_type)
				query.set('action_type', options.action_type.toString());
			if (options.before) query.set('before', options.before);
			if (options.after) query.set('after', options.after);
			if (options.limit) query.set('limit', options.limit.toString());

			const auditLog = await this.makeRequest(
				`/guilds/${guildId}/audit-logs?${query.toString()}`
			);
			return auditLog;
		} catch (error) {
			logger.error(`Failed to get audit log for guild ${guildId}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// EMOJI & STICKER OPERATIONS
	// ============================================================================

	async getGuildEmojis(guildId: string): Promise<any[]> {
		try {
			const emojis = await this.makeRequest(`/guilds/${guildId}/emojis`);
			return emojis || [];
		} catch (error) {
			logger.error(`Failed to get emojis for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildEmoji(guildId: string, emojiId: string): Promise<any> {
		try {
			const emoji = await this.makeRequest(
				`/guilds/${guildId}/emojis/${emojiId}`
			);
			return emoji;
		} catch (error) {
			logger.error(
				`Failed to get emoji ${emojiId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async createGuildEmoji(
		guildId: string,
		options: {
			name: string;
			image: string;
			roles?: string[];
		},
		reason?: string
	): Promise<any> {
		try {
			const emoji = await this.makeRequest(`/guilds/${guildId}/emojis`, {
				method: 'POST',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Created emoji ${options.name} in guild ${guildId}`);
			return emoji;
		} catch (error) {
			logger.error(`Failed to create emoji in guild ${guildId}:`, error);
			throw error;
		}
	}

	async modifyGuildEmoji(
		guildId: string,
		emojiId: string,
		options: {
			name?: string;
			roles?: string[] | null;
		},
		reason?: string
	): Promise<any> {
		try {
			const emoji = await this.makeRequest(
				`/guilds/${guildId}/emojis/${emojiId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified emoji ${emojiId} in guild ${guildId}`);
			return emoji;
		} catch (error) {
			logger.error(
				`Failed to modify emoji ${emojiId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async deleteGuildEmoji(
		guildId: string,
		emojiId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/emojis/${emojiId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted emoji ${emojiId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete emoji ${emojiId} from guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildStickers(guildId: string): Promise<any[]> {
		try {
			const stickers = await this.makeRequest(`/guilds/${guildId}/stickers`);
			return stickers || [];
		} catch (error) {
			logger.error(`Failed to get stickers for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getGuildSticker(guildId: string, stickerId: string): Promise<any> {
		try {
			const sticker = await this.makeRequest(
				`/guilds/${guildId}/stickers/${stickerId}`
			);
			return sticker;
		} catch (error) {
			logger.error(
				`Failed to get sticker ${stickerId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async createGuildSticker(
		guildId: string,
		options: {
			name: string;
			description?: string;
			tags: string;
			file: any;
		},
		reason?: string
	): Promise<any> {
		try {
			const formData = new FormData();
			formData.append('name', options.name);
			if (options.description)
				formData.append('description', options.description);
			formData.append('tags', options.tags);
			formData.append('file', options.file);

			const sticker = await this.makeRequest(`/guilds/${guildId}/stickers`, {
				method: 'POST',
				body: formData,
				headers: {
					...(reason && { 'X-Audit-Log-Reason': reason }),
					// Remove Content-Type to let browser set boundary
				},
			});
			logger.info(`Created sticker ${options.name} in guild ${guildId}`);
			return sticker;
		} catch (error) {
			logger.error(`Failed to create sticker in guild ${guildId}:`, error);
			throw error;
		}
	}

	async modifyGuildSticker(
		guildId: string,
		stickerId: string,
		options: {
			name?: string;
			description?: string | null;
			tags?: string;
		},
		reason?: string
	): Promise<any> {
		try {
			const sticker = await this.makeRequest(
				`/guilds/${guildId}/stickers/${stickerId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified sticker ${stickerId} in guild ${guildId}`);
			return sticker;
		} catch (error) {
			logger.error(
				`Failed to modify sticker ${stickerId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async deleteGuildSticker(
		guildId: string,
		stickerId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/stickers/${stickerId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted sticker ${stickerId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete sticker ${stickerId} from guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	// ============================================================================
	// WEBHOOK OPERATIONS
	// ============================================================================

	async getChannelWebhooks(channelId: string): Promise<any[]> {
		try {
			const webhooks = await this.makeRequest(
				`/channels/${channelId}/webhooks`
			);
			return webhooks || [];
		} catch (error) {
			logger.error(`Failed to get webhooks for channel ${channelId}:`, error);
			throw error;
		}
	}

	async getGuildWebhooks(guildId: string): Promise<any[]> {
		try {
			const webhooks = await this.makeRequest(`/guilds/${guildId}/webhooks`);
			return webhooks || [];
		} catch (error) {
			logger.error(`Failed to get webhooks for guild ${guildId}:`, error);
			throw error;
		}
	}

	async getWebhook(webhookId: string, webhookToken?: string): Promise<any> {
		try {
			const endpoint = webhookToken
				? `/webhooks/${webhookId}/${webhookToken}`
				: `/webhooks/${webhookId}`;
			const webhook = await this.makeRequest(endpoint);
			return webhook;
		} catch (error) {
			logger.error(`Failed to get webhook ${webhookId}:`, error);
			throw error;
		}
	}

	async createWebhook(
		channelId: string,
		options: {
			name: string;
			avatar?: string;
		},
		reason?: string
	): Promise<any> {
		try {
			const webhook = await this.makeRequest(
				`/channels/${channelId}/webhooks`,
				{
					method: 'POST',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Created webhook ${options.name} for channel ${channelId}`);
			return webhook;
		} catch (error) {
			logger.error(`Failed to create webhook for channel ${channelId}:`, error);
			throw error;
		}
	}

	async modifyWebhook(
		webhookId: string,
		options: {
			name?: string;
			avatar?: string | null;
			channel_id?: string;
		},
		reason?: string,
		webhookToken?: string
	): Promise<any> {
		try {
			const endpoint = webhookToken
				? `/webhooks/${webhookId}/${webhookToken}`
				: `/webhooks/${webhookId}`;
			const webhook = await this.makeRequest(endpoint, {
				method: 'PATCH',
				body: JSON.stringify(options),
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Modified webhook ${webhookId}`);
			return webhook;
		} catch (error) {
			logger.error(`Failed to modify webhook ${webhookId}:`, error);
			throw error;
		}
	}

	async deleteWebhook(
		webhookId: string,
		reason?: string,
		webhookToken?: string
	): Promise<void> {
		try {
			const endpoint = webhookToken
				? `/webhooks/${webhookId}/${webhookToken}`
				: `/webhooks/${webhookId}`;
			await this.makeRequest(endpoint, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted webhook ${webhookId}`);
		} catch (error) {
			logger.error(`Failed to delete webhook ${webhookId}:`, error);
			throw error;
		}
	}

	async executeWebhook(
		webhookId: string,
		webhookToken: string,
		options: {
			content?: string;
			username?: string;
			avatar_url?: string;
			tts?: boolean;
			embeds?: any[];
			components?: any[];
			files?: any[];
			allowed_mentions?: any;
			flags?: number;
			thread_id?: string;
			wait?: boolean;
		}
	): Promise<any> {
		try {
			const query = options.wait ? '?wait=true' : '';
			const message = await this.makeRequest(
				`/webhooks/${webhookId}/${webhookToken}${query}`,
				{
					method: 'POST',
					body: JSON.stringify(options),
				}
			);
			logger.info(`Executed webhook ${webhookId}`);
			return message;
		} catch (error) {
			logger.error(`Failed to execute webhook ${webhookId}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// SCHEDULED EVENTS
	// ============================================================================

	async getGuildScheduledEvents(
		guildId: string,
		withUserCount?: boolean
	): Promise<any[]> {
		try {
			const query = withUserCount ? '?with_user_count=true' : '';
			const events = await this.makeRequest(
				`/guilds/${guildId}/scheduled-events${query}`
			);
			return events || [];
		} catch (error) {
			logger.error(
				`Failed to get scheduled events for guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async createGuildScheduledEvent(
		guildId: string,
		options: {
			channel_id?: string;
			entity_metadata?: any;
			name: string;
			privacy_level: number;
			scheduled_start_time: string;
			scheduled_end_time?: string;
			description?: string;
			entity_type: number;
			image?: string;
		},
		reason?: string
	): Promise<any> {
		try {
			const event = await this.makeRequest(
				`/guilds/${guildId}/scheduled-events`,
				{
					method: 'POST',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(
				`Created scheduled event ${options.name} in guild ${guildId}`
			);
			return event;
		} catch (error) {
			logger.error(
				`Failed to create scheduled event in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildScheduledEvent(
		guildId: string,
		eventId: string,
		withUserCount?: boolean
	): Promise<any> {
		try {
			const query = withUserCount ? '?with_user_count=true' : '';
			const event = await this.makeRequest(
				`/guilds/${guildId}/scheduled-events/${eventId}${query}`
			);
			return event;
		} catch (error) {
			logger.error(
				`Failed to get scheduled event ${eventId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async modifyGuildScheduledEvent(
		guildId: string,
		eventId: string,
		options: any,
		reason?: string
	): Promise<any> {
		try {
			const event = await this.makeRequest(
				`/guilds/${guildId}/scheduled-events/${eventId}`,
				{
					method: 'PATCH',
					body: JSON.stringify(options),
					headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
				}
			);
			logger.info(`Modified scheduled event ${eventId} in guild ${guildId}`);
			return event;
		} catch (error) {
			logger.error(
				`Failed to modify scheduled event ${eventId} in guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async deleteGuildScheduledEvent(
		guildId: string,
		eventId: string,
		reason?: string
	): Promise<void> {
		try {
			await this.makeRequest(`/guilds/${guildId}/scheduled-events/${eventId}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted scheduled event ${eventId} from guild ${guildId}`);
		} catch (error) {
			logger.error(
				`Failed to delete scheduled event ${eventId} from guild ${guildId}:`,
				error
			);
			throw error;
		}
	}

	async getGuildScheduledEventUsers(
		guildId: string,
		eventId: string,
		limit: number = 100,
		withMember?: boolean,
		before?: string,
		after?: string
	): Promise<any[]> {
		try {
			const query = new URLSearchParams();
			query.set('limit', limit.toString());
			if (withMember) query.set('with_member', 'true');
			if (before) query.set('before', before);
			if (after) query.set('after', after);

			const users = await this.makeRequest(
				`/guilds/${guildId}/scheduled-events/${eventId}/users?${query.toString()}`
			);
			return users || [];
		} catch (error) {
			logger.error(
				`Failed to get users for scheduled event ${eventId}:`,
				error
			);
			throw error;
		}
	}

	// ============================================================================
	// INVITE OPERATIONS
	// ============================================================================

	async getInvite(
		inviteCode: string,
		withCounts?: boolean,
		withExpiration?: boolean,
		guildScheduledEventId?: string
	): Promise<any> {
		try {
			const query = new URLSearchParams();
			if (withCounts) query.set('with_counts', 'true');
			if (withExpiration) query.set('with_expiration', 'true');
			if (guildScheduledEventId)
				query.set('guild_scheduled_event_id', guildScheduledEventId);

			const invite = await this.makeRequest(
				`/invites/${inviteCode}?${query.toString()}`
			);
			return invite;
		} catch (error) {
			logger.error(`Failed to get invite ${inviteCode}:`, error);
			throw error;
		}
	}

	async deleteInvite(inviteCode: string, reason?: string): Promise<any> {
		try {
			const invite = await this.makeRequest(`/invites/${inviteCode}`, {
				method: 'DELETE',
				headers: reason ? { 'X-Audit-Log-Reason': reason } : {},
			});
			logger.info(`Deleted invite ${inviteCode}`);
			return invite;
		} catch (error) {
			logger.error(`Failed to delete invite ${inviteCode}:`, error);
			throw error;
		}
	}
}

// Export singleton instance
export const discordApi = new DiscordApiService();
