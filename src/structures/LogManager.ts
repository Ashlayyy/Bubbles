import type { EmbedBuilder, TextChannel } from "discord.js";
import { EmbedBuilder as DiscordEmbedBuilder } from "discord.js";

import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "./Client.js";

// Log types organized by category for easy management
export const LOG_CATEGORIES = {
  MESSAGE: [
    "MESSAGE_DELETE",
    "MESSAGE_EDIT",
    "MESSAGE_BULK_DELETE",
    "MESSAGE_PIN",
    "MESSAGE_REACTION_ADD",
    "MESSAGE_REACTION_REMOVE",
    "MESSAGE_REACTION_CLEAR",
    "MESSAGE_ATTACHMENT_DELETE",
    "MESSAGE_EMBED_UPDATE",
    "MESSAGE_THREAD_CREATE",
    "MESSAGE_CROSSPOST",
    "MESSAGE_SUPPRESS_EMBEDS",
    "MESSAGE_AUTOMOD_TRIGGER",
    "MESSAGE_SPAM_DETECTED",
    "MESSAGE_LINK_FILTER",
  ],
  MEMBER: [
    "MEMBER_JOIN",
    "MEMBER_LEAVE",
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
    "MEMBER_STATUS_CHANGE",
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
    "VOICE_JOIN",
    "VOICE_LEAVE",
    "VOICE_MOVE",
    "VOICE_MUTE",
    "VOICE_UNMUTE",
    "VOICE_DEAFEN",
    "VOICE_UNDEAFEN",
    "VOICE_STREAM_START",
    "VOICE_STREAM_STOP",
    "VOICE_STAGE_SPEAKER_CHANGE",
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
    "STICKER_USAGE",
  ],
  WEBHOOK: ["WEBHOOK_CREATE", "WEBHOOK_DELETE", "WEBHOOK_UPDATE", "WEBHOOK_MESSAGE", "WEBHOOK_TOKEN_RESET"],
  BOT: [
    "BOT_ADD",
    "BOT_REMOVE",
    "BOT_PERMISSIONS_UPDATE",
    "APPLICATION_COMMAND_CREATE",
    "APPLICATION_COMMAND_DELETE",
    "APPLICATION_COMMAND_UPDATE",
    "APPLICATION_COMMAND_USE",
    "INTEGRATION_UPDATE",
  ],
  REACTION_ROLE: [
    "REACTION_ROLE_ADD",
    "REACTION_ROLE_REMOVE",
    "REACTION_ROLE_CONFIG_CHANGE",
    "REACTION_ROLE_MESSAGE_UPDATE",
  ],
  AUTOMOD: [
    "AUTOMOD_RULE_CREATE",
    "AUTOMOD_RULE_DELETE",
    "AUTOMOD_RULE_UPDATE",
    "AUTOMOD_RULE_TRIGGER",
    "AUTOMOD_ACTION_EXECUTE",
    "AUTOMOD_BYPASS",
  ],
} as const;

// Flatten all log types for easy validation
export const ALL_LOG_TYPES = Object.values(LOG_CATEGORIES).flat();

export interface LogEvent {
  guildId: string;
  logType: string;
  userId?: string;
  channelId?: string;
  roleId?: string;
  caseId?: string;
  before?: any;
  after?: any;
  metadata?: any;
  content?: string;
  attachments?: string[];
  embeds?: any[];
  executorId?: string;
  reason?: string;
}

export interface LogSettings {
  channelRouting: Record<string, string>;
  ignoredUsers: string[];
  ignoredRoles: string[];
  ignoredChannels: string[];
  enabledLogTypes: string[];
  customFormats?: Record<string, any>;
}

