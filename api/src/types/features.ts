// Types for all bot features

// Ticket System
export interface Ticket {
	id: string;
	ticketNumber: number;
	guildId: string;
	userId: string;
	channelId: string;
	threadId?: string;
	category: string;
	title: string;
	description?: string;
	status: 'OPEN' | 'CLAIMED' | 'CLOSED' | 'ARCHIVED';
	assignedTo?: string;
	tags: string[];
	closedReason?: string;
	closedBy?: string;
	closedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface TicketSettings {
	guildId: string;
	enabled: boolean;
	categoryId?: string;
	logChannelId?: string;
	supportRoleId?: string;
	maxTicketsPerUser: number;
	ticketInactiveHours: number;
	useThreads: boolean;
	requireReason: boolean;
	supportMessage?: string;
}

// Welcome System
export interface WelcomeSettings {
	guildId: string;
	welcomeEnabled: boolean;
	goodbyeEnabled: boolean;
	welcomeChannelId?: string;
	goodbyeChannelId?: string;
	welcomeMessage?: string;
	goodbyeMessage?: string;
	embedEnabled: boolean;
	embedColor?: string;
	assignRoles: string[];
	dmWelcome: boolean;
	dmMessage?: string;
}

// Custom Commands
export interface CustomCommand {
	id: string;
	guildId: string;
	name: string;
	aliases: string[];
	content: string;
	type: 'TEXT' | 'EMBED' | 'REACTION' | 'SCRIPT';
	embedData?: any;
	permissions: string[];
	cooldown: number;
	enabled: boolean;
	usage: number;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

// Leveling System
export interface LevelingSettings {
	guildId: string;
	enabled: boolean;
	xpPerMessage: number;
	xpCooldown: number;
	levelUpMessage?: string;
	levelUpChannel?: string;
	ignoredChannels: string[];
	ignoredRoles: string[];
	multiplierRoles: Array<{
		roleId: string;
		multiplier: number;
	}>;
	stackMultipliers: boolean;
}

export interface UserLevel {
	guildId: string;
	userId: string;
	xp: number;
	level: number;
	totalXp: number;
	messageCount: number;
	lastXpGain: string;
}

export interface LevelReward {
	id: string;
	guildId: string;
	level: number;
	roleId: string;
	roleName: string;
	removeOnHigher: boolean;
	createdAt: string;
}

// Reaction Roles
export interface ReactionRole {
	id: string;
	guildId: string;
	channelId: string;
	messageId: string;
	emoji: string;
	roleIds: string[];
	type: 'TOGGLE' | 'ADD_ONLY' | 'REMOVE_ONLY';
	maxUses?: number;
	currentUses: number;
	enabled: boolean;
	createdAt: string;
}

// Appeals System
export interface Appeal {
	id: string;
	guildId: string;
	userId: string;
	caseId?: string;
	type: 'BAN' | 'TIMEOUT' | 'KICK' | 'WARN';
	reason: string;
	evidence?: string[];
	status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
	reviewedBy?: string;
	reviewedAt?: string;
	reviewNotes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface AppealSettings {
	guildId: string;
	enabled: boolean;
	channelId?: string;
	reviewRoleId?: string;
	cooldownHours: number;
	maxAppeals: number;
	autoApproveAfterDays?: number;
	requireEvidence: boolean;
	appealMessage?: string;
}

// Starboard
export interface StarboardSettings {
	guildId: string;
	enabled: boolean;
	channelId?: string;
	threshold: number;
	emoji: string;
	selfStar: boolean;
	nsfw: boolean;
	ignoredChannels: string[];
	ignoredRoles: string[];
}

// Reminders
export interface Reminder {
	id: string;
	guildId: string;
	userId: string;
	channelId: string;
	content: string;
	triggerAt: string;
	recurring?: {
		interval: number;
		unit: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS';
		endAt?: string;
	};
	status: 'PENDING' | 'SENT' | 'CANCELLED';
	createdAt: string;
}

// Analytics
export interface AnalyticsOverview {
	guildId: string;
	period: string;
	memberStats: {
		total: number;
		joined: number;
		left: number;
		online: number;
		bots: number;
	};
	messageStats: {
		total: number;
		dailyAverage: number;
		topChannels: Array<{
			channelId: string;
			count: number;
		}>;
	};
	moderationStats: {
		totalCases: number;
		bans: number;
		kicks: number;
		timeouts: number;
		warnings: number;
	};
	activityStats: {
		commandUsage: number;
		reactionRoles: number;
		ticketsCreated: number;
	};
}

// Automation
export interface AutomationRule {
	id: string;
	guildId: string;
	name: string;
	description?: string;
	enabled: boolean;
	trigger: {
		type:
			| 'MEMBER_JOIN'
			| 'MEMBER_LEAVE'
			| 'MESSAGE_SENT'
			| 'REACTION_ADD'
			| 'ROLE_ASSIGN'
			| 'SCHEDULED';
		conditions: any;
	};
	actions: Array<{
		type:
			| 'SEND_MESSAGE'
			| 'ADD_ROLE'
			| 'REMOVE_ROLE'
			| 'KICK'
			| 'BAN'
			| 'TIMEOUT'
			| 'SEND_DM';
		parameters: any;
	}>;
	cooldown?: number;
	maxTriggers?: number;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

// Applications
export interface Application {
	id: string;
	guildId: string;
	userId: string;
	formId: string;
	answers: Record<string, any>;
	status: 'PENDING' | 'APPROVED' | 'DENIED' | 'WITHDRAWN';
	reviewedBy?: string;
	reviewedAt?: string;
	reviewNotes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ApplicationForm {
	id: string;
	guildId: string;
	name: string;
	description?: string;
	questions: Array<{
		id: string;
		type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'MULTISELECT' | 'CHECKBOX' | 'RADIO';
		question: string;
		required: boolean;
		options?: string[];
		minLength?: number;
		maxLength?: number;
	}>;
	autoRole?: string;
	reviewChannel?: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

// Entertainment
export interface GameSettings {
	guildId: string;
	enabled: boolean;
	allowedChannels: string[];
	economyEnabled: boolean;
	currencyName: string;
	dailyAmount: number;
	triviaEnabled: boolean;
	triviaReward: number;
}

// Webhooks
export interface WebhookConfig {
	id: string;
	guildId: string;
	name: string;
	url: string;
	events: string[];
	enabled: boolean;
	secret?: string;
	createdAt: string;
	updatedAt: string;
}

// Server Settings
export interface ServerSettings {
	guildId: string;
	prefix: string;
	language: string;
	timezone: string;
	features: {
		moderation: boolean;
		music: boolean;
		leveling: boolean;
		tickets: boolean;
		welcome: boolean;
		automod: boolean;
		appeals: boolean;
		starboard: boolean;
		reactionRoles: boolean;
		customCommands: boolean;
		reminders: boolean;
		analytics: boolean;
		automation: boolean;
		applications: boolean;
		entertainment: boolean;
	};
	updatedAt: string;
}
