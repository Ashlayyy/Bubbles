import type { Prisma } from "@prisma/client";
import type { EmbedBuilder, TextChannel } from "discord.js";
import { EmbedBuilder as DiscordEmbedBuilder } from "discord.js";

import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "./Client.js";

// Log types organized by category for easy management
export const LOG_CATEGORIES = {
  MESSAGE: [
    "MESSAGE_CREATE",
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
    // Alternative names for compatibility
    "REACTION_ADD",
    "REACTION_REMOVE",
    "REACTION_EMOJI_REMOVE",
    "REACTION_REMOVE_ALL",
  ],
  MEMBER: [
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
    "MEMBER_STATUS_CHANGE",
    "MEMBER_COME_ONLINE",
    "MEMBER_GO_OFFLINE",
    "MEMBER_START_STREAMING",
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
    // Server-initiated voice actions
    "VOICE_SERVER_MUTE",
    "VOICE_SERVER_UNMUTE",
    "VOICE_SERVER_DEAFEN",
    "VOICE_SERVER_UNDEAFEN",
    // Self-initiated voice actions
    "VOICE_SELF_MUTE",
    "VOICE_SELF_UNMUTE",
    "VOICE_SELF_DEAFEN",
    "VOICE_SELF_UNDEAFEN",
    "VOICE_START_STREAM",
    "VOICE_STOP_STREAM",
    "VOICE_START_VIDEO",
    "VOICE_STOP_VIDEO",
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
    "BOT_GUILD_JOIN",
    "BOT_GUILD_LEAVE",
    "APPLICATION_COMMAND_CREATE",
    "APPLICATION_COMMAND_DELETE",
    "APPLICATION_COMMAND_UPDATE",
    "APPLICATION_COMMAND_USE",
    "INTEGRATION_UPDATE",
    "INTEGRATION_DETAILS",
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
    "AUTOMOD_RULE_TOGGLE",
  ],
  SYSTEM: ["RATE_LIMIT_HIT", "INVALID_REQUEST_WARNING", "WEBHOOKS_UPDATE"],
  TICKET: ["TICKET_CREATE", "TICKET_CLOSE", "TICKET_CLAIM", "TICKET_CONFIG_CHANGE", "TICKET_PANEL_CREATE"],
  COMMAND: ["COMMAND_USERINFO", "COMMAND_SERVERINFO", "COMMAND_AVATAR"],
  POLL: ["POLL_CREATE", "POLL_END"],
  GIVEAWAY: ["GIVEAWAY_CREATE", "GIVEAWAY_END", "GIVEAWAY_REROLL", "GIVEAWAY_ENTRY"],
  THREAD: ["THREAD_CREATE", "THREAD_DELETE", "THREAD_UPDATE"],
  SCHEDULED_EVENT: ["SCHEDULED_EVENT_CREATE", "SCHEDULED_EVENT_UPDATE"],
  USER: ["USER_UPDATE"],
  WELCOME: ["WELCOME_CONFIG"],
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
      if (!ALL_LOG_TYPES.includes(logType as (typeof ALL_LOG_TYPES)[number])) {
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
        channelRouting: settings?.channelRouting as Record<string, string>,
        ignoredUsers: settings?.ignoredUsers ?? [],
        ignoredRoles: settings?.ignoredRoles ?? [],
        ignoredChannels: settings?.ignoredChannels ?? [],
        enabledLogTypes: settings?.enabledLogTypes ?? [],
        customFormats: settings?.customFormats as Record<string, unknown> | undefined,
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
   * Send log message to appropriate channels
   */
  private async sendToLogChannels(guildId: string, logType: string, logEntry: LogEntry, settings: LogSettings) {
    try {
      // Determine which channel to send to
      const channelId = this.getLogChannelId(guildId, logType, settings);
      if (!channelId) return;

      // Get the channel
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return;

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
  private getDefaultChannelForCategory(_category: string | null): string | null {
    // This would map to GuildConfig default channels
    // We'll implement this when we create the setup wizard
    return null;
  }

  /**
   * Create a beautiful embed for the log entry
   */
  private createLogEmbed(logType: string, logEntry: LogEntry): EmbedBuilder {
    const embed = new DiscordEmbedBuilder().setTimestamp(logEntry.timestamp).setFooter({
      text: `Log ID: ${logEntry.id} • ${new Date().toLocaleString()}`,
      iconURL: this.client.user?.displayAvatarURL(),
    });

    // Set color based on category/severity
    const category = this.getLogCategory(logType);
    const color = this.getCategoryColor(category);
    embed.setColor(color);

    // Set title and description based on log type
    const { title, description, emoji } = this.getLogContent(logType, logEntry);
    embed.setTitle(`${emoji} ${title}`);
    if (description) embed.setDescription(description);

    // Add author field with user info if available (synchronously)
    if (logEntry.userId) {
      embed.setAuthor({
        name: `User ID: ${logEntry.userId}`,
      });

      // Try to fetch user info asynchronously and update later if needed
      this.client.users
        .fetch(logEntry.userId)
        .then((user) => {
          embed.setAuthor({
            name: `${user.username} (${user.id})`,
            iconURL: user.displayAvatarURL({ size: 64 }),
          });
        })
        .catch(() => {
          // Keep the basic author info if fetch fails
        });
    }

    // Add comprehensive fields based on available data
    this.addDetailedFieldsToEmbed(embed, logEntry, logType);

    // Add metadata information
    this.addMetadataToEmbed(embed, logEntry, logType);

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
   * Get title, description, and emoji for log type
   */
  private getLogContent(logType: string, logEntry: LogEntry): { title: string; description?: string; emoji: string } {
    const userMention = logEntry.userId ? `<@${logEntry.userId}>` : "Unknown User";
    const channelMention = logEntry.channelId ? `<#${logEntry.channelId}>` : "Unknown Channel";

    switch (logType) {
      case "MESSAGE_DELETE":
        return {
          title: "Message Deleted",
          description: `A message by ${userMention} was deleted in ${channelMention}`,
          emoji: "🗑️",
        };

      case "MESSAGE_EDIT":
        return {
          title: "Message Edited",
          description: `${userMention} edited a message in ${channelMention}`,
          emoji: "✏️",
        };

      case "MESSAGE_BULK_DELETE": {
        const metadata = logEntry.metadata as { deletedCount?: number } | undefined;
        const deletedCount = metadata?.deletedCount ?? "multiple";
        return {
          title: "Bulk Message Delete",
          description: `${deletedCount} messages were bulk deleted in ${channelMention}`,
          emoji: "🗑️",
        };
      }

      case "MEMBER_JOIN":
        return {
          title: "Member Joined",
          description: `${userMention} joined the server`,
          emoji: "👋",
        };

      case "MEMBER_LEAVE":
        return {
          title: "Member Left",
          description: `${userMention} left the server`,
          emoji: "👋",
        };

      case "MEMBER_BAN":
        return {
          title: "Member Banned",
          description: `${userMention} was banned from the server`,
          emoji: "🔨",
        };

      case "MEMBER_UNBAN":
        return {
          title: "Member Unbanned",
          description: `${userMention} was unbanned from the server`,
          emoji: "🔓",
        };

      case "MEMBER_KICK":
        return {
          title: "Member Kicked",
          description: `${userMention} was kicked from the server`,
          emoji: "👢",
        };

      case "MEMBER_TIMEOUT":
        return {
          title: "Member Timed Out",
          description: `${userMention} was timed out`,
          emoji: "⏰",
        };

      case "MEMBER_TIMEOUT_REMOVE":
        return {
          title: "Timeout Removed",
          description: `Timeout was removed from ${userMention}`,
          emoji: "🔊",
        };

      case "MEMBER_ROLE_ADD":
        return {
          title: "Role Added",
          description: `Role was added to ${userMention}`,
          emoji: "➕",
        };

      case "MEMBER_ROLE_REMOVE":
        return {
          title: "Role Removed",
          description: `Role was removed from ${userMention}`,
          emoji: "➖",
        };

      case "ROLE_CREATE":
        return {
          title: "Role Created",
          description: `A new role was created`,
          emoji: "🎭",
        };

      case "ROLE_DELETE":
        return {
          title: "Role Deleted",
          description: `A role was deleted`,
          emoji: "🗑️",
        };

      case "CHANNEL_CREATE":
        return {
          title: "Channel Created",
          description: `${channelMention} was created`,
          emoji: "📝",
        };

      case "CHANNEL_DELETE":
        return {
          title: "Channel Deleted",
          description: `A channel was deleted`,
          emoji: "🗑️",
        };

      case "VOICE_JOIN":
        return {
          title: "Voice Channel Joined",
          description: `${userMention} joined ${channelMention}`,
          emoji: "🎤",
        };

      case "VOICE_LEAVE":
        return {
          title: "Voice Channel Left",
          description: `${userMention} left ${channelMention}`,
          emoji: "🔇",
        };

      case "MESSAGE_REACTION_ADD":
        return {
          title: "Reaction Added",
          description: `${userMention} added a reaction in ${channelMention}`,
          emoji: "👍",
        };

      case "MESSAGE_REACTION_REMOVE":
        return {
          title: "Reaction Removed",
          description: `${userMention} removed a reaction in ${channelMention}`,
          emoji: "👎",
        };

      default:
        return {
          title: logType
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          description: `Log event occurred`,
          emoji: "📊",
        };
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

    // Moderator/Executor information
    if (logEntry.executorId) {
      embed.addFields({
        name: "👮 Moderator",
        value: `<@${logEntry.executorId}> (\`${logEntry.executorId}\`)`,
        inline: true,
      });
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
    if (logEntry.content && logEntry.content.length > 0) {
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
            name: "📜 Before",
            value: `\`\`\`${beforeContent}\`\`\``,
            inline: false,
          });
        }

        if (after) {
          const afterContent = after.length > 500 ? `${after.substring(0, 500)}...` : after;
          embed.addFields({
            name: "📝 After",
            value: `\`\`\`${afterContent}\`\`\``,
            inline: false,
          });
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

    // Add metadata field if we have any
    if (metadataFields.length > 0) {
      embed.addFields({
        name: "ℹ️ Additional Information",
        value: metadataFields.join("\n"),
        inline: false,
      });
    }

    // Add jump link for message-related events
    if (metadata.messageId && typeof metadata.messageId === "string" && logEntry.channelId && logEntry.guildId) {
      embed.addFields({
        name: "🔗 Links",
        value: `[Jump to Message](https://discord.com/channels/${logEntry.guildId}/${logEntry.channelId}/${metadata.messageId})`,
        inline: true,
      });
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

      const enabledTypes = settings?.enabledLogTypes ?? [];

      if (enabled && !enabledTypes.includes(logType)) {
        enabledTypes.push(logType);
      } else if (!enabled) {
        const filteredTypes = enabledTypes.filter((type) => type !== logType);

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
        return;
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

      const currentRouting = settings?.channelRouting as Record<string, string>;
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
      const filteredTypes = enabledTypes.filter((type) => !logTypes.includes(type));

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
   * Get log settings for a guild (public method)
   */
  async getSettings(guildId: string): Promise<LogSettings> {
    return this.getLogSettings(guildId);
  }
}
