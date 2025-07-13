import { RedisConnectionFactory } from "../../../shared/src/utils/RedisConnectionFactory";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";

interface ComplimentWheelConfig {
  guildId: string;
  messageId: string;
  channelId: string;
  complimentChannelId: string;
  emoji: string;
}

interface WheelParticipant {
  userId: string;
  username: string;
  addedAt: Date;
}

export class ComplimentWheelService {
  private static instance: ComplimentWheelService;
  private readonly redis = RedisConnectionFactory.getSharedConnection();
  private client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  static getInstance(client: Client): ComplimentWheelService {
    if (!ComplimentWheelService.instance) {
      ComplimentWheelService.instance = new ComplimentWheelService(client);
    }
    return ComplimentWheelService.instance;
  }

  /**
   * Get Redis key for wheel participants
   */
  private getParticipantsKey(guildId: string): string {
    return `compliment:participants:${guildId}`;
  }

  /**
   * Get Redis key for current cycle number
   */
  private getCycleKey(guildId: string): string {
    return `compliment:cycle:${guildId}`;
  }

  /**
   * Get Redis key for last draw time
   */
  private getLastDrawKey(guildId: string): string {
    return `compliment:lastDraw:${guildId}`;
  }

  /**
   * Setup or update compliment wheel configuration
   */
  async setupWheel(config: ComplimentWheelConfig): Promise<void> {
    try {
      await prisma.complimentWheel.upsert({
        where: { guildId: config.guildId },
        update: {
          messageId: config.messageId,
          channelId: config.channelId,
          complimentChannelId: config.complimentChannelId,
          emoji: config.emoji,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          guildId: config.guildId,
          messageId: config.messageId,
          channelId: config.channelId,
          complimentChannelId: config.complimentChannelId,
          emoji: config.emoji,
          isActive: true,
        },
      });

      // Initialize cycle number if not exists
      const cycleKey = this.getCycleKey(config.guildId);
      const currentCycle = await this.redis.get(cycleKey);
      if (!currentCycle) {
        await this.redis.set(cycleKey, "1");
      }

      logger.info(`Compliment wheel setup for guild ${config.guildId}`);
    } catch (error) {
      logger.error("Error setting up compliment wheel:", error);
      throw error;
    }
  }

  /**
   * Add a user to the wheel
   */
  async addParticipant(guildId: string, userId: string, username: string): Promise<void> {
    try {
      const participantsKey = this.getParticipantsKey(guildId);
      const participant: WheelParticipant = {
        userId,
        username,
        addedAt: new Date(),
      };

      await this.redis.hset(participantsKey, userId, JSON.stringify(participant));
      logger.debug(`Added participant ${username} (${userId}) to wheel in guild ${guildId}`);
    } catch (error) {
      logger.error("Error adding participant to wheel:", error);
      throw error;
    }
  }

  /**
   * Remove a user from the wheel
   */
  async removeParticipant(guildId: string, userId: string): Promise<void> {
    try {
      const participantsKey = this.getParticipantsKey(guildId);
      await this.redis.hdel(participantsKey, userId);
      logger.debug(`Removed participant ${userId} from wheel in guild ${guildId}`);
    } catch (error) {
      logger.error("Error removing participant from wheel:", error);
      throw error;
    }
  }

  /**
   * Get all participants in the wheel
   */
  async getParticipants(guildId: string): Promise<WheelParticipant[]> {
    try {
      const participantsKey = this.getParticipantsKey(guildId);
      const participants = await this.redis.hgetall(participantsKey);

      return Object.values(participants).map((p) => JSON.parse(p) as WheelParticipant);
    } catch (error) {
      logger.error("Error getting wheel participants:", error);
      return [];
    }
  }

  /**
   * Get wheel configuration
   */
  async getWheelConfig(guildId: string): Promise<ComplimentWheelConfig | null> {
    try {
      const wheel = await prisma.complimentWheel.findUnique({
        where: { guildId },
      });

      if (!wheel || !wheel.isActive) {
        return null;
      }

      return {
        guildId: wheel.guildId,
        messageId: wheel.messageId,
        channelId: wheel.channelId,
        complimentChannelId: wheel.complimentChannelId,
        emoji: wheel.emoji,
      };
    } catch (error) {
      logger.error("Error getting wheel config:", error);
      return null;
    }
  }

