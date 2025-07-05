import type { BaseJob } from "@shared/types/queue";
import type { Guild } from "discord.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { BaseProcessor, type ProcessorResult } from "./BaseProcessor.js";

interface BulkModerationJob extends BaseJob {
  type: "BULK_BAN" | "BULK_KICK" | "BULK_TIMEOUT";
  guildId: string;
  userIds: string[];
  reason?: string;
  duration?: number;
  deleteMessages?: boolean;
  moderatorId?: string;
}

export class BulkModerationProcessor extends BaseProcessor<BulkModerationJob> {
  constructor(client: Client) {
    super(client, "BulkModerationProcessor");
  }

  getJobTypes(): string[] {
    return ["BULK_BAN", "BULK_KICK", "BULK_TIMEOUT"];
  }

  async processJob(job: BulkModerationJob): Promise<ProcessorResult> {
    const { type, guildId, userIds, reason, moderatorId } = job;

    if (!guildId) {
      return {
        success: false,
        error: "Guild ID is required for bulk moderation",
        timestamp: Date.now(),
      };
    }

    if (!userIds || userIds.length === 0) {
      return {
        success: false,
        error: "User IDs array is required and cannot be empty",
        timestamp: Date.now(),
      };
    }

    if (!moderatorId) {
      return {
        success: false,
        error: "Moderator ID is required for bulk moderation",
        timestamp: Date.now(),
      };
    }

    try {
      const guild = await this.fetchGuild(guildId);
      let results = { success: 0, failed: 0, errors: [] as string[], cases: [] as number[] };

      switch (type) {
        case "BULK_BAN":
          results = await this.processBulkBan(job, guild);
          break;
        case "BULK_KICK":
          results = await this.processBulkKick(job, guild);
          break;
        case "BULK_TIMEOUT":
          results = await this.processBulkTimeout(job, guild);
          break;
        default:
          return {
            success: false,
            error: `Unknown bulk moderation type: ${type}`,
            timestamp: Date.now(),
          };
      }

      return {
        success: results.success > 0,
        data: {
          type,
          guildId,
          totalUsers: userIds.length,
          successCount: results.success,
          failedCount: results.failed,
          errors: results.errors,
          cases: results.cases,
          completedAt: Date.now(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown bulk operation error",
        timestamp: Date.now(),
      };
    }
  }

  private async processBulkBan(
    job: BulkModerationJob,
    guild: Guild
  ): Promise<{ success: number; failed: number; errors: string[]; cases: number[] }> {
    const { userIds, reason, deleteMessages, moderatorId } = job;
    const results = { success: 0, failed: 0, errors: [] as string[], cases: [] as number[] };

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      try {
        const moderationCase = await this.client.moderationManager.ban(
          guild,
          userId,
          moderatorId!,
          reason || "Bulk ban operation",
          undefined,
          [`Bulk operation: ${job.id}`],
          false,
          {
            interactionId: job.id,
            commandName: "bulk ban",
            interactionLatency: 0,
          }
        );

        results.cases.push(moderationCase.caseNumber);
        results.success++;
        logger.info(`Bulk banned user ${userId} from guild ${guild.id}`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to ban ${userId}: ${error}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }

      // Rate limiting: small delay between bans
      if (i < userIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(`Bulk ban completed for guild ${guild.id}: ${results.success} successful, ${results.failed} failed`);
    return results;
  }

  private async processBulkKick(
    job: BulkModerationJob,
    guild: Guild
  ): Promise<{ success: number; failed: number; errors: string[]; cases: number[] }> {
    const { userIds, reason, moderatorId } = job;
    const results = { success: 0, failed: 0, errors: [] as string[], cases: [] as number[] };

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      try {
        const moderationCase = await this.client.moderationManager.kick(
          guild,
          userId,
          moderatorId!,
          reason || "Bulk kick operation",
          [`Bulk operation: ${job.id}`],
          false,
          {
            interactionId: job.id,
            commandName: "bulk kick",
            interactionLatency: 0,
          }
        );

        results.cases.push(moderationCase.caseNumber);
        results.success++;
        logger.info(`Bulk kicked user ${userId} from guild ${guild.id}`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to kick ${userId}: ${error}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }

      // Rate limiting: small delay between kicks
      if (i < userIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(`Bulk kick completed for guild ${guild.id}: ${results.success} successful, ${results.failed} failed`);
    return results;
  }

  private async processBulkTimeout(
    job: BulkModerationJob,
    guild: Guild
  ): Promise<{ success: number; failed: number; errors: string[]; cases: number[] }> {
    const { userIds, reason, duration, moderatorId } = job;
    const results = { success: 0, failed: 0, errors: [] as string[], cases: [] as number[] };

    if (!duration) {
      results.errors.push("Duration is required for bulk timeout");
      return results;
    }

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      try {
        const moderationCase = await this.client.moderationManager.timeout(
          guild,
          userId,
          moderatorId!,
          duration,
          reason || "Bulk timeout operation",
          [`Bulk operation: ${job.id}`],
          false,
          {
            interactionId: job.id,
            commandName: "bulk timeout",
            interactionLatency: 0,
          }
        );

        results.cases.push(moderationCase.caseNumber);
        results.success++;
        logger.info(`Bulk timed out user ${userId} in guild ${guild.id} for ${duration}s`);
      } catch (error) {
        results.failed++;
        const errorMsg = `Failed to timeout ${userId}: ${error}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }

      // Rate limiting: small delay between timeouts
      if (i < userIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info(
      `Bulk timeout completed for guild ${guild.id}: ${results.success} successful, ${results.failed} failed`
    );
    return results;
  }

  protected getEventPrefix(): string {
    return "bulk_moderation";
  }

  protected getAdditionalEventData(job: BulkModerationJob): Record<string, unknown> {
    return {
      type: job.type,
      guildId: job.guildId,
      userCount: job.userIds?.length || 0,
      moderatorId: job.moderatorId,
    };
  }
}
