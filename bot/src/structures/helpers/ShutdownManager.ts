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
        await this.client.queueService.shutdown();
      }

      // Stop scheduled action service
      if (this.client.scheduledActionService) {
        logger.info("Stopping scheduled action service...");
        this.client.scheduledActionService.stop();
      }

      // Destroy Discord client
      logger.info("Destroying Discord client...");
      void this.client.destroy();

      logger.info("Bot shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown:", error);
      throw error;
    }
  }
}
