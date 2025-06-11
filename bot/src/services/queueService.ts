import { QueueManager } from "../queue/manager.js";
import type Client from "../structures/Client.js";
import type { ModerationActionJob, MusicActionJob, SendMessageJob } from "../types/shared.js";
import { QUEUE_NAMES, createLogger } from "../types/shared.js";

const logger = createLogger("bot-queue-service");

export class BotQueueService {
  private queueManager: QueueManager;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.queueManager = new QueueManager();
  }

  async initialize(): Promise<void> {
    logger.info("Initializing bot queue service...");

    // Set up consumers for different job types
    const commandQueue = this.queueManager.getQueue(QUEUE_NAMES.BOT_COMMANDS);

    // Process message sending jobs
    commandQueue.process("send-message", 5, async (job) => {
      return this.handleSendMessage(job.data as SendMessageJob);
    });

    // Process moderation jobs
    commandQueue.process("moderation-action", 3, async (job) => {
      return this.handleModerationAction(job.data as ModerationActionJob);
    });

    // Process music jobs
    commandQueue.process("music-action", 2, async (job) => {
      return this.handleMusicAction(job.data as MusicActionJob);
    });

    // Error handling
    commandQueue.on("failed", (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });

    commandQueue.on("completed", (job) => {
      logger.verbose(`Job ${job.id} completed successfully`);
    });

    logger.info("Bot queue service initialized");
  }

  private async handleSendMessage(job: SendMessageJob): Promise<void> {
    try {
      logger.info(`Processing send message job: ${job.id}`);

      const channel = await this.client.channels.fetch(job.channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${job.channelId} not found or not text-based`);
      }

      await channel.send({
        content: job.content,
        embeds: job.embeds || [],
      });

      logger.info(`Message sent to channel ${job.channelId}`);

      // Publish success event
      await this.publishEvent({
        id: `evt_${Date.now()}`,
        type: "MODERATION_ACTION_COMPLETED",
        timestamp: Date.now(),
        actionType: "SEND_MESSAGE",
        success: true,
        guildId: job.guildId,
        userId: job.userId,
      });
    } catch (error) {
      logger.error(`Failed to send message:`, error);

      // Publish failure event
      await this.publishEvent({
        id: `evt_${Date.now()}`,
        type: "MODERATION_ACTION_FAILED",
        timestamp: Date.now(),
        actionType: "SEND_MESSAGE",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        guildId: job.guildId,
        userId: job.userId,
      });

      throw error;
    }
  }

  private async handleModerationAction(job: ModerationActionJob): Promise<void> {
    logger.info(`Processing moderation action: ${job.type} for user ${job.targetUserId}`);

    try {
      const guild = job.guildId ? await this.client.guilds.fetch(job.guildId) : null;

      if (!guild) {
        throw new Error("Guild not found");
      }

      switch (job.type) {
        case "BAN_USER":
          await guild.members.ban(job.targetUserId, { reason: job.reason });
          break;
        case "KICK_USER":
          const memberToKick = await guild.members.fetch(job.targetUserId);
          await memberToKick.kick(job.reason);
          break;
        case "TIMEOUT_USER":
          const memberToTimeout = await guild.members.fetch(job.targetUserId);
          if (job.duration) {
            await memberToTimeout.timeout(job.duration * 60 * 1000, job.reason); // Convert minutes to ms
          }
          break;
        case "UNBAN_USER":
          await guild.members.unban(job.targetUserId, job.reason);
          break;
      }

      await this.publishEvent({
        id: `evt_${Date.now()}`,
        type: "MODERATION_ACTION_COMPLETED",
        timestamp: Date.now(),
        actionType: job.type,
        success: true,
        guildId: job.guildId,
        userId: job.userId,
      });
    } catch (error) {
      logger.error(`Moderation action failed:`, error);

      await this.publishEvent({
        id: `evt_${Date.now()}`,
        type: "MODERATION_ACTION_FAILED",
        timestamp: Date.now(),
        actionType: job.type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        guildId: job.guildId,
        userId: job.userId,
      });

      throw error;
    }
  }

  private async handleMusicAction(job: MusicActionJob): Promise<void> {
    logger.info(`Processing music action: ${job.type}`);
    // TODO: Implement music actions
    logger.warn("Music action processing not yet implemented");
  }

  private async publishEvent(event: any): Promise<void> {
    try {
      const eventQueue = this.queueManager.getQueue(QUEUE_NAMES.BOT_EVENTS);
      await eventQueue.add("bot-event", event, {
        removeOnComplete: 50,
        removeOnFail: 20,
      });
    } catch (error) {
      logger.error("Failed to publish event:", error);
    }
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down bot queue service...");
    await this.queueManager.closeAll();
    logger.info("Bot queue service shut down");
  }
}
