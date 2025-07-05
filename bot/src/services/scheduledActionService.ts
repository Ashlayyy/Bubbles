import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

export class ScheduledActionService {
  private interval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60_000; // 1 minute
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => void this.checkAndExecute(), this.checkIntervalMs);
    logger.info("ScheduledActionService started (polling every 60s)");
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
    logger.info("ScheduledActionService stopped");
  }

  private async checkAndExecute(): Promise<void> {
    try {
      const now = new Date();
      const dueActions = (await prisma.scheduledAction.findMany({
        where: {
          isExecuted: false,
          scheduledFor: { lte: now },
          retryCount: { lt: 3 },
        },
        orderBy: { scheduledFor: "asc" },
        take: 20, // process max 20 per tick
      })) as { id: string; guildId: string; userId: string; type: string }[];

      if (dueActions.length === 0) return;

      for (const action of dueActions) {
        try {
          await this.executeAction(action);
          await prisma.scheduledAction.update({
            where: { id: action.id },
            data: { isExecuted: true, executedAt: new Date() },
          });
        } catch (err) {
          logger.error("Failed executing scheduled action", err);
          await prisma.scheduledAction.update({
            where: { id: action.id },
            data: {
              retryCount: { increment: 1 },
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    } catch (error) {
      logger.error("ScheduledActionService cycle error:", error);
    }
  }

  private async executeAction(action: {
    guildId: string;
    userId: string;
    type: string;
    data?: unknown;
  }): Promise<void> {
    const { guildId, userId, type } = action;
    const guild = await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error("Guild not found or bot not in guild");

    switch (type) {
      case "UNBAN": {
        await guild.members.unban(String(userId), "Scheduled unban");
        await this.client.logManager.log(String(guildId), "MOD_UNBAN", {
          userId,
          executorId: this.client.user?.id,
          reason: "Scheduled unban",
        });
        break;
      }
      case "UNTIMEOUT": {
        const member = await guild.members.fetch(String(userId)).catch(() => null);
        if (!member) throw new Error("Member not found for untimeout");
        await member.timeout(null, "Scheduled untimeout");
        await this.client.logManager.log(String(guildId), "MOD_UNTIMEOUT", {
          userId,
          executorId: this.client.user?.id,
          reason: "Scheduled untimeout",
        });
        break;
      }
      default:
        throw new Error(`Unknown scheduled action type ${type}`);
    }
  }
}
