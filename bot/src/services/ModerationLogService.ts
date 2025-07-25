import { prisma } from "@shared/database";
import { logger } from "../logger";

export interface ModerationActionData {
  userId?: string;
  channelId?: string;
  caseId?: string;
  reason?: string;
  duration?: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence?: string[];
  context?: any;
  executorId: string; // Required for moderation actions
  executorType?: "USER" | "AUTOMOD" | "SYSTEM";
}

// Moderation actions that should be logged in ModerationActionLog
export const MODERATION_ACTIONS = [
  "WARN", "KICK", "BAN", "UNBAN", "TIMEOUT", "UNTIMEOUT",
  "MUTE", "UNMUTE", "NOTE", "CASE_CREATE", "CASE_UPDATE",
  "CASE_DELETE", "APPEAL_SUBMIT", "APPEAL_APPROVE", "APPEAL_DENY",
  "AUTOMOD_TRIGGER", "AUTOMOD_ACTION"
] as const;

export class ModerationLogService {
  /**
   * Log a moderation action
   */
  async logModerationAction(
    guildId: string,
    actionType: string,
    data: ModerationActionData
  ): Promise<void> {
    try {
      // Validate it's a moderation action
      if (!MODERATION_ACTIONS.includes(actionType as any)) {
        logger.warn(`Invalid moderation action type: ${actionType}`);
        return;
      }

      // Create the moderation action log
      await prisma.moderationActionLog.create({
        data: {
          guildId,
          actionType,
          userId: data.userId,
          channelId: data.channelId,
          caseId: data.caseId,
          reason: data.reason,
          duration: data.duration,
          severity: data.severity,
          evidence: data.evidence || [],
          context: data.context,
          executorId: data.executorId,
          executorType: data.executorType || "USER",
        },
      });

      logger.info(`Logged moderation action: ${actionType} by ${data.executorId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to log moderation action ${actionType}:`, error);
    }
  }

  /**
   * Get moderation action history for a user
   */
  async getUserModerationHistory(
    guildId: string,
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await prisma.moderationActionLog.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          case: {
            select: {
              caseNumber: true,
              type: true,
              reason: true,
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Failed to get moderation history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get moderation statistics for a guild
   */
  async getModerationStats(guildId: string, days: number = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByModerator: Record<string, number>;
    recentActions: any[];
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const actions = await prisma.moderationActionLog.findMany({
        where: {
          guildId,
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const actionsByType: Record<string, number> = {};
      const actionsByModerator: Record<string, number> = {};

      actions.forEach(action => {
        actionsByType[action.actionType] = (actionsByType[action.actionType] || 0) + 1;
        actionsByModerator[action.executorId] = (actionsByModerator[action.executorId] || 0) + 1;
      });

      return {
        totalActions: actions.length,
        actionsByType,
        actionsByModerator,
        recentActions: actions.slice(0, 10),
      };
    } catch (error) {
      logger.error(`Failed to get moderation stats for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Log a moderation case action
   */
  async logCaseAction(
    guildId: string,
    caseId: string,
    actionType: string,
    executorId: string,
    data: Partial<ModerationActionData> = {}
  ): Promise<void> {
    await this.logModerationAction(guildId, actionType, {
      ...data,
      caseId,
      executorId,
    });
  }
}