import type { Guild } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { APPEALS_OAUTH_CONFIG } from "../config/appeals.js";
import { getGuildConfig } from "../database/GuildConfig.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cacheService } from "../services/cacheService.js";
import ModerationMutex, { MutexError } from "../utils/ModerationMutex.js";
import { ModerationThrottle, ThrottleError } from "../utils/ModerationThrottle.js";
import type Client from "./Client.js";
import type LogManager from "./LogManager.js";

export interface ModerationAction {
  type: "KICK" | "BAN" | "WARN" | "TIMEOUT" | "NOTE" | "UNBAN" | "UNTIMEOUT";
  userId: string;
  moderatorId: string;
  reason?: string;
  duration?: number; // in seconds
  evidence?: string[];
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  points?: number;
  publicNote?: string;
  staffNote?: string;
  notifyUser?: boolean;
  invocation?: {
    interactionId?: string;
    commandName?: string;
    interactionLatency?: number;
  };
  /** How to handle moderation case creation. If omitted, guild config default is used */
  caseHandling?: "NEW" | "UPDATE";
}

export interface ModerationCase {
  id: string;
  caseNumber: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: string;
  reason?: string;
  evidence: string[];
  duration?: number;
  expiresAt?: Date;
  isActive: boolean;
  severity: string;
  points: number;
  canAppeal: boolean;
  appealedAt?: Date;
  appealStatus?: string;
  context?: any;
  dmSent: boolean;
  publicNote?: string;
  staffNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default class ModerationManager {
  private client: Client;
  private logManager: LogManager;

  constructor(client: Client, logManager: LogManager) {
    this.client = client;
    this.logManager = logManager;
  }

  /**
   * Main moderation method - handles any moderation action with flexible case handling.
   */
  async moderate(guild: Guild, action: ModerationAction): Promise<ModerationCase> {
    try {
      // Acquire mutex to avoid concurrent actions on same user
      try {
        ModerationMutex.acquire(guild.id, action.userId);
      } catch (err) {
        if (err instanceof MutexError) {
          throw err;
        }
      }

      // Rate-limit check
      try {
        ModerationThrottle.check(guild.id, action.moderatorId, action.type);
      } catch (err) {
        if (err instanceof ThrottleError) {
          throw err;
        }
      }

      // Resolve handling behaviour
      const guildConfig = await getGuildConfig(guild.id);
      const rules =
        (guildConfig as unknown as { moderation_case_rules?: Record<string, string> }).moderation_case_rules ?? {};

      const configHandling = rules[action.type] as "NEW" | "UPDATE" | undefined;
      const handling: "NEW" | "UPDATE" =
        action.caseHandling ??
        configHandling ??
        (action.type === "UNBAN" || action.type === "UNTIMEOUT" ? "UPDATE" : "NEW");

      let moderationCase: ModerationCase | null = null;

      if (handling === "UPDATE") {
        const reverseType = this.getReverseAction(action.type);
        if (reverseType) {
          moderationCase = (await prisma.moderationCase.findFirst({
            where: { guildId: guild.id, userId: action.userId, type: reverseType, isActive: true },
            orderBy: { caseNumber: "desc" },
          })) as ModerationCase | null;

          if (moderationCase) {
            await prisma.moderationCase.update({
              where: { id: moderationCase.id },
              data: { isActive: false, staffNote: `Resolved by ${action.type}` },
            });
          }
        }
      }

      // If NEW or UPDATE without match, create new case
      if (!moderationCase) {
        const caseNumber = await this.getNextCaseNumber(guild.id);
        moderationCase = await this.createCase(guild.id, caseNumber, action);
      }

      const modCase = moderationCase;

      // Execute the Discord action (always have a case)
      await this.queueDiscordAction(guild, action, modCase);

      // Notify user (guild default may override)
      const guildNotifyDefault = (guildConfig as unknown as { notify_user?: boolean }).notify_user ?? false;
      const shouldNotify = action.notifyUser ?? guildNotifyDefault;
      if (shouldNotify) {
        await this.notifyUser(action.userId, modCase, guild);
      }

      // Schedule follow-up action (unban etc.)
      if (action.duration && action.type !== "WARN") {
        await this.scheduleAction(guild.id, action.userId, action.type, action.duration, modCase.id);
      }

      // Logging
      const startTime = Date.now();
      await this.logManager.log(guild.id, `MOD_${action.type}`, {
        userId: action.userId,
        executorId: action.moderatorId,
        reason: action.reason,
        caseId: modCase.id,
        metadata: {
          caseNumber: modCase.caseNumber,
          severity: action.severity,
          points: action.points,
          duration: action.duration,
          shardId: this.client.shard && this.client.shard.ids.length > 0 ? this.client.shard.ids[0] : 0,
          processingLatency: Date.now() - startTime,
          gatewayPing: this.client.ws.ping,
          interactionId: action.invocation?.interactionId,
          commandName: action.invocation?.commandName,
          interactionLatency: action.invocation?.interactionLatency,
        },
      });

      logger.info(
        `Moderation action ${action.type} processed for user ${action.userId} in guild ${guild.id} (handling: ${handling})`
      );

      return modCase;
    } catch (error) {
      logger.error("Error in moderation action:", error);
      throw error;
    } finally {
      // Always release mutex
      ModerationMutex.release(guild.id, action.userId);
    }
  }

  /**
   * Quick methods for common moderation actions
   */
  async kick(
    guild: Guild,
    userId: string,
    moderatorId: string,
    reason?: string,
    evidence?: string[],
    notifyUser?: boolean,
    invocation?: { interactionId?: string; commandName?: string; interactionLatency?: number }
  ): Promise<ModerationCase> {
    return this.moderate(guild, {
      type: "KICK",
      userId,
      moderatorId,
      reason,
      evidence,
      severity: "MEDIUM",
      points: 3,
      notifyUser,
      invocation,
    });
  }

  async ban(
    guild: Guild,
    userId: string,
    moderatorId: string,
    reason?: string,
    duration?: number,
    evidence?: string[],
    notifyUser?: boolean,
    invocation?: { interactionId?: string; commandName?: string; interactionLatency?: number }
  ): Promise<ModerationCase> {
    return this.moderate(guild, {
      type: "BAN",
      userId,
      moderatorId,
      reason,
      duration,
      evidence,
      severity: duration ? "HIGH" : "CRITICAL",
      points: duration ? 5 : 10,
      notifyUser,
      invocation,
    });
  }

  async warn(
    guild: Guild,
    userId: string,
    moderatorId: string,
    reason: string,
    evidence?: string[],
    points = 1,
    notifyUser?: boolean,
    invocation?: { interactionId?: string; commandName?: string; interactionLatency?: number }
  ): Promise<ModerationCase> {
    return this.moderate(guild, {
      type: "WARN",
      userId,
      moderatorId,
      reason,
      evidence,
      severity: "LOW",
      points,
      notifyUser,
      invocation,
    });
  }

  async timeout(
    guild: Guild,
    userId: string,
    moderatorId: string,
    duration: number,
    reason?: string,
    evidence?: string[],
    notifyUser?: boolean,
    invocation?: { interactionId?: string; commandName?: string; interactionLatency?: number }
  ): Promise<ModerationCase> {
    return this.moderate(guild, {
      type: "TIMEOUT",
      userId,
      moderatorId,
      reason,
      duration,
      evidence,
      severity: "MEDIUM",
      points: 2,
      notifyUser,
      invocation,
    });
  }

  async note(
    guild: Guild,
    userId: string,
    moderatorId: string,
    note: string,
    invocation?: { interactionId?: string; commandName?: string; interactionLatency?: number }
  ): Promise<ModerationCase> {
    return this.moderate(guild, {
      type: "NOTE",
      userId,
      moderatorId,
      reason: note,
      severity: "LOW",
      points: 0,
      invocation,
    });
  }

  /**
   * Get user's moderation history
   */
  async getUserHistory(guildId: string, userId: string, limit = 50): Promise<ModerationCase[]> {
    const cacheKey = `moderation:history:${guildId}:${userId}:${limit}`;

    // Try to get from cache first
    const cached = await cacheService.get<ModerationCase[]>(cacheKey, "userInfractions");
    if (cached) {
      return cached;
    }

    // Fetch from database if not cached
    const cases = await prisma.moderationCase.findMany({
      where: {
        guildId,
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        notes: true,
      },
    });

    // Cache the result
    await cacheService.set(cacheKey, cases, "userInfractions");

    return cases as unknown as ModerationCase[];
  }

  /**
   * Get case by number
   */
  async getCase(guildId: string, caseNumber: number): Promise<ModerationCase | null> {
    try {
      const case_ = await prisma.moderationCase.findUnique({
        where: {
          guildId_caseNumber: { guildId, caseNumber },
        },
        include: {
          notes: true,
          appeals: true,
        },
      });

      return case_ as unknown as ModerationCase | null;
    } catch (error) {
      logger.error("Error getting case:", error);
      return null;
    }
  }

  /**
   * Add note to case
   */
  async addCaseNote(caseId: string, authorId: string, content: string, isInternal = false): Promise<void> {
    try {
      await prisma.caseNote.create({
        data: {
          caseId,
          authorId,
          content,
          isInternal,
        },
      });

      // Log the note addition
      const case_ = await prisma.moderationCase.findUnique({ where: { id: caseId } });
      if (case_) {
        await this.logManager.log(case_.guildId, "MOD_CASE_NOTE_ADD", {
          caseId,
          executorId: authorId,
          metadata: { isInternal, content },
        });
      }
    } catch (error) {
      logger.error("Error adding case note:", error);
      throw error;
    }
  }

  /**
   * Get user's total infraction points
   */
  async getInfractionPoints(guildId: string, userId: string): Promise<number> {
    const cacheKey = `moderation:points:${guildId}:${userId}`;

    // Try to get from cache first
    const cached = await cacheService.get<number>(cacheKey, "userInfractions");
    if (cached !== null) {
      return cached;
    }

    // Calculate from database if not cached
    try {
      const infractions = await prisma.userInfractions.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      const points = infractions?.totalPoints ?? 0;

      // Cache the result with shorter TTL since points change frequently
      await cacheService.set(cacheKey, points, "userInfractions");

      return points;
    } catch (error) {
      logger.error("Error getting infraction points:", error);
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private async getNextCaseNumber(guildId: string): Promise<number> {
    const lastCase = await prisma.moderationCase.findFirst({
      where: { guildId },
      orderBy: { caseNumber: "desc" },
      select: { caseNumber: true },
    });

    return (lastCase?.caseNumber ?? 0) + 1;
  }

  private async createCase(guildId: string, caseNumber: number, action: ModerationAction): Promise<ModerationCase> {
    const expiresAt = action.duration ? new Date(Date.now() + action.duration * 1000) : undefined;

    const case_ = await prisma.moderationCase.create({
      data: {
        caseNumber,
        guildId,
        userId: action.userId,
        moderatorId: action.moderatorId,
        type: action.type,
        reason: action.reason,
        evidence: action.evidence ?? [],
        duration: action.duration,
        expiresAt,
        severity: action.severity ?? "LOW",
        points: action.points ?? 0,
        publicNote: action.publicNote,
        staffNote: action.staffNote,
      },
    });

    return case_ as unknown as ModerationCase;
  }

  private async queueDiscordAction(guild: Guild, action: ModerationAction, case_: ModerationCase): Promise<void> {
    try {
      let success = false;

      // Use unified queue system if available
      if (this.client.queueService) {
        try {
          switch (action.type) {
            case "KICK": {
              await this.client.queueService.processRequest({
                type: "KICK_USER",
                data: {
                  targetUserId: action.userId,
                  guildId: guild.id,
                  reason: action.reason,
                },
                source: "rest",
                userId: action.moderatorId,
                guildId: guild.id,
                requiresReliability: true,
              });
              success = true;
              break;
            }

            case "BAN": {
              await this.client.queueService.processRequest({
                type: "BAN_USER",
                data: {
                  targetUserId: action.userId,
                  guildId: guild.id,
                  reason: action.reason,
                },
                source: "rest",
                userId: action.moderatorId,
                guildId: guild.id,
                requiresReliability: true,
              });
              success = true;
              break;
            }

            case "TIMEOUT": {
              // Pass duration in seconds; processor will convert to milliseconds once
              await this.client.queueService.processRequest({
                type: "TIMEOUT_USER",
                data: {
                  targetUserId: action.userId,
                  guildId: guild.id,
                  reason: action.reason,
                  duration: action.duration ?? 0,
                },
                source: "rest",
                userId: action.moderatorId,
                guildId: guild.id,
                requiresReliability: true,
              });
              success = true;
              break;
            }

            case "UNBAN": {
              await this.client.queueService.processRequest({
                type: "UNBAN_USER",
                data: {
                  targetUserId: action.userId,
                  guildId: guild.id,
                  reason: action.reason,
                },
                source: "rest",
                userId: action.moderatorId,
                guildId: guild.id,
                requiresReliability: true,
              });
              success = true;
              break;
            }

            case "UNTIMEOUT": {
              await this.client.queueService.processRequest({
                type: "TIMEOUT_USER",
                data: {
                  targetUserId: action.userId,
                  guildId: guild.id,
                  reason: action.reason,
                  duration: undefined,
                },
                source: "rest",
                userId: action.moderatorId,
                guildId: guild.id,
                requiresReliability: true,
              });
              success = true;
              break;
            }

            case "WARN":
            case "NOTE":
              logger.info(`Case created for ${action.type}, no Discord action required`);
              success = true;
              break;
          }

          logger.info(`Processed Discord action ${action.type} via unified queue system`);
        } catch (queueError) {
          logger.warn(`Unified queue failed for ${action.type}, falling back to direct execution:`, queueError);
          success = false;
        }
      }

      // Fallback to direct execution if queue service unavailable or failed
      if (!success) {
        logger.warn(`Queue not available for ${action.type}, falling back to direct execution`);
        await this.executeDiscordActionDirectly(guild, action);
        logger.info(`Successfully executed ${action.type} directly (fallback mode)`);
      }

      await prisma.moderationCase.update({
        where: { id: case_.id },
        data: { dmSent: true },
      });
    } catch (error) {
      logger.error(`Error in Discord action ${action.type}:`, error);
      await prisma.moderationCase.update({
        where: { id: case_.id },
        data: { dmSent: false },
      });
      throw error;
    }
  }

  /**
   * Execute Discord actions directly (fallback when queue system fails)
   */
  private async executeDiscordActionDirectly(guild: Guild, action: ModerationAction): Promise<void> {
    switch (action.type) {
      case "KICK": {
        const member = await guild.members.fetch(action.userId).catch(() => null);
        if (!member) {
          throw new Error(`Member ${action.userId} not found in guild ${guild.id}`);
        }
        await member.kick(action.reason);
        logger.info(`Direct kick executed for user ${action.userId}`);
        break;
      }

      case "BAN": {
        await guild.members.ban(action.userId, {
          reason: action.reason,
          deleteMessageSeconds: 7 * 24 * 60 * 60, // Delete messages from the last 7 days
        });
        logger.info(`Direct ban executed for user ${action.userId}`);
        break;
      }

      case "TIMEOUT": {
        const member = await guild.members.fetch(action.userId).catch(() => null);
        if (!member) {
          throw new Error(`Member ${action.userId} not found in guild ${guild.id}`);
        }
        if (action.duration) {
          const timeoutDuration = action.duration * 1000; // Convert to milliseconds
          await member.timeout(timeoutDuration, action.reason);
          logger.info(`Direct timeout executed for user ${action.userId} for ${action.duration}s`);
        } else {
          throw new Error("Duration is required for timeout action");
        }
        break;
      }

      case "UNBAN": {
        await guild.members.unban(action.userId, action.reason);
        logger.info(`Direct unban executed for user ${action.userId}`);
        break;
      }

      case "UNTIMEOUT": {
        const member = await guild.members.fetch(action.userId).catch(() => null);
        if (!member) {
          throw new Error(`Member ${action.userId} not found in guild ${guild.id}`);
        }
        await member.timeout(null, action.reason); // Remove timeout
        logger.info(`Direct untimeout executed for user ${action.userId}`);
        break;
      }

      case "WARN":
      case "NOTE":
        // These don't require Discord actions
        logger.info(`${action.type} processed - no Discord action required`);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async notifyUser(userId: string, case_: ModerationCase, guild: Guild): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const appealsSettings = await this.getAppealsSettings(guild.id);

      const embed = new EmbedBuilder()
        .setTitle(`📋 Moderation Action - ${guild.name}`)
        .setColor(this.getActionColor(case_.type))
        .addFields(
          { name: "Action", value: case_.type, inline: true },
          { name: "Case #", value: case_.caseNumber.toString(), inline: true },
          { name: "Reason", value: case_.reason ?? "No reason provided", inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Case ID: ${case_.id}` });

      if (case_.duration) {
        const duration = this.formatDuration(case_.duration);
        embed.addFields({ name: "Duration", value: duration, inline: true });
      }

      // Use guild-specific appeals settings
      if (case_.canAppeal && appealsSettings.discordBotEnabled) {
        const appealsUrl = appealsSettings.webFormUrl ?? APPEALS_OAUTH_CONFIG.DEFAULT_WEBSITE_URL;
        embed.addFields({
          name: "📝 Appeal This Action",
          value: `[Click here to submit an appeal](${appealsUrl}/appeal?case=${case_.id})\n\nYou can appeal this action if you believe it was issued unfairly.`,
          inline: false,
        });
      }

      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.warn(`Could not send DM to user ${userId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  private async updateInfractionPoints(guildId: string, userId: string, points: number): Promise<void> {
    if (points === 0) return;

    try {
      await prisma.userInfractions.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: {
          totalPoints: { increment: points },
          lastIncident: new Date(),
        },
        create: {
          guildId,
          userId,
          totalPoints: points,
          lastIncident: new Date(),
        },
      });

      // Invalidate cache entries for this user
      await cacheService.deletePattern(`moderation:*:${guildId}:${userId}*`);
    } catch (error) {
      logger.error("Error updating infraction points:", error);
    }
  }

  private async scheduleAction(
    guildId: string,
    userId: string,
    actionType: string,
    duration: number,
    caseId: string
  ): Promise<void> {
    try {
      const scheduledFor = new Date(Date.now() + duration * 1000);
      const reverseAction = this.getReverseAction(actionType);

      if (reverseAction) {
        await prisma.scheduledAction.create({
          data: {
            guildId,
            userId,
            type: reverseAction,
            caseId,
            scheduledFor,
          },
        });
      }
    } catch (error) {
      logger.error("Error scheduling action:", error);
    }
  }

  private getReverseAction(actionType: string): string | null {
    if (actionType === "BAN") return "UNBAN";
    return null;
  }

  private getActionColor(actionType: string): number {
    const colors = {
      KICK: 0xf39c12, // Orange
      BAN: 0xe74c3c, // Red
      WARN: 0xf1c40f, // Yellow
      TIMEOUT: 0xe67e22, // Dark orange
      NOTE: 0x3498db, // Blue
      UNBAN: 0x2ecc71, // Green
      UNTIMEOUT: 0x2ecc71, // Green
    };
    return colors[actionType as keyof typeof colors] || 0x95a5a6;
  }

  private formatDuration(seconds: number): string {
    const units = [
      { name: "day", seconds: 86400 },
      { name: "hour", seconds: 3600 },
      { name: "minute", seconds: 60 },
    ];

    for (const unit of units) {
      const count = Math.floor(seconds / unit.seconds);
      if (count > 0) {
        return `${count} ${unit.name}${count !== 1 ? "s" : ""}`;
      }
    }

    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  /**
   * Update case notification setting
   */
  async updateCaseNotification(caseId: string, notifyUser: boolean): Promise<void> {
    try {
      await prisma.moderationCase.update({
        where: { id: caseId },
        data: { dmSent: !notifyUser },
      });
    } catch (error) {
      logger.error("Error updating case notification:", error);
      throw error;
    }
  }

  /**
   * Configure appeals settings for a guild
   */
  async configureAppealsSettings(
    guildId: string,
    settings: {
      enabled?: boolean;
      webFormUrl?: string;
      appealChannelId?: string;
      cooldownHours?: number;
      maxAppealsPerUser?: number;
      appealReceived?: string;
      appealApproved?: string;
      appealDenied?: string;
    }
  ): Promise<void> {
    try {
      // First ensure the guild config exists
      await prisma.guildConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });

      // Then upsert the appeals settings
      await prisma.appealSettings.upsert({
        where: { guildId },
        update: {
          discordBotEnabled: settings.enabled ?? true,
          webFormEnabled: !!settings.webFormUrl,
          webFormUrl: settings.webFormUrl,
          appealChannelId: settings.appealChannelId,
          appealCooldown: settings.cooldownHours ? settings.cooldownHours * 3600 : 86400,
          maxAppealsPerUser: settings.maxAppealsPerUser ?? 3,
          appealReceived: settings.appealReceived,
          appealApproved: settings.appealApproved,
          appealDenied: settings.appealDenied,
        },
        create: {
          guildId,
          discordBotEnabled: settings.enabled ?? true,
          webFormEnabled: !!settings.webFormUrl,
          webFormUrl: settings.webFormUrl,
          appealChannelId: settings.appealChannelId,
          appealCooldown: settings.cooldownHours ? settings.cooldownHours * 3600 : 86400,
          maxAppealsPerUser: settings.maxAppealsPerUser ?? 3,
          appealReceived: settings.appealReceived,
          appealApproved: settings.appealApproved,
          appealDenied: settings.appealDenied,
        },
      });

      // Update the guild config to link to appeals settings
      await prisma.guildConfig.update({
        where: { guildId },
        data: {
          appealSettings: {
            connect: { guildId },
          },
        },
      });

      logger.info(`Appeals settings configured for guild ${guildId}`);
    } catch (error) {
      logger.error("Error configuring appeals settings:", error);
      throw error;
    }
  }

  /**
   * Get guild appeals settings
   */
  async getAppealsSettings(guildId: string) {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId },
        include: { appealSettings: true },
      });

      // Return guild's custom appeals settings or defaults
      return (
        guildConfig?.appealSettings ?? {
          discordBotEnabled: true,
          webFormEnabled: false,
          webFormUrl: APPEALS_OAUTH_CONFIG.DEFAULT_WEBSITE_URL,
          appealReceived: "Thank you for submitting your appeal. Our staff will review it within 24-48 hours.",
          appealApproved: "Your appeal has been **approved**. The moderation action has been reversed.",
          appealDenied: "Your appeal has been **denied**. The moderation action will remain in effect.",
          appealCooldown: 86400, // 24 hours
          maxAppealsPerUser: 3,
        }
      );
    } catch (error) {
      logger.error("Error getting appeals settings:", error);
      // Return defaults if error
      return {
        discordBotEnabled: true,
        webFormEnabled: false,
        webFormUrl: APPEALS_OAUTH_CONFIG.DEFAULT_WEBSITE_URL,
        appealReceived: "Thank you for submitting your appeal. Our staff will review it within 24-48 hours.",
        appealApproved: "Your appeal has been **approved**. The moderation action has been reversed.",
        appealDenied: "Your appeal has been **denied**. The moderation action will remain in effect.",
        appealCooldown: 86400,
        maxAppealsPerUser: 3,
      };
    }
  }
}
