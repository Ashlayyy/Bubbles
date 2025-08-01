import type { Prisma } from "@shared/database";
import type { EmbedBuilder, TextChannel, User } from "discord.js";
import { EmbedBuilder as DiscordEmbedBuilder } from "discord.js";

import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cacheService } from "../services/cacheService.js";
import type Client from "./Client.js";

// Log types organized by category for easy management
export const LOG_CATEGORIES = {
  HIGH_VOLUME: [
    // Message spam - very high volume
    "MESSAGE_CREATE",

    // Voice self-actions & media
    "VOICE_SELF_MUTE",
    "VOICE_SELF_UNMUTE",
    "VOICE_SELF_DEAFEN",
    "VOICE_SELF_UNDEAFEN",
    "VOICE_START_STREAM",
    "VOICE_STOP_STREAM",
    "VOICE_START_VIDEO",
    "VOICE_STOP_VIDEO",

    // Reaction spam
    "MESSAGE_REACTION_ADD",
    "MESSAGE_REACTION_REMOVE",

    // Presence & status changes - extremely high volume
    "MEMBER_STATUS_CHANGE",
    "MEMBER_COME_ONLINE",
    "MEMBER_GO_OFFLINE",

    // Additional high-volume events
    "MESSAGE_ATTACHMENT_DELETE",
    "MESSAGE_EMBED_UPDATE",
    "MESSAGE_CROSSPOST",
    "MESSAGE_SUPPRESS_EMBEDS",
    "STICKER_USAGE",
    "VOICE_STAGE_SPEAKER_CHANGE",
  ],
  MESSAGE: [
    // Keep only moderate-volume message events here
    "MESSAGE_DELETE",
    "MESSAGE_EDIT",
    "MESSAGE_BULK_DELETE",
    "MESSAGE_PIN",
    "MESSAGE_REACTION_CLEAR",
    "MESSAGE_THREAD_CREATE",
    "MESSAGE_AUTOMOD_TRIGGER",
    "MESSAGE_SPAM_DETECTED",
    "MESSAGE_LINK_FILTER",
    // Alternative names for compatibility
    "REACTION_ADD",
    "REACTION_REMOVE",
    "REACTION_EMOJI_REMOVE",
    "REACTION_REMOVE_ALL",
  ],
  MEMBER: [
    // Important member events - keep these in standard logging
    "MEMBER_JOIN",
    "MEMBER_LEAVE",
    "MEMBER_UPDATE",
    "MEMBER_TIMEOUT",
    "MEMBER_TIMEOUT_REMOVE",
    "MEMBER_KICK",
    "MEMBER_BAN",
    "MEMBER_UNBAN",
    "MEMBER_NICKNAME_CHANGE",
    "MEMBER_AVATAR_CHANGE",
    "MEMBER_BOOST_START",
    "MEMBER_BOOST_STOP",
    "MEMBER_PENDING_UPDATE",
    "MEMBER_FLAGS_UPDATE",
    "MEMBER_ROLE_ADD",
    "MEMBER_ROLE_REMOVE",
    "MEMBER_ROLE_UPDATE",
    "MEMBER_COMMUNICATION_DISABLED",
    "MEMBER_MOVE",
    "MEMBER_MENTION_SPAM",
  ],
  ROLE: [
    "ROLE_CREATE",
    "ROLE_DELETE",
    "ROLE_UPDATE",
    "ROLE_PERMISSIONS_UPDATE",
    "ROLE_NAME_CHANGE",
    "ROLE_COLOR_CHANGE",
    "ROLE_POSITION_CHANGE",
    "ROLE_MENTIONABLE_CHANGE",
    "ROLE_HOIST_CHANGE",
    "ROLE_ICON_CHANGE",
    "ROLE_UNICODE_EMOJI_CHANGE",
    "ROLE_MASS_ASSIGNMENT",
  ],
  CHANNEL: [
    "CHANNEL_CREATE",
    "CHANNEL_DELETE",
    "CHANNEL_UPDATE",
    "CHANNEL_NAME_CHANGE",
    "CHANNEL_TOPIC_CHANGE",
    "CHANNEL_PERMISSION_UPDATE",
    "CHANNEL_SLOWMODE_CHANGE",
    "CHANNEL_NSFW_CHANGE",
    "CHANNEL_POSITION_CHANGE",
    "CHANNEL_CATEGORY_CHANGE",
    "CHANNEL_RATE_LIMIT_CHANGE",
    "CHANNEL_THREAD_CREATE",
    "CHANNEL_THREAD_DELETE",
    "CHANNEL_THREAD_UPDATE",
    "CHANNEL_THREAD_ARCHIVE",
    "CHANNEL_THREAD_UNARCHIVE",
    "CHANNEL_THREAD_LOCK",
    "CHANNEL_FORUM_TAG_UPDATE",
  ],
  VOICE: [
    // Keep only server-initiated and important voice events
    "VOICE_JOIN",
    "VOICE_LEAVE",
    "VOICE_MOVE",
    "VOICE_MUTE",
    "VOICE_UNMUTE",
    "VOICE_DEAFEN",
    "VOICE_UNDEAFEN",
    "VOICE_STREAM_START",
    "VOICE_STREAM_STOP",
    // Server-initiated voice actions - these are important
    "VOICE_SERVER_MUTE",
    "VOICE_SERVER_UNMUTE",
    "VOICE_SERVER_DEAFEN",
    "VOICE_SERVER_UNDEAFEN",
  ],
  SERVER: [
    "SERVER_UPDATE",
    "SERVER_NAME_CHANGE",
    "SERVER_ICON_CHANGE",
    "SERVER_BANNER_CHANGE",
    "SERVER_SPLASH_CHANGE",
    "SERVER_DISCOVERY_SPLASH_CHANGE",
    "SERVER_AFK_CHANNEL_CHANGE",
    "SERVER_AFK_TIMEOUT_CHANGE",
    "SERVER_WIDGET_CHANGE",
    "SERVER_VERIFICATION_LEVEL_CHANGE",
    "SERVER_EXPLICIT_CONTENT_FILTER_CHANGE",
    "SERVER_MFA_LEVEL_CHANGE",
    "SERVER_SYSTEM_CHANNEL_CHANGE",
    "SERVER_RULES_CHANNEL_CHANGE",
    "SERVER_PUBLIC_UPDATES_CHANNEL_CHANGE",
    // Guild/Server aliases
    "GUILD_UPDATE",
    "GUILD_UNAVAILABLE",
  ],
  MODERATION: [
    "MOD_CASE_CREATE",
    "MOD_CASE_UPDATE",
    "MOD_CASE_NOTE_ADD",
    "MOD_WARN_ISSUED",
    "MOD_MUTE_ISSUED",
    "MOD_UNMUTE_ISSUED",
    "MOD_APPEAL_SUBMITTED",
    "MOD_APPEAL_APPROVED",
    "MOD_APPEAL_DENIED",
    "MOD_AUTOMOD_ACTION",
    "MOD_MASS_BAN",
    "MOD_RAID_DETECTED",
    "MOD_ESCALATION_TRIGGERED",
    "MOD_SCHEDULED_ACTION",
    "MOD_MANUAL_ACTION",
    "MOD_BAN",
    "MOD_KICK",
    "MOD_WARN",
    "MOD_NOTE",
    "MOD_TIMEOUT",
    "MOD_UNBAN",
    "MOD_UNTIMEOUT",
    "USER_REPORT",
  ],
  INVITE: ["INVITE_CREATE", "INVITE_DELETE", "INVITE_USE", "INVITE_EXPIRE", "INVITE_VANITY_UPDATE", "INVITE_TRACKING"],
  EMOJI: [
    "EMOJI_CREATE",
    "EMOJI_DELETE",
    "EMOJI_UPDATE",
    "EMOJI_NAME_CHANGE",
    "STICKER_CREATE",
    "STICKER_DELETE",
    "STICKER_UPDATE",
  ],
  WEBHOOK: ["WEBHOOK_CREATE", "WEBHOOK_DELETE", "WEBHOOK_UPDATE", "WEBHOOK_MESSAGE", "WEBHOOK_TOKEN_RESET"],
  BOT: [
    "BOT_ADD",
    "BOT_REMOVE",
    "BOT_PERMISSIONS_UPDATE",
    "BOT_GUILD_JOIN",
    "BOT_GUILD_LEAVE",
    "APPLICATION_COMMAND_CREATE",
    "APPLICATION_COMMAND_DELETE",
    "APPLICATION_COMMAND_UPDATE",
    "APPLICATION_COMMAND_USE",
    "APPLICATION_COMMAND_PERMISSIONS_UPDATE",
    "INTEGRATION_UPDATE",
    "INTEGRATION_DETAILS",
  ],
  REACTION_ROLE: [
    "REACTION_ROLE_ADDED", // User gained a role via reaction
    "REACTION_ROLE_REMOVED", // User lost a role via reaction
    "REACTION_ROLE_CONFIG_ADD", // Reaction role configuration added
    "REACTION_ROLE_CONFIG_REMOVE", // Reaction role configuration removed
    "REACTION_ROLE_MESSAGE_CREATE", // New reaction role message created
    "REACTION_ROLE_MESSAGE_UPDATE", // Reaction role message edited
    "REACTION_ROLE_MESSAGE_DELETE", // Reaction role message deleted
    "REACTION_ROLE_ERROR", // Error in reaction role processing
  ],
  AUTOMOD: [
    "AUTOMOD_RULE_CREATE",
    "AUTOMOD_RULE_DELETE",
    "AUTOMOD_RULE_UPDATE",
    "AUTOMOD_RULE_TRIGGER",
    "AUTOMOD_ACTION_EXECUTE",
    "AUTOMOD_BYPASS",
    "AUTOMOD_RULE_TOGGLE",
  ],
  SYSTEM: [
    "RATE_LIMIT_HIT",
    "INVALID_REQUEST_WARNING",
    "WEBHOOKS_UPDATE",
    "GUILD_MEMBERS_CHUNK",
    "CLIENT_INVALIDATED",
    "GUILD_MEMBER_AVAILABLE",
    "SHARD_DISCONNECT",
    "SHARD_ERROR",
    "SHARD_READY",
    "SHARD_RECONNECTING",
    "SHARD_RESUME",
  ],
  TICKET: ["TICKET_CREATE", "TICKET_CLOSE", "TICKET_CLAIM", "TICKET_CONFIG_CHANGE", "TICKET_PANEL_CREATE"],
  COMMAND: ["COMMAND_USERINFO", "COMMAND_SERVERINFO", "COMMAND_AVATAR"],
  POLL: ["POLL_CREATE", "POLL_END"],
  THREAD: ["THREAD_CREATE", "THREAD_DELETE", "THREAD_UPDATE", "THREAD_LIST_SYNC", "THREAD_MEMBERS_UPDATE"],
  SCHEDULED_EVENT: [
    "SCHEDULED_EVENT_CREATE",
    "SCHEDULED_EVENT_UPDATE",
    "SCHEDULED_EVENT_DELETE",
    "SCHEDULED_EVENT_USER_ADD",
    "SCHEDULED_EVENT_USER_REMOVE",
  ],
  USER: ["USER_UPDATE"],
  WELCOME: ["WELCOME_CONFIG"],
  CHANNEL_PINS: ["CHANNEL_PINS_UPDATE"],
} as const;

