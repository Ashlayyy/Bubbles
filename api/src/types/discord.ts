// Extended Discord API types for all bot features

export interface DiscordGuild {
	id: string;
	name: string;
	icon?: string;
	owner: boolean;
	permissions: string;
	memberCount?: number;
	onlineCount?: number;
	description?: string;
	banner?: string;
	splash?: string;
	verificationLevel: number;
	defaultMessageNotifications: number;
	explicitContentFilter: number;
	features: string[];
	mfaLevel: number;
	systemChannelId?: string;
	rulesChannelId?: string;
	publicUpdatesChannelId?: string;
	afkChannelId?: string;
	afkTimeout: number;
}

export interface DiscordChannel {
	id: string;
	name: string;
	type: number;
	position?: number;
	topic?: string;
	nsfw?: boolean;
	lastMessageId?: string;
	bitrate?: number;
	userLimit?: number;
	rateLimitPerUser?: number;
	parentId?: string;
	rtcRegion?: string;
	threadMetadata?: any;
}

export interface DiscordRole {
	id: string;
	name: string;
	color: number;
	hoist: boolean;
	icon?: string;
	unicodeEmoji?: string;
	position: number;
	permissions: string;
	managed: boolean;
	mentionable: boolean;
	tags?: {
		botId?: string;
		integrationId?: string;
		premiumSubscriber?: boolean;
	};
}

export interface DiscordMember {
	user: DiscordUser;
	nick?: string;
	avatar?: string;
	roles: string[];
	joinedAt: string;
	premiumSince?: string;
	deaf: boolean;
	mute: boolean;
	pending?: boolean;
	permissions?: string;
	communicationDisabledUntil?: string;
}

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	avatar?: string;
	bot?: boolean;
	system?: boolean;
	mfaEnabled?: boolean;
	banner?: string;
	accentColor?: number;
	locale?: string;
	verified?: boolean;
	email?: string;
	flags?: number;
	premiumType?: number;
	publicFlags?: number;
}

export interface DiscordEmoji {
	id?: string;
	name: string;
	roles?: string[];
	user?: DiscordUser;
	requireColons?: boolean;
	managed?: boolean;
	animated?: boolean;
	available?: boolean;
}

export interface DiscordWebhook {
	id: string;
	type: number;
	guildId?: string;
	channelId: string;
	user?: DiscordUser;
	name?: string;
	avatar?: string;
	token?: string;
	applicationId?: string;
	sourceGuild?: DiscordGuild;
	sourceChannel?: DiscordChannel;
	url?: string;
}

export interface DiscordInvite {
	code: string;
	guild?: DiscordGuild;
	channel: DiscordChannel;
	inviter?: DiscordUser;
	targetType?: number;
	targetUser?: DiscordUser;
	targetApplication?: any;
	approximatePresenceCount?: number;
	approximateMemberCount?: number;
	expiresAt?: string;
	guildScheduledEvent?: any;
}

export interface DiscordAuditLogEntry {
	id: string;
	actionType: number;
	targetId?: string;
	userId?: string;
	changes?: Array<{
		key: string;
		oldValue?: any;
		newValue?: any;
	}>;
	options?: {
		deleteMemberDays?: string;
		membersRemoved?: string;
		channelId?: string;
		messageId?: string;
		count?: string;
		id?: string;
		type?: string;
		roleName?: string;
	};
	reason?: string;
}

// Pagination helpers
export interface PaginationOptions {
	limit?: number;
	offset?: number;
	before?: string;
	after?: string;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		total?: number;
		limit: number;
		offset: number;
		hasMore: boolean;
		before?: string;
		after?: string;
	};
}