  /**
   * Get current cycle number
   */
  async getCurrentCycle(guildId: string): Promise<number> {
    try {
      const cycleKey = this.getCycleKey(guildId);
      const cycle = await this.redis.get(cycleKey);
      return cycle ? parseInt(cycle, 10) : 1;
    } catch (error) {
      logger.error("Error getting current cycle:", error);
      return 1;
    }
  }

  /**
   * Draw a random winner from the wheel
   */
  async drawWinner(guildId: string): Promise<WheelParticipant | null> {
    try {
      const participants = await this.getParticipants(guildId);
      if (participants.length === 0) {
        return null;
      }

      // Select random winner
      const winner = participants[Math.floor(Math.random() * participants.length)];

      // Remove winner from wheel
      await this.removeParticipant(guildId, winner.userId);

      // Record the draw in database
      const currentCycle = await this.getCurrentCycle(guildId);
      const wheel = await prisma.complimentWheel.findUnique({
        where: { guildId },
      });

      if (wheel) {
        await prisma.complimentDrawnUser.create({
          data: {
            wheelId: wheel.id,
            userId: winner.userId,
            username: winner.username,
            cycleNumber: currentCycle,
          },
        });
      }

      logger.info(`Drew winner ${winner.username} (${winner.userId}) from wheel in guild ${guildId}`);
      return winner;
    } catch (error) {
      logger.error("Error drawing winner:", error);
      return null;
    }
  }

  /**
   * Reset the wheel for a new cycle
   */
  async resetWheel(guildId: string): Promise<void> {
    try {
      // Get all drawn users from current cycle
      const currentCycle = await this.getCurrentCycle(guildId);
      const wheel = await prisma.complimentWheel.findUnique({
        where: { guildId },
      });

      if (!wheel) return;

      const drawnUsers = await prisma.complimentDrawnUser.findMany({
        where: {
          wheelId: wheel.id,
          cycleNumber: currentCycle,
        },
      });

      // Add all drawn users back to the wheel
      const participantsKey = this.getParticipantsKey(guildId);
      for (const drawnUser of drawnUsers) {
        const participant: WheelParticipant = {
          userId: drawnUser.userId,
          username: drawnUser.username,
          addedAt: new Date(),
        };
        await this.redis.hset(participantsKey, drawnUser.userId, JSON.stringify(participant));
      }

      // Increment cycle number
      const cycleKey = this.getCycleKey(guildId);
      await this.redis.incr(cycleKey);

      logger.info(`Reset wheel for guild ${guildId}, new cycle: ${currentCycle + 1}`);
    } catch (error) {
      logger.error("Error resetting wheel:", error);
      throw error;
    }
  }

  /**
   * Check if wheel needs to be reset (all participants have been drawn)
   */
  async shouldResetWheel(guildId: string): Promise<boolean> {
    try {
      const participants = await this.getParticipants(guildId);
      return participants.length === 0;
    } catch (error) {
      logger.error("Error checking if wheel should reset:", error);
      return false;
    }
  }

  /**
   * Get drawn users for current cycle
   */
  async getDrawnUsers(guildId: string, cycleNumber?: number): Promise<any[]> {
    try {
      const currentCycle = cycleNumber || (await this.getCurrentCycle(guildId));
      const wheel = await prisma.complimentWheel.findUnique({
        where: { guildId },
      });

      if (!wheel) return [];

      return await prisma.complimentDrawnUser.findMany({
        where: {
          wheelId: wheel.id,
          cycleNumber: currentCycle,
        },
        orderBy: { drawnAt: "asc" },
      });
    } catch (error) {
      logger.error("Error getting drawn users:", error);
      return [];
    }
  }

