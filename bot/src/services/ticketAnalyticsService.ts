import { Guild } from "discord.js";
import { prisma } from "../database/index.js";
import logger from "../logger.js";

export class TicketAnalyticsService {
  private guild: Guild;

  constructor(guild: Guild) {
    this.guild = guild;
  }

  /**
   * Track ticket creation
   */
  async trackTicketCreation(ticketId: string, category: string, userId: string, assigneeId?: string): Promise<void> {
    try {
      await prisma.ticketAnalytics.create({
        data: {
          guildId: this.guild.id,
          ticketId,
          category,
          assigneeId,
          createdAt: new Date(),
        },
      });

      // Update daily stats
      await this.updateDailyStats(new Date(), category, assigneeId, {
        ticketsCreated: 1,
      });

      logger.info(`Tracked ticket creation: ${ticketId} in category ${category}`);
    } catch (error) {
      logger.error(`Failed to track ticket creation for ${ticketId}:`, error);
    }
  }

  /**
   * Track first response to a ticket
   */
  async trackFirstResponse(ticketId: string, responseTime: number, responderId: string): Promise<void> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        logger.warn(`Ticket ${ticketId} not found for first response tracking`);
        return;
      }

      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          firstResponseAt: new Date(),
          firstResponseTime: responseTime,
        },
      });

      // Update daily stats
      await this.updateDailyStats(new Date(), ticket.category, ticket.assignedTo, {
        avgFirstResponseTime: responseTime,
      });

      logger.info(`Tracked first response for ticket ${ticketId}: ${responseTime} minutes`);
    } catch (error) {
      logger.error(`Failed to track first response for ${ticketId}:`, error);
    }
  }

  /**
   * Track ticket message
   */
  async trackMessage(ticketId: string, authorId: string, isStaff: boolean): Promise<void> {
    try {
      const updateData: any = {
        messageCount: { increment: 1 },
      };

      if (isStaff) {
        updateData.staffMessageCount = { increment: 1 };
      } else {
        updateData.userMessageCount = { increment: 1 };
      }

      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: updateData,
      });

      // Get ticket for category info
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { category: true, assignedTo: true },
      });

      if (ticket) {
        // Update daily stats
        const dailyUpdateData: any = {
          totalMessages: 1,
        };

        if (isStaff) {
          dailyUpdateData.staffMessages = 1;
        } else {
          dailyUpdateData.userMessages = 1;
        }

        await this.updateDailyStats(new Date(), ticket.category, ticket.assignedTo, dailyUpdateData);
      }
    } catch (error) {
      logger.error(`Failed to track message for ticket ${ticketId}:`, error);
    }
  }

  /**
   * Track ticket resolution
   */
  async trackResolution(ticketId: string, resolutionTime: number): Promise<void> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        logger.warn(`Ticket ${ticketId} not found for resolution tracking`);
        return;
      }

      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          resolvedAt: new Date(),
          resolutionTime,
        },
      });

      // Update daily stats
      await this.updateDailyStats(new Date(), ticket.category, ticket.assignedTo, {
        ticketsResolved: 1,
        avgResolutionTime: resolutionTime,
      });

      logger.info(`Tracked resolution for ticket ${ticketId}: ${resolutionTime} minutes`);
    } catch (error) {
      logger.error(`Failed to track resolution for ${ticketId}:`, error);
    }
  }

  /**
   * Track ticket closure
   */
  async trackClosure(ticketId: string, closedBy: string): Promise<void> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        logger.warn(`Ticket ${ticketId} not found for closure tracking`);
        return;
      }

      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          closedAt: new Date(),
        },
      });

      // Update daily stats
      await this.updateDailyStats(new Date(), ticket.category, ticket.assignedTo, {
        ticketsClosed: 1,
      });

      logger.info(`Tracked closure for ticket ${ticketId}`);
    } catch (error) {
      logger.error(`Failed to track closure for ${ticketId}:`, error);
    }
  }

  /**
   * Track ticket escalation
   */
  async trackEscalation(ticketId: string, fromAssignee?: string, toAssignee?: string): Promise<void> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        logger.warn(`Ticket ${ticketId} not found for escalation tracking`);
        return;
      }

      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          escalationCount: { increment: 1 },
        },
      });

      // Update daily stats
      await this.updateDailyStats(new Date(), ticket.category, ticket.assignedTo, {
        ticketsEscalated: 1,
      });

      logger.info(`Tracked escalation for ticket ${ticketId}`);
    } catch (error) {
      logger.error(`Failed to track escalation for ${ticketId}:`, error);
    }
  }

  /**
   * Track ticket assignment
   */
  async trackAssignment(ticketId: string, assigneeId: string): Promise<void> {
    try {
      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          assigneeId,
        },
      });

      logger.info(`Tracked assignment for ticket ${ticketId} to ${assigneeId}`);
    } catch (error) {
      logger.error(`Failed to track assignment for ${ticketId}:`, error);
    }
  }

  /**
   * Track priority change
   */
  async trackPriorityChange(ticketId: string, newPriority: string): Promise<void> {
    try {
      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          priority: newPriority,
        },
      });

      logger.info(`Tracked priority change for ticket ${ticketId} to ${newPriority}`);
    } catch (error) {
      logger.error(`Failed to track priority change for ${ticketId}:`, error);
    }
  }

  /**
   * Track tags update
   */
  async trackTagsUpdate(ticketId: string, tags: string[]): Promise<void> {
    try {
      await prisma.ticketAnalytics.update({
        where: { ticketId },
        data: {
          tags,
        },
      });

      logger.info(`Tracked tags update for ticket ${ticketId}: ${tags.join(", ")}`);
    } catch (error) {
      logger.error(`Failed to track tags update for ${ticketId}:`, error);
    }
  }

  /**
   * Calculate response time from ticket creation to first staff response
   */
  calculateResponseTime(ticketCreatedAt: Date, firstResponseAt: Date): number {
    return Math.floor((firstResponseAt.getTime() - ticketCreatedAt.getTime()) / (1000 * 60)); // minutes
  }

  /**
   * Calculate resolution time from ticket creation to resolution
   */
  calculateResolutionTime(ticketCreatedAt: Date, resolvedAt: Date): number {
    return Math.floor((resolvedAt.getTime() - ticketCreatedAt.getTime()) / (1000 * 60)); // minutes
  }

  /**
   * Check if user is staff member
   */
  async isStaffMember(userId: string): Promise<boolean> {
    try {
      const member = this.guild.members.cache.get(userId);
      if (!member) return false;

      // Check if member has moderation permissions
      return member.permissions.has(["ManageMessages", "KickMembers", "BanMembers"], false);
    } catch (error) {
      logger.error(`Failed to check staff status for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(
    date: Date,
    category: string,
    assigneeId: string | null = null,
    updates: {
      ticketsCreated?: number;
      ticketsResolved?: number;
      ticketsClosed?: number;
      ticketsEscalated?: number;
      avgFirstResponseTime?: number;
      avgResolutionTime?: number;
      totalMessages?: number;
      staffMessages?: number;
      userMessages?: number;
    } = {}
  ): Promise<void> {
    try {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      // Update general stats (all categories, all assignees)
      await this.upsertDailyStats(dayStart, null, null, updates);

      // Update category-specific stats
      await this.upsertDailyStats(dayStart, category, null, updates);

      // Update assignee-specific stats
      if (assigneeId) {
        await this.upsertDailyStats(dayStart, null, assigneeId, updates);
        await this.upsertDailyStats(dayStart, category, assigneeId, updates);
      }
    } catch (error) {
      logger.error("Failed to update daily stats:", error);
    }
  }

  /**
   * Upsert daily statistics record
   */
  private async upsertDailyStats(
    date: Date,
    category: string | null,
    assigneeId: string | null,
    updates: Record<string, number>
  ): Promise<void> {
    const whereClause = {
      guildId: this.guild.id,
      date,
      category,
      assigneeId,
    };

    const incrementData: Record<string, { increment: number }> = {};
    const avgData: Record<string, number> = {};

    // Handle incremental updates
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === "number") {
        if (key.startsWith("avg")) {
          avgData[key] = value;
        } else {
          incrementData[key] = { increment: value };
        }
      }
    });

    // For averages, we need to calculate properly
    if (Object.keys(avgData).length > 0) {
      const existing = await prisma.ticketDailyStats.findFirst({ where: whereClause });

      if (existing) {
        // Calculate new averages
        const updateData: Record<string, any> = { ...incrementData };

        if (avgData.avgFirstResponseTime && existing.avgFirstResponseTime) {
          // Weighted average calculation would go here
          updateData.avgFirstResponseTime =
            (Number(existing.avgFirstResponseTime) + Number(avgData.avgFirstResponseTime)) / 2;
        } else if (avgData.avgFirstResponseTime) {
          updateData.avgFirstResponseTime = avgData.avgFirstResponseTime;
        }

        if (avgData.avgResolutionTime && existing.avgResolutionTime) {
          updateData.avgResolutionTime = (Number(existing.avgResolutionTime) + Number(avgData.avgResolutionTime)) / 2;
        } else if (avgData.avgResolutionTime) {
          updateData.avgResolutionTime = avgData.avgResolutionTime;
        }

        await prisma.ticketDailyStats.update({
          where: { id: existing.id },
          data: updateData,
        });
      } else {
        await prisma.ticketDailyStats.create({
          data: {
            guildId: this.guild.id,
            date,
            category,
            assigneeId,
            ...Object.fromEntries(Object.entries(incrementData).map(([key, value]) => [key, value.increment])),
            ...avgData,
          },
        });
      }
    } else {
      const existing = await prisma.ticketDailyStats.findFirst({ where: whereClause });

      if (existing) {
        await prisma.ticketDailyStats.update({
          where: { id: existing.id },
          data: incrementData,
        });
      } else {
        await prisma.ticketDailyStats.create({
          data: {
            guildId: this.guild.id,
            date,
            category,
            assigneeId,
            ...Object.fromEntries(Object.entries(incrementData).map(([key, value]) => [key, value.increment])),
          },
        });
      }
    }
  }

  /**
   * Generate staff performance metrics for a period
   */
  async generateStaffMetrics(
    staffId: string,
    period: "DAILY" | "WEEKLY" | "MONTHLY",
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    try {
      const whereClause = {
        guildId: this.guild.id,
        assigneeId: staffId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      };

      const [ticketStats, satisfactionStats] = await Promise.all([
        prisma.ticketAnalytics.aggregate({
          where: whereClause,
          _count: {
            id: true,
          },
          _avg: {
            firstResponseTime: true,
            resolutionTime: true,
          },
        }),

        prisma.ticketSatisfactionSurvey.aggregate({
          where: {
            guildId: this.guild.id,
            assigneeId: staffId,
            submittedAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          _avg: {
            overallSatisfaction: true,
          },
        }),
      ]);

      const resolvedCount = await prisma.ticketAnalytics.count({
        where: {
          ...whereClause,
          resolvedAt: { not: null },
        },
      });

      const closedCount = await prisma.ticketAnalytics.count({
        where: {
          ...whereClause,
          closedAt: { not: null },
        },
      });

      await prisma.ticketStaffMetrics.upsert({
        where: {
          guildId_staffId_period_periodStart: {
            guildId: this.guild.id,
            staffId,
            period,
            periodStart,
          },
        },
        update: {
          periodEnd,
          ticketsAssigned: ticketStats._count.id,
          ticketsResolved: resolvedCount,
          ticketsClosed: closedCount,
          avgFirstResponseTime: ticketStats._avg.firstResponseTime,
          avgResolutionTime: ticketStats._avg.resolutionTime,
          avgSatisfactionScore: satisfactionStats._avg.overallSatisfaction,
        },
        create: {
          guildId: this.guild.id,
          staffId,
          period,
          periodStart,
          periodEnd,
          ticketsAssigned: ticketStats._count.id,
          ticketsResolved: resolvedCount,
          ticketsClosed: closedCount,
          avgFirstResponseTime: ticketStats._avg.firstResponseTime,
          avgResolutionTime: ticketStats._avg.resolutionTime,
          avgSatisfactionScore: satisfactionStats._avg.overallSatisfaction,
        },
      });

      logger.info(`Generated ${period} metrics for staff ${staffId}`);
    } catch (error) {
      logger.error(`Failed to generate staff metrics for ${staffId}:`, error);
    }
  }
}

export function createTicketAnalyticsService(guild: Guild): TicketAnalyticsService {
  return new TicketAnalyticsService(guild);
}