export default class LogManager {
  private client: Client;
  private settingsCache = new Map<string, LogSettings>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Main logging method - super easy to use!
   * Just call: logManager.log(guildId, "MESSAGE_DELETE", { userId, content, etc... })
   */
  async log(guildId: string, logType: string, data: Partial<LogEvent> = {}): Promise<void> {
    try {
      // Validate log type
      if (!ALL_LOG_TYPES.includes(logType as any)) {
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

      // Create the log entry in database
      const logEntry = await this.createLogEntry(guildId, logType, data);

      // Send to appropriate channel(s)
      await this.sendToLogChannels(guildId, logType, logEntry, settings);
    } catch (error) {
      logger.error("Error in LogManager.log:", error);
    }
  }

  /**
   * Get log settings for a guild (with caching)
   */
  private async getLogSettings(guildId: string): Promise<LogSettings> {
    const cached = this.settingsCache.get(guildId);
    if (cached) return cached;

    try {
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      const logSettings: LogSettings = {
        channelRouting: (settings?.channelRouting as Record<string, string>) || {},
        ignoredUsers: settings?.ignoredUsers || [],
        ignoredRoles: settings?.ignoredRoles || [],
        ignoredChannels: settings?.ignoredChannels || [],
        enabledLogTypes: settings?.enabledLogTypes || [],
        customFormats: (settings?.customFormats as Record<string, any>) || undefined,
      };

      // Cache for 5 minutes
      this.settingsCache.set(guildId, logSettings);
      setTimeout(() => this.settingsCache.delete(guildId), this.cacheTimeout);

      return logSettings;
    } catch (error) {
      logger.error("Error getting log settings:", error);
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
   * Create log entry in database
   */
  private async createLogEntry(guildId: string, logType: string, data: Partial<LogEvent>) {
    return await prisma.moderationLog.create({
      data: {
        guildId,
        logType,
        userId: data.userId,
        channelId: data.channelId,
        roleId: data.roleId,
        caseId: data.caseId,
        before: data.before,
        after: data.after,
        metadata: data.metadata,
        content: data.content,
        attachments: data.attachments || [],
        embeds: data.embeds || [],
        executorId: data.executorId,
        reason: data.reason,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Send log message to appropriate channels
   */
  private async sendToLogChannels(guildId: string, logType: string, logEntry: any, settings: LogSettings) {
    try {
      // Determine which channel to send to
      const channelId = this.getLogChannelId(guildId, logType, settings);
      if (!channelId) return;

      // Get the channel
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;

      // Create embed
      const embed = this.createLogEmbed(logType, logEntry);

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
    // Check specific routing first
    if (settings.channelRouting[logType]) {
      return settings.channelRouting[logType];
    }

    // Fall back to category-based routing
    const category = this.getLogCategory(logType);
    if (category && settings.channelRouting[category]) {
      return settings.channelRouting[category];
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
  private getDefaultChannelForCategory(category: string | null): string | null {
    // This would map to GuildConfig default channels
    // We'll implement this when we create the setup wizard
    return null;
  }

  /**
   * Create a beautiful embed for the log entry
   */
  private createLogEmbed(logType: string, logEntry: any): EmbedBuilder {
    const embed = new DiscordEmbedBuilder()
      .setTimestamp(logEntry.timestamp)
      .setFooter({ text: `Log ID: ${logEntry.id}` });

    // Set color based on category/severity
    const category = this.getLogCategory(logType);
    const color = this.getCategoryColor(category);
    embed.setColor(color);

    // Set title and description based on log type
    const { title, description } = this.getLogContent(logType, logEntry);
    embed.setTitle(title);
    if (description) embed.setDescription(description);

    // Add fields based on available data
    this.addFieldsToEmbed(embed, logEntry);

    return embed;
  }

  /**
   * Get color for category
   */
  private getCategoryColor(category: string | null): number {
    const colors = {
      MESSAGE: 0x3498db, // Blue
      MEMBER: 0x2ecc71, // Green
      ROLE: 0x9b59b6, // Purple
      CHANNEL: 0xe67e22, // Orange
      VOICE: 0x1abc9c, // Turquoise
      SERVER: 0xf39c12, // Gold
      MODERATION: 0xe74c3c, // Red
      INVITE: 0x95a5a6, // Gray
      EMOJI: 0xf1c40f, // Yellow
      WEBHOOK: 0x34495e, // Dark gray
      BOT: 0x8e44ad, // Dark purple
      REACTION_ROLE: 0x16a085, // Dark turquoise
      AUTOMOD: 0xc0392b, // Dark red
    };
    return colors[category as keyof typeof colors] || 0x95a5a6;
  }

  /**
   * Get title and description for log type
   */
  private getLogContent(logType: string, logEntry: any): { title: string; description?: string } {
    // This would be a comprehensive mapping of all log types to human-readable content
    // For now, simplified version
    const userMention = logEntry.userId ? `<@${logEntry.userId}>` : "Unknown User";
    const channelMention = logEntry.channelId ? `<#${logEntry.channelId}>` : "Unknown Channel";

    switch (logType) {
      case "MESSAGE_DELETE":
        return {
          title: "📝 Message Deleted",
          description: `Message by ${userMention} was deleted in ${channelMention}`,
        };
      case "MEMBER_JOIN":
        return {
          title: "👋 Member Joined",
          description: `${userMention} joined the server`,
        };
      case "MEMBER_BAN":
        return {
          title: "🔨 Member Banned",
          description: `${userMention} was banned`,
        };
      // ... Add more cases for all 100+ log types
      default:
        return {
          title: `📊 ${logType.replace(/_/g, " ")}`,
          description: `Log event: ${logType}`,
        };
    }
  }

  /**
   * Add relevant fields to embed
   */
  private addFieldsToEmbed(embed: EmbedBuilder, logEntry: any) {
    if (logEntry.executorId) {
      embed.addFields({ name: "👤 Moderator", value: `<@${logEntry.executorId}>`, inline: true });
    }

    if (logEntry.reason) {
      embed.addFields({ name: "📝 Reason", value: logEntry.reason, inline: false });
    }

    if (logEntry.content && logEntry.content.length > 0) {
      const content = logEntry.content.length > 1000 ? logEntry.content.substring(0, 1000) + "..." : logEntry.content;
      embed.addFields({ name: "💬 Content", value: `\`\`\`${content}\`\`\``, inline: false });
    }

    if (logEntry.caseId) {
      embed.addFields({ name: "📋 Case", value: `Case #${logEntry.caseId}`, inline: true });
    }
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
          enabledLogTypes: ALL_LOG_TYPES,
        },
        create: {
          guildId,
          channelRouting: channelMappings,
          enabledLogTypes: ALL_LOG_TYPES,
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
   * Helper method to enable/disable specific log types
   */
  async toggleLogType(guildId: string, logType: string, enabled: boolean) {
    try {
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      let enabledTypes = settings?.enabledLogTypes || [];

      if (enabled && !enabledTypes.includes(logType)) {
        enabledTypes.push(logType);
      } else if (!enabled) {
        enabledTypes = enabledTypes.filter((type) => type !== logType);
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
      logger.error("Error toggling log type:", error);
      throw error;
    }
  }

  /**
   * Set channel routing for specific log types
   */
  async setChannelRouting(guildId: string, routing: Record<string, string>) {
    try {
      const settings = await prisma.logSettings.findUnique({
        where: { guildId },
      });

      const currentRouting = (settings?.channelRouting as Record<string, string>) || {};
      const updatedRouting = { ...currentRouting, ...routing };

      await prisma.logSettings.upsert({
        where: { guildId },
        update: { channelRouting: updatedRouting },
        create: {
          guildId,
          channelRouting: updatedRouting,
          enabledLogTypes: [],
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Clear cache
      this.settingsCache.delete(guildId);
    } catch (error) {
      logger.error("Error setting channel routing:", error);
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
        update: { enabledLogTypes: ALL_LOG_TYPES },
        create: {
          guildId,
          channelRouting: {},
          enabledLogTypes: ALL_LOG_TYPES,
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
}
