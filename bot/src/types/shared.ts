// Shared types for Queue system
export interface BaseJob {
  id: string;
  timestamp: number;
  guildId?: string;
  userId?: string;
}

export interface SendMessageJob extends BaseJob {
  type: "SEND_MESSAGE";
  channelId: string;
  content: string;
  embeds?: any[];
}

export interface ModerationActionJob extends BaseJob {
  type: "BAN_USER" | "KICK_USER" | "TIMEOUT_USER" | "UNBAN_USER";
  targetUserId: string;
  reason?: string;
  duration?: number;
}

export interface MusicActionJob extends BaseJob {
  type: "PLAY_MUSIC" | "PAUSE_MUSIC" | "SKIP_MUSIC" | "STOP_MUSIC" | "SET_VOLUME";
  query?: string;
  volume?: number;
}

export interface DiscordEventJob extends BaseJob {
  type: "MEMBER_JOIN" | "MEMBER_LEAVE" | "MESSAGE_DELETE" | "MESSAGE_UPDATE" | "ROLE_UPDATE";
  data: any;
}

export interface ModerationEventJob extends BaseJob {
  type: "MODERATION_ACTION_COMPLETED" | "MODERATION_ACTION_FAILED";
  actionType: string;
  success: boolean;
  error?: string;
}

export type BotCommandJob = SendMessageJob | ModerationActionJob | MusicActionJob;
export type BotEventJob = DiscordEventJob | ModerationEventJob;
export type QueueJob = BotCommandJob | BotEventJob;

export const QUEUE_NAMES = {
  BOT_COMMANDS: "bot-commands",
  BOT_EVENTS: "bot-events",
  NOTIFICATIONS: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Simple logger for Bot
export const createLogger = (serviceName: string) => {
  const log = (level: string, message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${serviceName}] [${level.toUpperCase()}] ${message}`, ...args);
  };

  return {
    info: (message: string, ...args: unknown[]) => {
      log("info", message, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
      log("error", message, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
      log("warn", message, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
      log("debug", message, ...args);
    },
    verbose: (message: string, ...args: unknown[]) => {
      log("verbose", message, ...args);
    },
  };
};