// Enhanced log type definitions with visual indicators
export const LOG_TYPE_INDICATORS = {
  // Member events
  MEMBER_JOIN: { emoji: "🟢", color: 0x2ecc71, title: "Member Joined", category: "MEMBER" },
  MEMBER_LEAVE: { emoji: "🔴", color: 0xe74c3c, title: "Member Left", category: "MEMBER" },
  MEMBER_BAN: { emoji: "🚫", color: 0xc0392b, title: "Member Banned", category: "MEMBER" },
  MEMBER_UNBAN: { emoji: "✅", color: 0x27ae60, title: "Member Unbanned", category: "MEMBER" },
  MEMBER_KICK: { emoji: "👢", color: 0xe67e22, title: "Member Kicked", category: "MEMBER" },
  MEMBER_TIMEOUT: { emoji: "⏰", color: 0xf1c40f, title: "Member Timed Out", category: "MEMBER" },
  MEMBER_TIMEOUT_REMOVE: { emoji: "⏰", color: 0x3498db, title: "Timeout Removed", category: "MEMBER" },
  MEMBER_UPDATE: { emoji: "👤", color: 0x9b59b6, title: "Member Updated", category: "MEMBER" },
  MEMBER_ROLE_ADD: { emoji: "➕", color: 0x2ecc71, title: "Role Added", category: "MEMBER" },
  MEMBER_ROLE_REMOVE: { emoji: "➖", color: 0xe67e22, title: "Role Removed", category: "MEMBER" },
  MEMBER_NICKNAME_CHANGE: { emoji: "📝", color: 0x9b59b6, title: "Nickname Changed", category: "MEMBER" },
  MEMBER_AVATAR_CHANGE: { emoji: "🖼️", color: 0x9b59b6, title: "Avatar Changed", category: "MEMBER" },

  // Message events
  MESSAGE_DELETE: { emoji: "🗑️", color: 0xe74c3c, title: "Message Deleted", category: "MESSAGE" },
  MESSAGE_EDIT: { emoji: "✏️", color: 0xe67e22, title: "Message Edited", category: "MESSAGE" },
  MESSAGE_BULK_DELETE: { emoji: "🗑️", color: 0xc0392b, title: "Messages Bulk Deleted", category: "MESSAGE" },
  MESSAGE_PIN: { emoji: "📌", color: 0xf39c12, title: "Message Pinned", category: "MESSAGE" },
  MESSAGE_UNPIN: { emoji: "📌", color: 0x95a5a6, title: "Message Unpinned", category: "MESSAGE" },

  // Role events
  ROLE_CREATE: { emoji: "🆕", color: 0x1abc9c, title: "Role Created", category: "ROLE" },
  ROLE_DELETE: { emoji: "🗑️", color: 0xe74c3c, title: "Role Deleted", category: "ROLE" },
  ROLE_UPDATE: { emoji: "⚙️", color: 0xf39c12, title: "Role Updated", category: "ROLE" },
  ROLE_PERMISSION_CHANGE: { emoji: "🔐", color: 0xf39c12, title: "Role Permissions Changed", category: "ROLE" },
  ROLE_COLOR_CHANGE: { emoji: "🎨", color: 0xf39c12, title: "Role Color Changed", category: "ROLE" },
  ROLE_NAME_CHANGE: { emoji: "📝", color: 0xf39c12, title: "Role Name Changed", category: "ROLE" },

  // Channel events
  CHANNEL_CREATE: { emoji: "📝", color: 0x1abc9c, title: "Channel Created", category: "CHANNEL" },
  CHANNEL_DELETE: { emoji: "🗑️", color: 0xe74c3c, title: "Channel Deleted", category: "CHANNEL" },
  CHANNEL_UPDATE: { emoji: "⚙️", color: 0xf39c12, title: "Channel Updated", category: "CHANNEL" },

  // Voice events
  VOICE_JOIN: { emoji: "🎤", color: 0x2ecc71, title: "Voice Joined", category: "VOICE" },
  VOICE_LEAVE: { emoji: "🎤", color: 0xe74c3c, title: "Voice Left", category: "VOICE" },
  VOICE_MOVE: { emoji: "🔄", color: 0x3498db, title: "Voice Moved", category: "VOICE" },

  // Moderation events
  MOD_BAN: { emoji: "🚫", color: 0xc0392b, title: "User Banned", category: "MODERATION" },
  MOD_UNBAN: { emoji: "✅", color: 0x27ae60, title: "User Unbanned", category: "MODERATION" },
  MOD_KICK: { emoji: "👢", color: 0xe67e22, title: "User Kicked", category: "MODERATION" },
  MOD_TIMEOUT: { emoji: "⏰", color: 0xf1c40f, title: "User Timed Out", category: "MODERATION" },
  MOD_TIMEOUT_REMOVE: { emoji: "⏰", color: 0x3498db, title: "Timeout Removed", category: "MODERATION" },
  MOD_WARN: { emoji: "⚠️", color: 0xf39c12, title: "User Warned", category: "MODERATION" },

  // User events
  USER_UPDATE: { emoji: "👤", color: 0x9b59b6, title: "User Updated", category: "USER" },

  // System events
  RATE_LIMIT_HIT: { emoji: "🚦", color: 0xe74c3c, title: "Rate Limit Hit", category: "SYSTEM" },
  SHARD_ERROR: { emoji: "💥", color: 0xe74c3c, title: "Shard Error", category: "SYSTEM" },
  SHARD_READY: { emoji: "✅", color: 0x2ecc71, title: "Shard Ready", category: "SYSTEM" },

  // Ticket events
  TICKET_CREATE: { emoji: "🎫", color: 0x1abc9c, title: "Ticket Created", category: "TICKET" },
  TICKET_CLOSE: { emoji: "🔒", color: 0xe74c3c, title: "Ticket Closed", category: "TICKET" },

  // Reaction role events
  REACTION_ROLE_ADDED: { emoji: "➕", color: 0x2ecc71, title: "Reaction Role Added", category: "REACTION_ROLE" },
  REACTION_ROLE_REMOVED: { emoji: "➖", color: 0xe67e22, title: "Reaction Role Removed", category: "REACTION_ROLE" },

  // Automod events
  AUTOMOD_RULE_TRIGGER: { emoji: "🛡️", color: 0xe74c3c, title: "AutoMod Triggered", category: "AUTOMOD" },
  AUTOMOD_ACTION_EXECUTE: { emoji: "⚡", color: 0xf39c12, title: "AutoMod Action", category: "AUTOMOD" },
} as const;

