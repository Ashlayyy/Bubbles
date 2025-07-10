import { RedisConnectionFactory } from "@shared/utils/RedisConnectionFactory";
import logger from "../../logger.js";
import type Client from "../Client.js";

export class ShutdownManager {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async shutdown(): Promise<void> {
    logger.info("*** DISCORD.JS BOT: SHUTDOWN ***");

    try {
      // Close WebSocket service
      if (this.client.wsService) {
        logger.info("Closing WebSocket service...");
        this.client.wsService.disconnect();
      }

      // Stop queue service
      if (this.client.queueService) {
        logger.info("Stopping queue service...");
        this.client.queueService.shutdown();
      }

      // Stop scheduled action service
      if (this.client.scheduledActionService) {
        logger.info("Stopping scheduled action service...");
        this.client.scheduledActionService.stop();
      }

      // Close shared Redis connection
      logger.info("Closing shared Redis connection...");
      await RedisConnectionFactory.closeSharedConnection();

      // Destroy Discord client
      logger.info("Destroying Discord client...");
      await this.client.destroy();

      logger.info("Bot shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown:", error);
      throw error;
    }
  }
}
