/* eslint-disable @typescript-eslint/no-extraneous-class */
import type { GuildConfig } from "@shared/database";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import { cacheService } from "./cacheService.js";

interface BatchModerationLog {
  guildId: string;
  logType: string;
  userId?: string;
  channelId?: string;
  roleId?: string;
  caseId?: string;
  before?: object;
  after?: object;
  metadata?: object;
  content?: string;
  attachments?: string[];
  embeds?: object[];
  executorId?: string;
  reason?: string;
  sentToChannels?: string[];
  timestamp?: Date;
}

interface BatchOperation<T> {
  data: T[];
  flushSize: number;
  flushInterval: number;
  lastFlush: number;
}

interface BulkGuildConfigUpdate {
  guildId: string;
  data: Partial<Omit<GuildConfig, "id" | "guildId">>;
}

export class BatchOperationManager {
  private moderationLogs: BatchOperation<BatchModerationLog>;
  private flushTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    // Configure batch operations
    this.moderationLogs = {
      data: [],
      flushSize: 50, // Flush after 50 entries
      flushInterval: 10000, // Flush every 10 seconds
      lastFlush: Date.now(),
    };

    this.startPeriodicFlush();
    logger.info("Batch operation manager initialized");
  }

  private startPeriodicFlush(): void {
    // Set up periodic flush for all batch operations
    const flushTimer = setInterval(() => {
      void this.flushAll();
    }, 5000); // Check every 5 seconds

    this.flushTimers.set("periodic", flushTimer);
  }

  /**
   * Add moderation log to batch
   */
  async addModerationLog(logData: Omit<BatchModerationLog, "timestamp">): Promise<void> {
    const log: BatchModerationLog = {
      ...logData,
      timestamp: new Date(),
    };

    this.moderationLogs.data.push(log);

    // Auto-flush if batch size reached
    if (this.moderationLogs.data.length >= this.moderationLogs.flushSize) {
      await this.flushModerationLogs();
    }
  }

  /**
   * Flush moderation logs to database
   */
  private async flushModerationLogs(): Promise<void> {
    if (this.moderationLogs.data.length === 0) return;

    const logs = [...this.moderationLogs.data];
    this.moderationLogs.data = [];
    this.moderationLogs.lastFlush = Date.now();

    try {
      await prisma.moderationLog.createMany({
        data: logs.map((log) => ({
          guildId: log.guildId,
          logType: log.logType,
          userId: log.userId ?? null,
          channelId: log.channelId ?? null,
          roleId: log.roleId ?? null,
          caseId: log.caseId ?? null,
          before: log.before ?? null,
          after: log.after ?? null,
          metadata: log.metadata ?? null,
          content: log.content ?? null,
          attachments: log.attachments ?? [],
          embeds: log.embeds ?? [],
          executorId: log.executorId ?? null,
          reason: log.reason ?? null,
          sentToChannels: log.sentToChannels ?? [],
          timestamp: log.timestamp ?? new Date(),
        })),
      });

      logger.info(`Flushed ${logs.length.toString()} moderation logs to database`);
    } catch (error) {
      logger.error("Failed to flush moderation logs:", error);
      // Re-add failed logs to retry later (with limit to prevent infinite growth)
      if (this.moderationLogs.data.length < 500) {
        this.moderationLogs.data.unshift(...logs);
      }
    }
  }

  /**
   * Flush all pending batch operations
   */
  async flushAll(): Promise<void> {
    const now = Date.now();

    // Check if moderation logs need flushing
    if (
      this.moderationLogs.data.length > 0 &&
      now - this.moderationLogs.lastFlush >= this.moderationLogs.flushInterval
    ) {
      await this.flushModerationLogs();
    }
  }

  /**
   * Force flush all operations immediately
   */
  async forceFlushAll(): Promise<void> {
    await this.flushModerationLogs();
    logger.info("Force flushed all batch operations");
  }

  /**
   * Get batch operation statistics
   */
  getStats() {
    return {
      moderationLogs: {
        pending: this.moderationLogs.data.length,
        lastFlush: this.moderationLogs.lastFlush,
        flushSize: this.moderationLogs.flushSize,
        flushInterval: this.moderationLogs.flushInterval,
      },
    };
  }

  /**
   * Shutdown batch operations gracefully
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down batch operation manager...");

    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    this.flushTimers.clear();

    // Flush all pending operations
    await this.forceFlushAll();

    logger.info("Batch operation manager shutdown complete");
  }
}

// Bulk operation helpers for common patterns
export class BulkOperationHelpers {
  /**
   * Bulk upsert guild configurations
   */
  static async bulkUpsertGuildConfigs(configs: BulkGuildConfigUpdate[]): Promise<void> {
    logger.info(`Bulk upserting ${configs.length.toString()} guild configurations`);

    try {
      // Use Prisma transaction for consistency
      await prisma.$transaction(
        configs.map(({ guildId, data }) =>
          prisma.guildConfig.upsert({
            where: { guildId },
            update: data,
            create: {
              guildId,
              ...data,
            },
          })
        )
      );

      // Clear cache for all updated guilds
      await Promise.all(configs.map(({ guildId }) => cacheService.delete(`guild:config:${guildId}`)));

      logger.info(`Bulk upsert completed for ${configs.length.toString()} guild configurations`);
    } catch (error) {
      logger.error("Error in bulk guild config upsert:", error);
      throw error;
    }
  }

  /**
   * Bulk delete expired moderation cases
   */
  static async cleanupExpiredModerationCases(batchSize = 1000): Promise<number> {
    logger.info(`Cleaning up expired moderation cases (batch size: ${batchSize.toString()})`);

    try {
      const expiredCases = await prisma.moderationCase.findMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
          isActive: true,
        },
        select: { id: true, guildId: true },
        take: batchSize,
      });

      if (expiredCases.length === 0) {
        return 0;
      }

      // Update cases to inactive
      await prisma.moderationCase.updateMany({
        where: {
          id: { in: expiredCases.map((c) => c.id) },
        },
        data: {
          isActive: false,
        },
      });

      // Clear related caches
      const uniqueGuilds = [...new Set(expiredCases.map((c) => c.guildId))];
      await Promise.all(uniqueGuilds.map((guildId) => cacheService.invalidatePattern(`moderation:.*:${guildId}:.*`)));

      logger.info(`Cleaned up ${expiredCases.length} expired moderation cases`);
      return expiredCases.length;
    } catch (error) {
      logger.error("Error cleaning up expired moderation cases:", error);
      throw error;
    }
  }

  /**
   * Bulk archive old logs
   */
  static async archiveOldLogs(guildId: string, daysToKeep = 90, batchSize = 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    logger.info(`Archiving old logs for guild ${guildId} older than ${cutoffDate.toISOString()}`);

    try {
      const oldLogs = await prisma.moderationLog.findMany({
        where: {
          guildId,
          timestamp: { lt: cutoffDate },
        },
        take: batchSize,
      });

      if (oldLogs.length === 0) {
        return 0;
      }

      // Archive to compressed format (you might want to store this in a separate service)
      // For now, we'll just delete them after a certain period
      await prisma.moderationLog.deleteMany({
        where: {
          id: { in: oldLogs.map((log) => log.id) },
        },
      });

      logger.info(`Archived ${oldLogs.length} old logs for guild ${guildId}`);
      return oldLogs.length;
    } catch (error) {
      logger.error(`Error archiving old logs for guild ${guildId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const batchOperationManager = new BatchOperationManager();
export default batchOperationManager;