// Flatten all log types for easy validation
export const ALL_LOG_TYPES = Object.values(LOG_CATEGORIES).flat();

// Standard log types - excludes high-volume events for better defaults
export const STANDARD_LOG_TYPES = Object.entries(LOG_CATEGORIES)
  .filter(([category]) => category !== "HIGH_VOLUME")
  .flatMap(([, types]) => types)
  .filter((type) => {
    // Also exclude some specific high-frequency events from other categories
    const excludeSpecific = [
      "APPLICATION_COMMAND_USE", // High volume
      "COMMAND_USERINFO", // High volume
      "COMMAND_SERVERINFO", // High volume
      "COMMAND_AVATAR", // High volume
      "THREAD_LIST_SYNC", // Technical/high volume
      "THREAD_MEMBERS_UPDATE", // High volume
      "GUILD_MEMBERS_CHUNK", // Technical/high volume
      "CHANNEL_PINS_UPDATE", // Can be high volume
    ];
    return !excludeSpecific.includes(type);
  });

export interface LogEvent {
  guildId: string;
  logType: string;
  userId?: string;
  channelId?: string;
  roleId?: string;
  caseId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  content?: string;
  attachments?: string[];
  embeds?: Prisma.InputJsonValue[];
  executorId?: string;
  reason?: string;
}

export interface LogSettings {
  channelRouting: Record<string, string>;
  ignoredUsers: string[];
  ignoredRoles: string[];
  ignoredChannels: string[];
  enabledLogTypes: string[];
  customFormats?: Record<string, unknown>;
}

export interface LogEntry {
  id: string;
  guildId: string;
  logType: string;
  userId?: string | null;
  channelId?: string | null;
  roleId?: string | null;
  caseId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  content?: string | null;
  attachments: string[];
  embeds: unknown[];
  executorId?: string | null;
  reason?: string | null;
  timestamp: Date;
}

export default class LogManager {
  private client: Client;
  private settingsCache = new Map<string, LogSettings>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Log batching system for performance
  private logBatch = new Map<string, LogEntry[]>();
  private batchTimeout = 2000; // 2 seconds
  private batchSize = 10; // Max logs per batch
  private batchTimers = new Map<string, NodeJS.Timeout>();

  // Performance tracking
  private performanceMetrics = {
    totalLogs: 0,
    batchedLogs: 0,
    averageProcessingTime: 0,
    slowLogs: 0,
  };

