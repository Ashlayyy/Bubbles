
import type { AuditLogUser } from './audit-log';

export type AutoModPunishment = 'delete' | 'warn' | 'timeout' | 'kick' | 'ban';

export interface WordFilterSettings {
  enabled: boolean;
  words: string[];
  punishments: AutoModPunishment[];
  timeoutDuration: number;
  banDuration: number;
  banDurationUnit: 'minutes' | 'hours' | 'days';
}

export interface AutoModSettings {
  blockInvites: boolean;
  blockLinks: boolean;
  blockLinksIgnoredRoleIds: string[];
  antiMassMention: boolean;
  antiMassMentionPunishments: AutoModPunishment[];
  antiMassMentionTimeoutDuration: number;
  antiMassMentionBanDuration: number;
  antiMassMentionBanDurationUnit: 'minutes' | 'hours' | 'days';
  antiSpam: boolean;
  antiSpamPunishments: AutoModPunishment[];
  antiSpamTimeoutDuration: number;
  antiSpamBanDuration: number;
  antiSpamBanDurationUnit: 'minutes' | 'hours' | 'days';
  wordFilter: WordFilterSettings;
}

export interface MutedUser {
  user: AuditLogUser;
  mutedUntil: Date;
  reason: string;
  moderator: AuditLogUser;
}

export interface BannedUser {
  user: AuditLogUser;
  reason: string;
  moderator: AuditLogUser;
  bannedUntil: Date | null;
}

export interface ModeratorNote {
  id: string;
  moderator: AuditLogUser;
  content: string;
  timestamp: Date;
}

export interface LeaderboardEntry {
  user: AuditLogUser;
  actions: {
    ban: number;
    mute: number;
    kick: number;
    warn: number;
    total: number;
  }
}