  /**
   * Disable the wheel
   */
  async disableWheel(guildId: string): Promise<void> {
    try {
      await prisma.complimentWheel.update({
        where: { guildId },
        data: { isActive: false },
      });

      // Clear Redis data
      const participantsKey = this.getParticipantsKey(guildId);
      const cycleKey = this.getCycleKey(guildId);
      const lastDrawKey = this.getLastDrawKey(guildId);

      await this.redis.del(participantsKey, cycleKey, lastDrawKey);

      logger.info(`Disabled compliment wheel for guild ${guildId}`);
    } catch (error) {
      logger.error("Error disabling wheel:", error);
      throw error;
    }
  }

  /**
   * Send daily compliment message
   */
  async sendDailyCompliment(guildId: string): Promise<void> {
    try {
      const config = await this.getWheelConfig(guildId);
      if (!config) {
        logger.warn(`No active compliment wheel found for guild ${guildId}`);
        return;
      }

      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        logger.warn(`Guild ${guildId} not found for daily compliment`);
        return;
      }

      const channel = await guild.channels.fetch(config.complimentChannelId).catch(() => null);
      if (!channel?.isTextBased()) {
        logger.warn(`Compliment channel ${config.complimentChannelId} not found or not text-based`);
        return;
      }

      // Check if wheel needs reset
      if (await this.shouldResetWheel(guildId)) {
        await this.resetWheel(guildId);
      }

      // Draw winner
      const winner = await this.drawWinner(guildId);
      if (!winner) {
        await channel.send(
          "🎉 **Daily Compliment**\n\nNo participants in the wheel today! Add some reactions to get started!"
        );
        return;
      }

      // Send compliment message
      // Dutch: Persoon van de dag! with mention in description
      const embed = {
        title: `🎉 Persoon van de dag!`,
        description: `<@${winner.userId}> is de persoon van de dag!\n*Geef zoveel complimenten als je wilt, zolang ze maar over <@${winner.userId}> gaan!*`,
        color: 0x00bfff,
      };
      await channel.send({ embeds: [embed] });

      // Update last draw time
      const lastDrawKey = this.getLastDrawKey(guildId);
      await this.redis.set(lastDrawKey, Date.now().toString());

      logger.info(`Sent daily compliment to ${winner.username} in guild ${guildId}`);
    } catch (error) {
      logger.error("Error sending daily compliment:", error);
    }
  }

  /**
   * Perform an instant test round of the compliment wheel
   */
  async performTestRound(guildId: string): Promise<{ winnerId: string; participantCount: number } | null> {
    try {
      const config = await this.getWheelConfig(guildId);
      if (!config) {
        return null;
      }

      const participants = await this.getParticipants(guildId);
      if (participants.length === 0) {
        return null;
      }

      // Draw a winner without removing them from the wheel (for testing)
      const winner = participants[Math.floor(Math.random() * participants.length)];

      // Send test compliment message (Dutch embed)
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return null;
      }
      const channel = await guild.channels.fetch(config.complimentChannelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return null;
      }
      const testEmbed = {
        title: `🎉 Persoon van de dag!`,
        description: `<@${winner.userId}> is de persoon van de dag!\n*Geef zoveel complimenten als je wilt, zolang ze maar over <@${winner.userId}> gaan!*`,
        color: 0x00bfff,
        footer: { text: "Test Compliment" },
      };
      await channel.send({ embeds: [testEmbed] });

      logger.info(`Performed test round for guild ${guildId}, winner: ${winner.username}`);
      return {
        winnerId: winner.userId,
        participantCount: participants.length,
      };
    } catch (error) {
      logger.error("Error performing test round:", error);
      return null;
    }
  }

  /**
   * Completely delete the wheel and all associated data
   */
  async deleteWheel(guildId: string): Promise<void> {
    try {
      // Delete from database
      await prisma.complimentWheel.delete({
        where: { guildId },
      });

      // Clear all Redis data
      const participantsKey = this.getParticipantsKey(guildId);
      const cycleKey = this.getCycleKey(guildId);
      const lastDrawKey = this.getLastDrawKey(guildId);

      await this.redis.del(participantsKey, cycleKey, lastDrawKey);

      logger.info(`Deleted compliment wheel for guild ${guildId}`);
    } catch (error) {
      logger.error("Error deleting wheel:", error);
      throw error;
    }
  }
}
