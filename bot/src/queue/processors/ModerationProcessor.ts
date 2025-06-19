import type { ModerationActionJob } from "@shared/types/queue";
import type { Guild } from "discord.js";
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

    if (!guildId) {
      return {
        success: false,
        error: "Guild ID is required for moderation actions",
        timestamp: Date.now(),
      };
    }

    if (!targetUserId) {
      return {
        success: false,
        error: "Target user ID is required for moderation actions",
        timestamp: Date.now(),
      };
    }

    try {
      const guild = await this.fetchGuild(guildId);
      let success = false;

      switch (type) {
        case "BAN_USER":
          success = await this.processBanUser(guild, targetUserId, reason);
          break;
        case "KICK_USER":
          success = await this.processKickUser(guild, targetUserId, reason);
          break;
        case "TIMEOUT_USER":
          success = await this.processTimeoutUser(guild, targetUserId, reason, duration);
          break;
        case "UNBAN_USER":
          success = await this.processUnbanUser(guild, targetUserId, reason);
          break;
        default:
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
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  private async processBanUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      await guild.members.ban(userId, {
        reason: reason ?? "No reason provided",
        deleteMessageSeconds: 7 * 24 * 60 * 60, // 7 days
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to ban user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processKickUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId);
      await member.kick(reason ?? "No reason provided");
      return true;
    } catch (error) {
      throw new Error(`Failed to kick user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processTimeoutUser(guild: Guild, userId: string, reason?: string, duration?: number): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId);
      const timeoutDuration = duration ? duration * 1000 : 300000; // Default 5 minutes

      // Discord timeout limit is 28 days
      const maxTimeout = 28 * 24 * 60 * 60 * 1000;
      const actualTimeout = Math.min(timeoutDuration, maxTimeout);

      await member.timeout(actualTimeout, reason ?? "No reason provided");
      return true;
    } catch (error) {
      throw new Error(`Failed to timeout user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async processUnbanUser(guild: Guild, userId: string, reason?: string): Promise<boolean> {
    try {
      await guild.members.unban(userId, reason ?? "No reason provided");
      return true;
    } catch (error) {
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
