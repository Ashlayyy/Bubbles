// Moderation system types

export interface ModerationCase {
	id: string;
	caseNumber: number;
	guildId: string;
	userId: string;
	moderatorId: string;
	type: 'ban' | 'kick' | 'timeout' | 'warn' | 'unban' | 'untimeout' | 'note';
	reason?: string;
	evidence?: string[];
	duration?: number; // in seconds
	expiresAt?: string;
	isActive: boolean;
	severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
	points: number;
	canAppeal: boolean;
	appealedAt?: string;
	appealStatus?: 'PENDING' | 'APPROVED' | 'DENIED';
	context?: any;
	dmSent: boolean;
	publicNote?: string;
	staffNote?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ModerationCaseRequest {
	userId: string;
	type: 'ban' | 'kick' | 'timeout' | 'warn' | 'unban' | 'untimeout' | 'note';
	reason?: string;
	evidence?: string[];
	duration?: number;
	severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
	points?: number;
	publicNote?: string;
	staffNote?: string;
	notifyUser?: boolean;
}

export interface BanEntry {
	user: {
		id: string;
		username: string;
		discriminator: string;
		avatar?: string;
	};
	reason?: string;
	bannedAt: string;
	bannedBy: string;
	caseId?: string;
}

export interface MuteEntry {
	userId: string;
	username: string;
	mutedAt: string;
	mutedBy: string;
	expiresAt?: string;
	reason?: string;
	caseId?: string;
}

export interface Warning {
	id: string;
	userId: string;
	moderatorId: string;
	reason: string;
	points: number;
	createdAt: string;
	caseId?: string;
}

export interface ModerationSettings {
	guildId: string;
	mutedRoleId?: string;
	modLogChannelId?: string;
	autoModEnabled: boolean;
	warnThreshold: number;
	muteThreshold: number;
	kickThreshold: number;
	banThreshold: number;
	pointDecayDays: number;
	dmOnPunishment: boolean;
	requireReason: boolean;
	publicModLog: boolean;
	anonymousLogging: boolean;
}

export interface AutoModRule {
	id: string;
	guildId: string;
	name: string;
	type:
		| 'spam'
		| 'profanity'
		| 'caps'
		| 'links'
		| 'mentions'
		| 'attachments'
		| 'custom';
	enabled: boolean;
	triggers: {
		keywords?: string[];
		regex?: string;
		threshold?: number;
		whitelist?: string[];
	};
	actions: {
		delete?: boolean;
		warn?: boolean;
		mute?: boolean;
		kick?: boolean;
		ban?: boolean;
		timeout?: number;
		addRole?: string;
		removeRole?: string;
	};
	exemptRoles: string[];
	exemptChannels: string[];
	exemptUsers: string[];
	logChannel?: string;
	sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
	createdAt: string;
	updatedAt: string;
}

export interface ModeratorNote {
	id: string;
	guildId: string;
	userId: string;
	moderatorId: string;
	content: string;
	isInternal: boolean;
	createdAt: string;
	updatedAt: string;
}