  constructor(client: Client) {
    this.client = client;

    // Start performance monitoring
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 60000); // Every minute
  }

  /**
   * Main logging method - super easy to use!
   * Just call: logManager.log(guildId, "MESSAGE_DELETE", { userId, content, etc... })
   */
  async log(guildId: string, logType: string, data: Partial<LogEvent> = {}): Promise<void> {
    const startTime = Date.now();

    try {
      const isModerationLog = /^MOD_[A-Z_]+$/.test(logType);
      if (!ALL_LOG_TYPES.includes(logType as (typeof ALL_LOG_TYPES)[number]) && !isModerationLog) {
        logger.warn(`Invalid log type: ${logType}`);
        return;
      }

      // Get settings for this guild
      const settings = await this.getLogSettings(guildId);

      // Check if this log type is enabled
      if (!settings.enabledLogTypes.includes(logType)) {
        return; // Log type disabled
      }

      // Check ignore lists
      if (data.userId && settings.ignoredUsers.includes(data.userId)) return;
      if (data.channelId && settings.ignoredChannels.includes(data.channelId)) return;
      if (data.roleId && settings.ignoredRoles.includes(data.roleId)) return;

      // Create the log entry – but skip the DB write for high-volume events to save space
      const isHighVolume = new Set<string>(LOG_CATEGORIES.HIGH_VOLUME as readonly string[]).has(logType);

      const logEntry = isHighVolume
        ? this.createStubLogEntry(guildId, logType, data)
        : await this.createLogEntry(guildId, logType, data);

      // Add performance tracking to metadata
      if (logEntry.metadata && typeof logEntry.metadata === "object") {
        (logEntry.metadata as any).processingTime = Date.now() - startTime;
      }

      // Use batching for better performance
      await this.addToBatch(guildId, logType, logEntry, settings);

      // Update performance metrics
      this.updatePerformanceMetrics(Date.now() - startTime);
    } catch (error) {
      logger.error("Error in LogManager.log:", error);
    }
  }

  /**
   * Get log settings with caching
   */
  private async getLogSettings(guildId: string): Promise<LogSettings> {
    const cacheKey = `logs:settings:${guildId}`;

    try {
      // Try cache first
      const cached = await cacheService.get<LogSettings>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      const logSettings: LogSettings = {
        // Ensure we always return a real object for channelRouting to avoid undefined errors
        channelRouting: (settings?.channelRouting as Record<string, string> | null) ?? {},
        ignoredUsers: settings?.ignoredUsers ?? [],
        ignoredRoles: settings?.ignoredRoles ?? [],
        ignoredChannels: settings?.ignoredChannels ?? [],
        enabledLogTypes: settings?.enabledLogTypes ?? [],
        customFormats: settings?.customFormats as Record<string, unknown> | undefined,
      };

      // Cache result
      cacheService.set(cacheKey, logSettings, 5 * 60 * 1000); // 5 minutes

      return logSettings;
    } catch (error) {
      logger.error(`Error getting log settings for ${guildId}:`, error);
      return {
        channelRouting: {},
        ignoredUsers: [],
        ignoredRoles: [],
        ignoredChannels: [],
        enabledLogTypes: [],
      };
    }
  }

  /**
   * Invalidate log settings cache
   */
  static async invalidateLogSettingsCache(guildId: string): Promise<void> {
    cacheService.delete(`logs:settings:${guildId}`);
  }

  /**
   * Create log entry in database
   */
  private async createLogEntry(guildId: string, logType: string, data: Partial<LogEvent>): Promise<LogEntry> {
    const logEntry = await prisma.moderationLog.create({
      data: {
        guildId,
        logType,
        userId: data.userId,
        channelId: data.channelId,
        roleId: data.roleId,
        caseId: data.caseId,
        before: data.before ?? null,
        after: data.after ?? null,
        metadata: data.metadata ?? null,
        content: data.content,
        attachments: data.attachments ?? [],
        embeds: data.embeds ?? [],
        executorId: data.executorId,
        reason: data.reason,
        timestamp: new Date(),
      },
    });

    return logEntry as LogEntry;
  }

  /**
   * Build an in-memory LogEntry object (not persisted) for events we don't want to store.
   */
  private createStubLogEntry(guildId: string, logType: string, data: Partial<LogEvent>): LogEntry {
    return {
      id: `stub_${String(Date.now().toString(36))}${String(Math.random().toString(36).slice(2, 6))}`,
      guildId,
      logType,
      userId: data.userId ?? null,
      channelId: data.channelId ?? null,
      roleId: data.roleId ?? null,
      caseId: data.caseId ?? null,
      before: data.before ?? null,
      after: data.after ?? null,
      metadata: data.metadata ?? null,
      content: data.content ?? null,
      attachments: data.attachments ?? [],
      embeds: data.embeds ?? [],
      executorId: data.executorId ?? null,
      reason: data.reason ?? null,
      timestamp: new Date(),
    } as LogEntry;
  }

  /**
   * Add log entry to batch for efficient processing
   */
  private async addToBatch(guildId: string, logType: string, logEntry: LogEntry, settings: LogSettings) {
    const batchKey = `${guildId}:${this.getLogCategory(logType)}`;

    if (!this.logBatch.has(batchKey)) {
      this.logBatch.set(batchKey, []);
    }

    const batch = this.logBatch.get(batchKey)!;
    batch.push(logEntry);

    // Clear existing timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey));
    }

    // Process batch immediately if it's full
    if (batch.length >= this.batchSize) {
      await this.processBatch(batchKey, settings);
    } else {
      // Set timer to process batch after timeout
      const timer = setTimeout(() => {
        this.processBatch(batchKey, settings);
      }, this.batchTimeout);

      this.batchTimers.set(batchKey, timer);
    }
  }

  /**
   * Process a batch of log entries
   */
  private async processBatch(batchKey: string, settings: LogSettings) {
    const batch = this.logBatch.get(batchKey);
    if (!batch || batch.length === 0) return;

    try {
      const [guildId, category] = batchKey.split(":");

      // Determine channel for this batch
      const channelId = this.getLogChannelId(guildId, category, settings);
      if (!channelId) return;

      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return;

      // Create enhanced batch embed
      const embed = this.createBatchEmbed(batch, category);

      // Send the batch
      await (channel as TextChannel).send({ embeds: [embed] });

      // Update metrics
      this.performanceMetrics.batchedLogs += batch.length;

      // Clear the batch
      this.logBatch.delete(batchKey);
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey));
        this.batchTimers.delete(batchKey);
      }
    } catch (error) {
      logger.error("Error processing log batch:", error);
    }
  }

  /**
   * Create enhanced batch embed
   */
  private createBatchEmbed(batch: LogEntry[], category: string): EmbedBuilder {
    const embed = new DiscordEmbedBuilder()
      .setTitle(`📊 ${category} Activity Summary`)
      .setColor(this.getCategoryColor(category))
      .setTimestamp()
      .setFooter({
        text: `${batch.length} events • ${new Date().toLocaleString()}`,
        iconURL: this.client.user?.displayAvatarURL(),
      });

    // Group events by type
    const eventCounts = new Map<string, number>();
    const recentEvents: { type: string; user: string; details: string }[] = [];

    for (const entry of batch) {
      const count = eventCounts.get(entry.logType) || 0;
      eventCounts.set(entry.logType, count + 1);

      // Add recent events to description
      if (recentEvents.length < 5) {
        const indicator = LOG_TYPE_INDICATORS[entry.logType as keyof typeof LOG_TYPE_INDICATORS];
        const emoji = indicator?.emoji || "📝";
        const user = entry.userId ? `<@${entry.userId}>` : "Unknown User";
        const details = this.getEventSummary(entry);

        recentEvents.push({
          type: entry.logType,
          user,
          details: `${emoji} ${user}: ${details}`,
        });
      }
    }

    // Add event summary
    const eventSummary = [...eventCounts.entries()]
      .map(([type, count]) => {
        const indicator = LOG_TYPE_INDICATORS[type as keyof typeof LOG_TYPE_INDICATORS];
        const emoji = indicator?.emoji || "📝";
        return `${emoji} ${type}: ${count}`;
      })
      .join("\n");

    embed.addFields(
      { name: "📈 Event Summary", value: eventSummary, inline: false },
      { name: "🕒 Recent Activity", value: recentEvents.map((e) => e.details).join("\n"), inline: false }
    );

    return embed;
  }

  /**
   * Get event summary for batch display
   */
  private getEventSummary(entry: LogEntry): string {
    switch (entry.logType) {
      case "MEMBER_JOIN":
        return "Joined the server";
      case "MEMBER_LEAVE":
        return "Left the server";
      case "MESSAGE_DELETE":
        return "Message deleted";
      case "MESSAGE_EDIT":
        return "Message edited";
      case "MEMBER_ROLE_ADD":
        return "Role added";
      case "MEMBER_ROLE_REMOVE":
        return "Role removed";
      default:
        return entry.logType.replace(/_/g, " ").toLowerCase();
    }
  }

  /**
   * Send log message to appropriate channels (legacy method for immediate sends)
   */
  private async sendToLogChannels(guildId: string, logType: string, logEntry: LogEntry, settings: LogSettings) {
    try {
      // Determine which channel to send to
      const channelId = this.getLogChannelId(guildId, logType, settings);
      if (!channelId) return;

      // Get the channel
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return;

      // Try to fetch full user object for richer embed details
      let user: User | undefined;
      if (logEntry.userId) {
        try {
          user = await this.client.users.fetch(logEntry.userId);
        } catch {
          // Ignore fetch errors and proceed without user data
        }
      }

      // Create embed with optional user information
      const embed = this.createLogEmbed(logType, logEntry, user);

      // Send the log message
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch (error) {
      logger.error("Error sending log message:", error);
    }
  }

  /**
   * Determine which channel to send log to
   */
  private getLogChannelId(guildId: string, logType: string, settings: LogSettings): string | null {
    // Prioritize category-based routing
    const category = this.getLogCategory(logType);
    if (category && settings.channelRouting[category]) {
      return settings.channelRouting[category];
    }

    // Fall back to specific event routing (for backward compatibility)
    if (settings.channelRouting[logType]) {
      return settings.channelRouting[logType];
    }

    // Fall back to default channels from GuildConfig
    return this.getDefaultChannelForCategory(category);
  }

  /**
   * Get category for a log type
   */
  private getLogCategory(logType: string): string | null {
    for (const [category, types] of Object.entries(LOG_CATEGORIES)) {
      if (types.some((type: string) => type === logType)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Get default channel for category
   */
  private getDefaultChannelForCategory(_category: string | null): string | null {
    // This would map to GuildConfig default channels
    // We'll implement this when we create the setup wizard
    return null;
  }

  /**
   * Create a beautiful embed for the log entry with enhanced visual indicators
   */
  private createLogEmbed(logType: string, logEntry: LogEntry, user?: User): EmbedBuilder {
    const embed = new DiscordEmbedBuilder().setTimestamp(logEntry.timestamp).setFooter({
      text: `Log ID: ${logEntry.id} • ${new Date().toLocaleString()}`,
      iconURL: this.client.user?.displayAvatarURL(),
    });

    // Get enhanced log type indicator
    const indicator = LOG_TYPE_INDICATORS[logType as keyof typeof LOG_TYPE_INDICATORS];

    if (indicator) {
      // Use enhanced indicator
      embed.setColor(indicator.color);
      embed.setTitle(`${indicator.emoji} ${indicator.title}`);
    } else {
      // Fallback to category-based color
      const category = this.getLogCategory(logType);
      const color = this.getCategoryColor(category, logType);
      embed.setColor(color);
      embed.setTitle(`📝 ${logType.replace(/_/g, " ")}`);
    }

    // Set description based on log type
    const description = this.getEnhancedLogDescription(logType, logEntry);
    if (description) embed.setDescription(description);

    // Add author field with user info if available
    if (user) {
      embed.setAuthor({
        name: `${user.username} (${user.id})`,
        iconURL: user.displayAvatarURL({ size: 64 }),
      });

      // Extra user details
      const createdTs = Math.floor(user.createdTimestamp / 1000);
      embed.addFields(
        {
          name: "🆔 User",
          value: `<@${user.id}> (\`${user.id}\`)`,
          inline: true,
        },
        {
          name: "📆 Account Created",
          value: `<t:${createdTs}:R>`,
          inline: true,
        }
      );
    } else if (logEntry.userId) {
      // Fallback if user object not available
      embed.setAuthor({
        name: `User ID: ${logEntry.userId}`,
      });
    }

    // Add comprehensive fields based on available data
    this.addDetailedFieldsToEmbed(embed, logEntry, logType);

    // Add metadata information
    this.addMetadataToEmbed(embed, logEntry, logType);

    // Add performance metrics if available
    this.addPerformanceMetricsToEmbed(embed, logEntry);

    return embed;
  }

  /**
   * Get color for category - enhanced with more specific colors
   */
  private getCategoryColor(category: string | null, logType?: string): number {
    // Message-specific colors for enhanced visual distinction
    if (category === "MESSAGE" && logType) {
      const messageColors = {
        MESSAGE_DELETE: 0xe74c3c, // Red - deleted messages
        MESSAGE_EDIT: 0xe67e22, // Orange - edited messages
        MESSAGE_BULK_DELETE: 0xc0392b, // Dark red - bulk deletions
        MESSAGE_PIN: 0xf39c12, // Gold - pinned messages
        MESSAGE_UNPIN: 0x95a5a6, // Gray - unpinned messages
      };
      return messageColors[logType as keyof typeof messageColors] || 0x3498db; // Default blue
    }

    // Member-specific colors
    if (category === "MEMBER" && logType) {
      const memberColors = {
        MEMBER_JOIN: 0x2ecc71, // Green - join
        MEMBER_LEAVE: 0x95a5a6, // Gray - leave
        MEMBER_BAN: 0xe74c3c, // Red - ban
        MEMBER_UNBAN: 0x27ae60, // Green - unban
        MEMBER_KICK: 0xe67e22, // Orange - kick
        MEMBER_TIMEOUT: 0xf1c40f, // Yellow - timeout
        MEMBER_TIMEOUT_REMOVE: 0x3498db, // Blue - timeout removed
        MEMBER_UPDATE: 0x9b59b6, // Purple - member update
      };
      return memberColors[logType as keyof typeof memberColors] || 0x2ecc71;
    }

    // Role-specific colors
    if (category === "ROLE" && logType) {
      const roleColors = {
        ROLE_CREATE: 0x1abc9c, // Teal - role created
        ROLE_DELETE: 0xe74c3c, // Red - role deleted
        ROLE_UPDATE: 0xf39c12, // Gold - role updated
        MEMBER_ROLE_ADD: 0x2ecc71, // Green - role added
        MEMBER_ROLE_REMOVE: 0xe67e22, // Orange - role removed
      };
      return roleColors[logType as keyof typeof roleColors] || 0x9b59b6;
    }

    // Channel-specific colors
    if (category === "CHANNEL" && logType) {
      const channelColors = {
        CHANNEL_CREATE: 0x1abc9c, // Teal - channel created
        CHANNEL_DELETE: 0xe74c3c, // Red - channel deleted
        CHANNEL_UPDATE: 0xf39c12, // Gold - channel updated
      };
      return channelColors[logType as keyof typeof channelColors] || 0xe67e22;
    }

    const colors = {
      MESSAGE: 0x3498db, // Blue - information (fallback)
      MEMBER: 0x2ecc71, // Green - positive/joins
      ROLE: 0x9b59b6, // Purple - permissions/roles
      CHANNEL: 0xe67e22, // Orange - structural changes
      VOICE: 0x1abc9c, // Turquoise - voice activities
      SERVER: 0xf39c12, // Gold - important server changes
      MODERATION: 0xe74c3c, // Red - disciplinary actions
      INVITE: 0x95a5a6, // Gray - invites
      EMOJI: 0xf1c40f, // Yellow - fun/cosmetic
      WEBHOOK: 0x34495e, // Dark gray - technical
      BOT: 0x8e44ad, // Dark purple - bot activities
      REACTION_ROLE: 0x16a085, // Dark turquoise - automation
      AUTOMOD: 0xc0392b, // Dark red - automated moderation
      SYSTEM: 0x2c3e50, // Dark blue - system events
      TICKET: 0x27ae60, // Green - support
      COMMAND: 0x6c5ce7, // Light purple - user interactions
      POLL: 0xa55eea, // Purple - engagement
      THREAD: 0x3742fa, // Blue - discussions
      SCHEDULED_EVENT: 0xff6b6b, // Light red - events
      USER: 0x48dbfb, // Light blue - user changes
      WELCOME: 0x0be881, // Bright green - welcoming
      CHANNEL_PINS: 0xffa502, // Orange - highlights
      HIGH_VOLUME: 0x7f8c8d, // Muted gray - less important
    };
    return colors[category as keyof typeof colors] || 0x95a5a6;
  }

  /**
   * Get enhanced description for log type
   */
  private getEnhancedLogDescription(logType: string, logEntry: LogEntry): string | undefined {
    const userMention = logEntry.userId ? `<@${logEntry.userId}>` : "Unknown User";
    const channelMention = logEntry.channelId ? `<#${logEntry.channelId}>` : "Unknown Channel";
    const executorMention = logEntry.executorId ? `<@${logEntry.executorId}>` : null;

    switch (logType) {
      case "MEMBER_JOIN": {
        const metadata = logEntry.metadata as any;
        const accountAge = metadata?.accountAge || "Unknown";
        const isSuspicious = metadata?.isSuspiciousAccount ? "⚠️ **Suspicious Account**" : "";

        return `${userMention} joined the server\n**Account Age:** ${accountAge}${isSuspicious ? `\n${isSuspicious}` : ""}`;
      }

      case "MEMBER_LEAVE":
        return `${userMention} left the server`;

      case "MEMBER_BAN":
        return `${userMention} was banned${executorMention ? ` by ${executorMention}` : ""}${logEntry.reason ? `\n**Reason:** ${logEntry.reason}` : ""}`;

      case "MEMBER_UNBAN":
        return `${userMention} was unbanned${executorMention ? ` by ${executorMention}` : ""}${logEntry.reason ? `\n**Reason:** ${logEntry.reason}` : ""}`;

      case "MEMBER_KICK":
        return `${userMention} was kicked${executorMention ? ` by ${executorMention}` : ""}${logEntry.reason ? `\n**Reason:** ${logEntry.reason}` : ""}`;

      case "MEMBER_TIMEOUT":
        return `${userMention} was timed out${executorMention ? ` by ${executorMention}` : ""}${logEntry.reason ? `\n**Reason:** ${logEntry.reason}` : ""}`;

      case "MEMBER_TIMEOUT_REMOVE":
        return `${userMention}'s timeout was removed${executorMention ? ` by ${executorMention}` : ""}`;

      case "MEMBER_UPDATE": {
        const metadata = logEntry.metadata as any;
        const changes = metadata?.changes || [];
        const changeText = changes.map((change: string) => `• ${change}`).join("\n");
        return `${userMention} was updated\n**Changes:**\n${changeText}`;
      }

      case "MEMBER_ROLE_ADD": {
        const metadata = logEntry.metadata as any;
        const roleName = metadata?.roleName || "Unknown Role";
        return `${userMention} was given the **${roleName}** role${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "MEMBER_ROLE_REMOVE": {
        const metadata = logEntry.metadata as any;
        const roleName = metadata?.roleName || "Unknown Role";
        return `${userMention} had the **${roleName}** role removed${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "MESSAGE_DELETE": {
        const metadata = logEntry.metadata as { deletionMethod?: string } | undefined;
        const deletionMethod = metadata?.deletionMethod ?? "unknown";
        let description = `A message by ${userMention} was deleted in ${channelMention}`;

        if (executorMention && deletionMethod === "moderator") {
          description += `\n**Deleted by:** ${executorMention}`;
        } else if (deletionMethod === "author") {
          description += `\n**Deleted by:** Message Author`;
        } else if (deletionMethod === "system") {
          description += `\n**Deleted by:** System/Bot`;
        }

        return description;
      }

      case "MESSAGE_EDIT":
        return `${userMention} edited a message in ${channelMention}`;

      case "MESSAGE_BULK_DELETE": {
        const metadata = logEntry.metadata as any;
        const count = metadata?.messageCount || "Unknown";
        return `${count} messages were bulk deleted in ${channelMention}${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "USER_UPDATE": {
        const metadata = logEntry.metadata as any;
        const changes = metadata?.changes || [];
        const changeText = changes.map((change: string) => `• ${change}`).join("\n");
        return `${userMention} updated their profile\n**Changes:**\n${changeText}`;
      }

      case "ROLE_CREATE": {
        const metadata = logEntry.metadata as any;
        const roleName = metadata?.roleName || "Unknown Role";
        return `Role **${roleName}** was created${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "ROLE_DELETE": {
        const metadata = logEntry.metadata as any;
        const roleName = metadata?.roleName || "Unknown Role";
        return `Role **${roleName}** was deleted${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "CHANNEL_CREATE": {
        const metadata = logEntry.metadata as any;
        const channelName = metadata?.channelName || "Unknown Channel";
        return `Channel **${channelName}** was created${executorMention ? ` by ${executorMention}` : ""}`;
      }

      case "CHANNEL_DELETE": {
        const metadata = logEntry.metadata as any;
        const channelName = metadata?.channelName || "Unknown Channel";
        return `Channel **${channelName}** was deleted${executorMention ? ` by ${executorMention}` : ""}`;
      }

      default:
        return undefined;
    }
  }

  /**
   * Add comprehensive fields to embed based on log type and available data
   */
  private addDetailedFieldsToEmbed(embed: EmbedBuilder, logEntry: LogEntry, logType: string) {
    // Channel information
    if (logEntry.channelId) {
      embed.addFields({
        name: "📍 Channel",
        value: `<#${logEntry.channelId}> (\`${logEntry.channelId}\`)`,
        inline: true,
      });
    }

    // User information (if not already in author)
    if (logEntry.userId && !embed.data.author) {
      embed.addFields({
        name: "👤 User",
        value: `<@${logEntry.userId}> (\`${logEntry.userId}\`)`,
        inline: true,
      });
    }

    // Executor information
    if (logEntry.executorId) {
      embed.addFields({
        name: "👤 Person",
        value: `<@${logEntry.executorId}> (\`${logEntry.executorId}\`)`,
        inline: true,
      });
    }

    // --- MEMBER_UPDATE: Added/Removed Roles as Mentions ---
    if (logType === "MEMBER_UPDATE" && logEntry.metadata) {
      const metadata = logEntry.metadata as Record<string, any>;
      if (Array.isArray(metadata.addedRoles) && metadata.addedRoles.length > 0) {
        const addedMentions = metadata.addedRoles.map((role: any) => `<@&${role.id}>`).join(", ");
        embed.addFields({
          name: "➕ Roles Added",
          value: addedMentions,
          inline: false,
        });
      }
      if (Array.isArray(metadata.removedRoles) && metadata.removedRoles.length > 0) {
        const removedMentions = metadata.removedRoles.map((role: any) => `<@&${role.id}>`).join(", ");
        embed.addFields({
          name: "➖ Roles Removed",
          value: removedMentions,
          inline: false,
        });
      }
      // Username change
      if (
        metadata.changes &&
        Array.isArray(metadata.changes) &&
        metadata.changes.includes("username") &&
        logEntry.before &&
        logEntry.after
      ) {
        const before = JSON.parse(logEntry.before as string);
        const after = JSON.parse(logEntry.after as string);
        embed.addFields({
          name: "📝 Username Changed",
          value: `Before: **${before.username ?? "Unknown"}**\nAfter: **${after.username ?? "Unknown"}**`,
          inline: false,
        });
      }
      // Nickname change
      if (
        metadata.changes &&
        Array.isArray(metadata.changes) &&
        metadata.changes.includes("nickname") &&
        logEntry.before &&
        logEntry.after
      ) {
        const before = JSON.parse(logEntry.before as string);
        const after = JSON.parse(logEntry.after as string);
        embed.addFields({
          name: "🏷️ Nickname Changed",
          value: `Before: **${before.nickname ?? "None"}**\nAfter: **${after.nickname ?? "None"}**`,
          inline: false,
        });
      }
      // Avatar change
      if (
        metadata.changes &&
        Array.isArray(metadata.changes) &&
        metadata.changes.includes("avatar") &&
        logEntry.before &&
        logEntry.after
      ) {
        const before = JSON.parse(logEntry.before as string);
        const after = JSON.parse(logEntry.after as string);
        embed.addFields({
          name: "🖼️ Avatar Changed",
          value: `[Before Avatar](https://cdn.discordapp.com/avatars/${logEntry.userId}/${before.avatar}.png) → [After Avatar](https://cdn.discordapp.com/avatars/${logEntry.userId}/${after.avatar}.png)`,
          inline: false,
        });
      }
      // Timeout change
      if (
        metadata.changes &&
        Array.isArray(metadata.changes) &&
        metadata.changes.includes("timeout") &&
        logEntry.before &&
        logEntry.after
      ) {
        const before = JSON.parse(logEntry.before as string);
        const after = JSON.parse(logEntry.after as string);
        embed.addFields({
          name: "⏰ Timeout Changed",
          value: `Before: **${before.communicationDisabledUntil ?? "None"}**\nAfter: **${after.communicationDisabledUntil ?? "None"}**`,
          inline: false,
        });
      }
    }

    // Case information for moderation actions
    if (logEntry.caseId) {
      embed.addFields({
        name: "📋 Case",
        value: `#${logEntry.caseId}`,
        inline: true,
      });
    }

    // Reason
    if (logEntry.reason) {
      embed.addFields({
        name: "📝 Reason",
        value: logEntry.reason.length > 1000 ? `${logEntry.reason.substring(0, 1000)}...` : logEntry.reason,
        inline: false,
      });
    }

    // Content for message-related logs
    if (logType === "MESSAGE_DELETE" || logType === "MESSAGE_BULK_DELETE") {
      // For deleted messages, always show content field (even if empty)
      const content =
        logEntry.content && logEntry.content.length > 0
          ? logEntry.content.length > 1000
            ? `${logEntry.content.substring(0, 1000)}...`
            : logEntry.content
          : "[No content or empty message]";

      embed.addFields({
        name: "💬 Content",
        value: `\`\`\`${content}\`\`\``,
        inline: false,
      });
    } else if (logEntry.content && logEntry.content.length > 0) {
      // For other log types, only show if content exists
      const content = logEntry.content.length > 1000 ? `${logEntry.content.substring(0, 1000)}...` : logEntry.content;
      embed.addFields({
        name: "💬 Content",
        value: `\`\`\`${content}\`\`\``,
        inline: false,
      });
    }

    // Before/After changes for edit logs
    if (logEntry.before || logEntry.after) {
      if (logType === "MESSAGE_EDIT") {
        const beforeData = logEntry.before as { content?: string } | undefined;
        const afterData = logEntry.after as { content?: string } | undefined;
        const before = beforeData?.content;
        const after = afterData?.content;

        if (before) {
          const beforeContent = before.length > 500 ? `${before.substring(0, 500)}...` : before;
          embed.addFields({
            name: "📜 Before Content",
            value: `\`\`\`${beforeContent}\`\`\``,
            inline: false,
          });
        }

        if (after) {
          const afterContent = after.length > 500 ? `${after.substring(0, 500)}...` : after;
          embed.addFields({
            name: "📝 After Content",
            value: `\`\`\`${afterContent}\`\`\``,
            inline: false,
          });
        }
      }
      // Role update diff
      if (logType === "ROLE_UPDATE" && logEntry.before && logEntry.after) {
        const before = typeof logEntry.before === "string" ? JSON.parse(logEntry.before) : logEntry.before;
        const after = typeof logEntry.after === "string" ? JSON.parse(logEntry.after) : logEntry.after;
        for (const key of Object.keys(before)) {
          if (before[key] !== after[key]) {
            embed.addFields({
              name: `🔄 ${key.charAt(0).toUpperCase() + key.slice(1)} Changed`,
              value: `Before: **${before[key]}**\nAfter: **${after[key]}**`,
              inline: false,
            });
          }
        }
      }
      // Channel update diff
      if (logType === "CHANNEL_UPDATE" && logEntry.before && logEntry.after) {
        const before = typeof logEntry.before === "string" ? JSON.parse(logEntry.before) : logEntry.before;
        const after = typeof logEntry.after === "string" ? JSON.parse(logEntry.after) : logEntry.after;
        for (const key of Object.keys(before)) {
          if (before[key] !== after[key]) {
            embed.addFields({
              name: `🔄 ${key.charAt(0).toUpperCase() + key.slice(1)} Changed`,
              value: `Before: **${before[key]}**\nAfter: **${after[key]}**`,
              inline: false,
            });
          }
        }
      }
    }

    // Attachments information
    if (logEntry.attachments.length > 0) {
      const attachmentList = logEntry.attachments
        .slice(0, 5)
        .map((url, index) => `[Attachment ${index + 1}](${url})`)
        .join("\n");

      embed.addFields({
        name: `📎 Attachments (${logEntry.attachments.length})`,
        value:
          attachmentList + (logEntry.attachments.length > 5 ? `\n... and ${logEntry.attachments.length - 5} more` : ""),
        inline: false,
      });
    }

    // Embed information
    if (logEntry.embeds.length > 0) {
      embed.addFields({
        name: "📋 Embeds",
        value: `${logEntry.embeds.length} embed(s) were included`,
        inline: true,
      });
    }
  }

  /**
   * Add metadata information to embed
   */
  private addMetadataToEmbed(embed: EmbedBuilder, logEntry: LogEntry, logType: string) {
    if (!logEntry.metadata) return;

    const metadata = logEntry.metadata as Record<string, unknown>;
    const metadataFields: string[] = [];

    // Message-specific metadata
    if (logType.startsWith("MESSAGE_")) {
      if (metadata.messageId && typeof metadata.messageId === "string") {
        metadataFields.push(`**Message ID:** \`${metadata.messageId}\``);
      }
      if (typeof metadata.hasAttachments === "boolean") {
        metadataFields.push(`**Had Attachments:** ${metadata.hasAttachments ? "Yes" : "No"}`);
      }
      if (typeof metadata.hasEmbeds === "boolean") {
        metadataFields.push(`**Had Embeds:** ${metadata.hasEmbeds ? "Yes" : "No"}`);
      }
      if (typeof metadata.wasCached === "boolean") {
        metadataFields.push(`**Was Cached:** ${metadata.wasCached ? "Yes" : "No"}`);
      }
      if (typeof metadata.deletedCount === "number") {
        metadataFields.push(`**Messages Deleted:** ${metadata.deletedCount}`);
      }

      // Enhanced deletion metadata
      if (logType === "MESSAGE_DELETE") {
        if (metadata.deletionMethod && typeof metadata.deletionMethod === "string") {
          const methodEmoji = {
            moderator: "👮",
            author: "👤",
            system: "🤖",
          };
          const emoji = methodEmoji[metadata.deletionMethod as keyof typeof methodEmoji] || "❓";
          metadataFields.push(`**Deletion Method:** ${emoji} ${metadata.deletionMethod}`);
        }
        if (metadata.deletionTimestamp && typeof metadata.deletionTimestamp === "string") {
          const deletionTime = Math.floor(new Date(metadata.deletionTimestamp).getTime() / 1000);
          metadataFields.push(`**Deleted At:** <t:${deletionTime}:T>`);
        }
      }
    }

    // Member-specific metadata
    if (logType.startsWith("MEMBER_")) {
      if (metadata.joinedAt && typeof metadata.joinedAt === "string") {
        metadataFields.push(`**Joined At:** <t:${Math.floor(new Date(metadata.joinedAt).getTime() / 1000)}:F>`);
      }
      if (metadata.accountAge && typeof metadata.accountAge === "string") {
        metadataFields.push(`**Account Age:** ${metadata.accountAge}`);
      }
      if (typeof metadata.memberCount === "number") {
        metadataFields.push(`**Server Members:** ${metadata.memberCount}`);
      }
    }

    // Role-specific metadata
    if (metadata.roleId && typeof metadata.roleId === "string") {
      metadataFields.push(`**Role:** <@&${metadata.roleId}> (\`${metadata.roleId}\`)`);
    }

    // Add metadata fields to embed
    if (metadataFields.length > 0) {
      embed.addFields({
        name: "📋 Metadata",
        value: metadataFields.join("\n"),
        inline: false,
      });
    }
  }

  /**
   * Set up category-based logging
   */
  async setupCategoryLogging(guildId: string, categoryMappings: Record<string, string>) {
    try {
      // Get current settings
      const currentSettings = await this.getLogSettings(guildId);

      // Create a new routing object that only includes category mappings
      const newRouting: Record<string, string> = {};

      // Add all category mappings
      for (const [category, channelId] of Object.entries(categoryMappings)) {
        if (category in LOG_CATEGORIES) {
          newRouting[category] = channelId;
        }
      }

      // Update settings with the new category-based routing
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          channelRouting: newRouting,
        },
        create: {
          guildId,
          channelRouting: newRouting,
          enabledLogTypes: STANDARD_LOG_TYPES, // Use STANDARD_LOG_TYPES instead of ALL_LOG_TYPES
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);

      return true;
    } catch (error) {
      logger.error("Error setting up category logging:", error);
      return false;
    }
  }

  /**
   * Add performance metrics to embed
   */
  private addPerformanceMetricsToEmbed(embed: EmbedBuilder, logEntry: LogEntry): void {
    const metadata = logEntry.metadata as any;
    if (metadata?.processingTime) {
      const processingTime = metadata.processingTime;
      const isSlow = processingTime > 1000;

      embed.addFields({
        name: isSlow ? "⚠️ Slow Processing" : "⚡ Processing Time",
        value: `${processingTime}ms`,
        inline: true,
      });
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    this.performanceMetrics.totalLogs++;
    this.performanceMetrics.averageProcessingTime =
      (this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.totalLogs - 1) + processingTime) /
      this.performanceMetrics.totalLogs;

    if (processingTime > 1000) {
      this.performanceMetrics.slowLogs++;
    }
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(): void {
    if (this.performanceMetrics.totalLogs > 0) {
      logger.info(
        `LogManager Performance Metrics ${JSON.stringify({
          totalLogs: this.performanceMetrics.totalLogs,
          batchedLogs: this.performanceMetrics.batchedLogs,
          averageProcessingTime: Math.round(this.performanceMetrics.averageProcessingTime),
          slowLogs: this.performanceMetrics.slowLogs,
          slowLogPercentage: Math.round((this.performanceMetrics.slowLogs / this.performanceMetrics.totalLogs) * 100),
        })}`
      );
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Easy setup method for initial configuration
   */
  async setupBasicLogging(guildId: string, channelMappings: Record<string, string>) {
    try {
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          channelRouting: channelMappings,
          enabledLogTypes: STANDARD_LOG_TYPES, // Use STANDARD_LOG_TYPES instead of ALL_LOG_TYPES
        },
        create: {
          guildId,
          channelRouting: channelMappings,
          enabledLogTypes: STANDARD_LOG_TYPES, // Use STANDARD_LOG_TYPES instead of ALL_LOG_TYPES
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);

      logger.info(`Basic logging setup completed for guild ${guildId}`);
    } catch (error) {
      logger.error("Error setting up basic logging:", error);
      throw error;
    }
  }

  /**
   * Enable all log types for a guild
   */
  async enableAllLogTypes(guildId: string) {
    try {
      await prisma.logSettings.upsert({
        where: { guildId },
        update: { enabledLogTypes: [...ALL_LOG_TYPES] },
        create: {
          guildId,
          channelRouting: {},
          enabledLogTypes: [...ALL_LOG_TYPES],
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);
    } catch (error) {
      logger.error("Error enabling all log types:", error);
      throw error;
    }
  }

  /**
   * Enable specific log types for a guild
   */
  async enableLogTypes(guildId: string, logTypes: string[]) {
    try {
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      const enabledTypes = [...(settings?.enabledLogTypes ?? [])];

      // Add new log types that aren't already enabled
      for (const logType of logTypes) {
        if (!enabledTypes.includes(logType)) {
          enabledTypes.push(logType);
        }
      }

      await prisma.logSettings.upsert({
        where: { guildId },
        update: { enabledLogTypes: enabledTypes },
        create: {
          guildId,
          enabledLogTypes: enabledTypes,
          channelRouting: {},
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);
    } catch (error) {
      logger.error("Error enabling log types:", error);
      throw error;
    }
  }

  /**
   * Disable specific log types for a guild
   */
  async disableLogTypes(guildId: string, logTypes: string[]) {
    try {
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      const enabledTypes = settings?.enabledLogTypes ?? [];

      // Remove specified log types
      const filteredTypes = enabledTypes.filter((type: string) => !logTypes.includes(type));

      await prisma.logSettings.upsert({
        where: { guildId },
        update: { enabledLogTypes: filteredTypes },
        create: {
          guildId,
          enabledLogTypes: filteredTypes,
          channelRouting: {},
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);
    } catch (error) {
      logger.error("Error disabling log types:", error);
      throw error;
    }
  }

  /**
   * Disable all log types for a guild
   */
  async disableAllLogTypes(guildId: string) {
    try {
      await prisma.logSettings.upsert({
        where: { guildId },
        update: { enabledLogTypes: [] },
        create: {
          guildId,
          channelRouting: {},
          enabledLogTypes: [],
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);
    } catch (error) {
      logger.error("Error disabling all log types:", error);
      throw error;
    }
  }

  /**
   * Get log settings for a guild (public method)
   */
  async getSettings(guildId: string): Promise<LogSettings> {
    return this.getLogSettings(guildId);
  }
}
