import { prisma } from "@shared/database";
import { logger } from "../logger";

export interface DiscordEventData {
  userId?: string;
  channelId?: string;
  messageId?: string;
  roleId?: string;
  before?: any;
  after?: any;
  metadata?: any;
  content?: string;
  attachments?: string[];
  embeds?: any[];
  executorId?: string;
  reason?: string;
}

export interface RetentionPolicy {
  guildId: string;
  currentTier: "FREE" | "PREMIUM";
  freeRetentionDays: number;
  premiumRetentionDays: number;
  freeStorageLimit: number;
  premiumStorageLimit: number;
  enabledEventTypes: string[];
  disabledEventTypes: string[];
}

// Discord events that should be logged (excluding high-volume noise)
export const DISCORD_EVENTS = [
  "MESSAGE_CREATE", "MESSAGE_DELETE", "MESSAGE_UPDATE",
  "MEMBER_JOIN", "MEMBER_LEAVE", "MEMBER_UPDATE",
  "CHANNEL_CREATE", "CHANNEL_DELETE", "CHANNEL_UPDATE",
  "ROLE_CREATE", "ROLE_DELETE", "ROLE_UPDATE",
  "GUILD_UPDATE", "GUILD_MEMBER_UPDATE",
  "REACTION_ADD", "REACTION_REMOVE",
  "VOICE_STATE_UPDATE",
  "THREAD_CREATE", "THREAD_DELETE", "THREAD_UPDATE",
  "INVITE_CREATE", "INVITE_DELETE",
  "WEBHOOK_UPDATE",
  "SCHEDULED_EVENT_CREATE", "SCHEDULED_EVENT_UPDATE", "SCHEDULED_EVENT_DELETE",
  "USER_UPDATE"
] as const;

export class EventLogService {
  /**
   * Log a Discord event with automatic retention management
   */
  async logDiscordEvent(
    guildId: string,
    eventType: string,
    data: DiscordEventData = {}
  ): Promise<void> {
    try {
      // Check if this event type should be logged
      if (!DISCORD_EVENTS.includes(eventType as any)) {
        logger.debug(`Skipping non-Discord event: ${eventType}`);
        return;
      }

      // Get retention policy for this guild
      const retention = await this.getRetentionPolicy(guildId);

      // Check if this event type is enabled
      if (retention.enabledEventTypes.length > 0 && !retention.enabledEventTypes.includes(eventType)) {
        return; // Event type not enabled
      }

      if (retention.disabledEventTypes.includes(eventType)) {
        return; // Event type explicitly disabled
      }

      // Calculate expiration date
      const expiresAt = this.calculateExpiration(retention, eventType);

      // Check storage limits before creating
      await this.enforceStorageLimit(guildId, retention);

      // Create the event log
      await prisma.discordEventLog.create({
        data: {
          guildId,
          eventType,
          userId: data.userId,
          channelId: data.channelId,
          messageId: data.messageId,
          roleId: data.roleId,
          before: data.before,
          after: data.after,
          metadata: data.metadata,
          content: data.content,
          attachments: data.attachments || [],
          embeds: data.embeds || [],
          executorId: data.executorId,
          reason: data.reason,
          retentionTier: retention.currentTier,
          expiresAt,
        },
      });

      logger.debug(`Logged Discord event: ${eventType} for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to log Discord event ${eventType}:`, error);
    }
  }

  /**
   * Get or create retention policy for a guild
   */
  async getRetentionPolicy(guildId: string): Promise<RetentionPolicy> {
    try {
      let retention = await prisma.discordEventRetention.findUnique({
        where: { guildId }
      });

      if (!retention) {
        // Create default retention policy
        retention = await prisma.discordEventRetention.create({
          data: {
            guildId,
            currentTier: "FREE",
            freeRetentionDays: 3,
            premiumRetentionDays: 14,
            freeStorageLimit: 10000,
            premiumStorageLimit: 100000,
            enabledEventTypes: [],
            disabledEventTypes: [],
          }
        });
      }

      return retention as RetentionPolicy;
    } catch (error) {
      logger.error(`Failed to get retention policy for guild ${guildId}:`, error);
      // Return default policy on error
      return {
        guildId,
        currentTier: "FREE",
        freeRetentionDays: 3,
        premiumRetentionDays: 14,
        freeStorageLimit: 10000,
        premiumStorageLimit: 100000,
        enabledEventTypes: [],
        disabledEventTypes: [],
      };
    }
  }

