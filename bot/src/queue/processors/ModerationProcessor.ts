import type { ModerationActionJob } from "@shared/types/queue";
import type { Guild } from "discord.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

export class ModerationProcessor extends BaseProcessor<ModerationActionJob> {
  constructor(client: Client) {
    super(client, "ModerationProcessor");
  }

  getJobTypes(): string[] {
    return ["BAN_USER", "KICK_USER", "TIMEOUT_USER", "UNBAN_USER"];
  }

  async processJob(job: ModerationActionJob): Promise<ProcessorResult> {
    const { type, targetUserId, guildId, reason, duration, caseId, moderatorId } = job;

    logger.info(
      `[ModerationProcessor] Processing job: ${type} | Job ID: ${job.id || "unknown"} | Guild: ${guildId} | Target: ${targetUserId} | Moderator: ${moderatorId}`
    );

    if (!guildId) {
      logger.error(`[ModerationProcessor] Missing guildId for job: ${JSON.stringify(job)}`);
      return {
        success: false,
        error: "Guild ID is required for moderation actions",
        timestamp: Date.now(),
      };
    }

    if (!targetUserId) {
      logger.error(`[ModerationProcessor] Missing targetUserId for job: ${JSON.stringify(job)}`);
      return {
        success: false,
        error: "Target user ID is required for moderation actions",
        timestamp: Date.now(),
      };
    }

    try {
      logger.info(`[ModerationProcessor] Fetching guild: ${guildId}`);
      const guild = await this.fetchGuild(guildId);
      logger.info(`[ModerationProcessor] Guild fetched: ${guild.id}`);
      let success = false;

      switch (type) {
        case "BAN_USER":
          logger.info(`[ModerationProcessor] Banning user: ${targetUserId}`);
          success = await this.processBanUser(guild, targetUserId, reason);
          logger.info(`[ModerationProcessor] Ban result for ${targetUserId}: ${success}`);
          break;
        case "KICK_USER":
          logger.info(`[ModerationProcessor] Kicking user: ${targetUserId}`);
          success = await this.processKickUser(guild, targetUserId, reason);
          logger.info(`[ModerationProcessor] Kick result for ${targetUserId}: ${success}`);
          break;
        case "TIMEOUT_USER":
          logger.info(`[ModerationProcessor] Timing out user: ${targetUserId} for ${duration} seconds`);
          success = await this.processTimeoutUser(guild, targetUserId, reason, duration);
          logger.info(`[ModerationProcessor] Timeout result for ${targetUserId}: ${success}`);
          break;
        case "UNBAN_USER":
          logger.info(`[ModerationProcessor] Unbanning user: ${targetUserId}`);
          success = await this.processUnbanUser(guild, targetUserId, reason);
          logger.info(`[ModerationProcessor] Unban result for ${targetUserId}: ${success}`);
          break;
        default:
          logger.error(`[ModerationProcessor] Unknown moderation action type: ${type}`);
          return {
            success: false,
            error: `Unknown moderation action type: ${type}`,
            timestamp: Date.now(),
          };
      }

      return {
        success,
        data: {
          type,
          targetUserId,
          guildId,
          caseId,
          moderatorId,
          completedAt: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (actionError) {
      const errorMessage = actionError instanceof Error ? actionError.message : "Unknown error";
      logger.error(
        `[ModerationProcessor] Error processing job: ${type} | Job ID: ${job.id || "unknown"} | Guild: ${guildId} | Target: ${targetUserId} | Moderator: ${moderatorId} | Error: ${errorMessage}`
      );
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  private async processBanUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      logger.info(`[ModerationProcessor] [BAN] Fetching member: ${userId}`);
      // No need to fetch member for ban, but log anyway
      logger.info(`[ModerationProcessor] [BAN] Banning user: ${userId}`);
      await guild.members.ban(userId, {
        reason: reason ?? "No reason provided",
        deleteMessageSeconds: 7 * 24 * 60 * 60, // 7 days
      });
      logger.info(`[ModerationProcessor] [BAN] User banned: ${userId}`);
      return true;
    } catch (error) {
      logger.error(
        `[ModerationProcessor] [BAN] Failed to ban user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw new Error(`Failed to ban user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processKickUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      logger.info(`[ModerationProcessor] [KICK] Fetching member: ${userId}`);
      const member = await guild.members.fetch(userId);
      logger.info(`[ModerationProcessor] [KICK] Kicking user: ${userId}`);
      await member.kick(reason ?? "No reason provided");
      logger.info(`[ModerationProcessor] [KICK] User kicked: ${userId}`);
      return true;
    } catch (error) {
      logger.error(
        `[ModerationProcessor] [KICK] Failed to kick user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw new Error(`Failed to kick user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processTimeoutUser(guild: Guild, userId: string, reason?: string, duration?: number): Promise<boolean> {
    try {
      logger.info(`[ModerationProcessor] [TIMEOUT] Fetching member: ${userId}`);
      const member = await guild.members.fetch(userId);
      logger.info(`[ModerationProcessor] [TIMEOUT] Timing out user: ${userId} for ${duration} seconds`);
      const timeoutDuration = duration ? duration * 1000 : 300000; // Default 5 minutes
      // Discord timeout limit is 28 days
      const maxTimeout = 28 * 24 * 60 * 60 * 1000;
      const actualTimeout = Math.min(timeoutDuration, maxTimeout);
      await member.timeout(actualTimeout, reason ?? "No reason provided");
      logger.info(`[ModerationProcessor] [TIMEOUT] User timed out: ${userId}`);
      return true;
    } catch (error) {
      logger.error(
        `[ModerationProcessor] [TIMEOUT] Failed to timeout user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw new Error(`Failed to timeout user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processUnbanUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      logger.info(`[ModerationProcessor] [UNBAN] Unbanning user: ${userId}`);
      await guild.members.unban(userId, reason ?? "No reason provided");
      logger.info(`[ModerationProcessor] [UNBAN] User unbanned: ${userId}`);
      return true;
    } catch (error) {
      logger.error(
        `[ModerationProcessor] [UNBAN] Failed to unban user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw new Error(`Failed to unban user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  protected getEventPrefix(): string {
    return "MODERATION";
  }

  protected getAdditionalEventData(job: ModerationActionJob): Record<string, unknown> {
    return {
      ...super.getAdditionalEventData(job),
      targetUserId: job.targetUserId,
      moderationType: job.type,
      caseId: job.caseId ?? undefined,
      moderatorId: job.moderatorId ?? undefined,
    };
  }
}
