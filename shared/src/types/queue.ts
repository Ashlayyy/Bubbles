export interface BaseJob {
	id: string;
	timestamp: number;
	guildId?: string;
	userId?: string;
}

// Bot Command Jobs (API -> Bot)
export interface SendMessageJob extends BaseJob {
	type: 'SEND_MESSAGE';
	channelId: string;
	content: string;
	embeds?: any[];
}

export interface ModerationActionJob extends BaseJob {
	type: 'BAN_USER' | 'KICK_USER' | 'TIMEOUT_USER' | 'UNBAN_USER';
	targetUserId: string;
	reason?: string;
	duration?: number; // for timeout
	caseId?: string;
	moderatorId?: string;
}

export interface MusicActionJob extends BaseJob {
	type:
		| 'PLAY_MUSIC'
		| 'PAUSE_MUSIC'
		| 'SKIP_MUSIC'
		| 'STOP_MUSIC'
		| 'SET_VOLUME';
	query?: string; // for play
	volume?: number; // for volume
}

export interface ConfigUpdateJob extends BaseJob {
	type: 'UPDATE_CONFIG';
	configKey: string;
	configValue: any;
}

export interface GiveawayJob extends BaseJob {
	type: 'END_GIVEAWAY' | 'REROLL_GIVEAWAY';
	giveawayId: string;
	giveawayDbId: string;
	messageId: string;
	channelId: string;
}

// Bot Event Jobs (Bot -> API)
export interface DiscordEventJob extends BaseJob {
	type:
		| 'MEMBER_JOIN'
		| 'MEMBER_LEAVE'
		| 'MESSAGE_DELETE'
		| 'MESSAGE_UPDATE'
		| 'ROLE_UPDATE';
	data: any;
}

export interface ModerationEventJob extends BaseJob {
	type: 'MODERATION_ACTION_COMPLETED' | 'MODERATION_ACTION_FAILED';
	actionType: string;
	success: boolean;
	error?: string;
}

export interface MusicEventJob extends BaseJob {
	type:
		| 'MUSIC_STARTED'
		| 'MUSIC_PAUSED'
		| 'MUSIC_STOPPED'
		| 'MUSIC_SKIPPED'
		| 'QUEUE_UPDATED';
	trackInfo?: {
		title: string;
		artist: string;
		duration: number;
		url: string;
	};
	queueInfo?: {
		current: number;
		total: number;
		tracks: any[];
	};
}

// Union types for all jobs
export type BotCommandJob =
	| SendMessageJob
	| ModerationActionJob
	| MusicActionJob
	| ConfigUpdateJob
	| GiveawayJob;
export type BotEventJob = DiscordEventJob | ModerationEventJob | MusicEventJob;
export type QueueJob = BotCommandJob | BotEventJob;

// Queue names
export const QUEUE_NAMES = {
	BOT_COMMANDS: 'bot-commands',
	BOT_EVENTS: 'bot-events',
	NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