  /**
   * Calculate expiration date based on retention policy
   */
  private calculateExpiration(retention: RetentionPolicy, eventType: string): Date {
    const retentionDays = retention.currentTier === "PREMIUM" 
      ? retention.premiumRetentionDays 
      : retention.freeRetentionDays;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    return expiresAt;
  }

  /**
   * Enforce storage limits by removing oldest events if necessary
   */
  private async enforceStorageLimit(guildId: string, retention: RetentionPolicy): Promise<void> {
    try {
      const storageLimit = retention.currentTier === "PREMIUM"
        ? retention.premiumStorageLimit
        : retention.freeStorageLimit;

      if (!storageLimit) return; // Unlimited storage

      // Count current events
      const currentCount = await prisma.discordEventLog.count({
        where: { guildId }
      });

      if (currentCount >= storageLimit) {
        // Remove oldest events to make room
        const eventsToRemove = currentCount - storageLimit + 1;
        
        const oldestEvents = await prisma.discordEventLog.findMany({
          where: { guildId },
          orderBy: { createdAt: 'asc' },
          take: eventsToRemove,
          select: { id: true }
        });

        if (oldestEvents.length > 0) {
          await prisma.discordEventLog.deleteMany({
            where: {
              id: { in: oldestEvents.map(e => e.id) }
            }
          });

          logger.info(`Removed ${oldestEvents.length} old events for guild ${guildId} (storage limit enforcement)`);
        }
      }
    } catch (error) {
      logger.error(`Failed to enforce storage limit for guild ${guildId}:`, error);
    }
  }

  /**
   * Update retention policy for a guild
   */
  async updateRetentionPolicy(
    guildId: string,
    updates: Partial<Omit<RetentionPolicy, 'guildId'>>
  ): Promise<void> {
    try {
      await prisma.discordEventRetention.upsert({
        where: { guildId },
        create: {
          guildId,
          currentTier: "FREE",
          freeRetentionDays: 3,
          premiumRetentionDays: 14,
          freeStorageLimit: 10000,
          premiumStorageLimit: 100000,
          enabledEventTypes: [],
          disabledEventTypes: [],
          ...updates
        },
        update: updates
      });

      logger.info(`Updated retention policy for guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to update retention policy for guild ${guildId}:`, error);
    }
  }

  /**
   * Clean up expired events (run by scheduled job)
   */
  async cleanupExpiredEvents(): Promise<void> {
    try {
      const result = await prisma.discordEventLog.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired Discord events`);
      }
    } catch (error) {
      logger.error("Failed to cleanup expired events:", error);
    }
  }

  /**
   * Get event statistics for a guild
   */
  async getEventStats(guildId: string): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    storageUsed: number;
    storageLimit: number | null;
    retentionTier: string;
    oldestEvent?: Date;
    newestEvent?: Date;
  }> {
    try {
      const retention = await this.getRetentionPolicy(guildId);
      
      const totalEvents = await prisma.discordEventLog.count({
        where: { guildId }
      });

      const eventsByType = await prisma.discordEventLog.groupBy({
        by: ['eventType'],
        where: { guildId },
        _count: { eventType: true }
      });

      const oldestEvent = await prisma.discordEventLog.findFirst({
        where: { guildId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });

      const newestEvent = await prisma.discordEventLog.findFirst({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

      const storageLimit = retention.currentTier === "PREMIUM"
        ? retention.premiumStorageLimit
        : retention.freeStorageLimit;

      return {
        totalEvents,
        eventsByType: eventsByType.reduce((acc, item) => {
          acc[item.eventType] = item._count.eventType;
          return acc;
        }, {} as Record<string, number>),
        storageUsed: totalEvents,
        storageLimit,
        retentionTier: retention.currentTier,
        oldestEvent: oldestEvent?.createdAt,
        newestEvent: newestEvent?.createdAt,
      };
    } catch (error) {
      logger.error(`Failed to get event stats for guild ${guildId}:`, error);
      throw error;
    }
  }
}