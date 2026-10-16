import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { DevCommand } from "../_core/specialized/DevCommand.js";

class RedisTestCommand extends DevCommand {
  constructor() {
    const config: CommandConfig = {
      name: "redis-test",
      description: "Test Redis connectivity and BullMQ connections",
      category: "dev",
      guildOnly: false,
      ephemeral: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    this.validateDevPermissions();

    const embed = new EmbedBuilder().setTitle("🔧 Redis Connection Test").setColor("Blue").setTimestamp();

    try {
      // Test basic Redis connectivity
      const { RedisConnectionFactory } = await import("@shared/utils/RedisConnectionFactory");
      const redis = RedisConnectionFactory.getSharedConnection();

      const startTime = Date.now();
      await redis.ping();
      const latency = Date.now() - startTime;

      embed.addFields({
        name: "✅ Basic Redis Connection",
        value: `Connected successfully\nLatency: ${latency}ms`,
        inline: true,
      });

      // Don't disconnect the shared connection as it's used by other services

      // Test BullMQ connections
      const { bullMQRegistry } = await import("@shared/queue");
      const bullMQStatus = bullMQRegistry.getConnectionStatus();
      const isAvailable = bullMQRegistry.isAvailable();

      embed.addFields({
        name: "🔧 BullMQ Status",
        value: isAvailable ? "✅ Available" : "❌ Not Available",
        inline: true,
      });

      embed.addFields({
        name: "📊 Connection Details",
        value: [
          `Main: ${bullMQStatus.mainConnectionStatus}`,
          `Events: ${bullMQStatus.eventsConnectionStatus}`,
          `Initialized: ${bullMQStatus.initialized}`,
          `Available: ${bullMQStatus.isAvailable}`,
        ].join("\n"),
        inline: false,
      });

      // Test queue service if available
      if (this.client.queueService) {
        const queueStatus = this.client.queueService.getConnectionStatus();
        embed.addFields({
          name: "🚀 Queue Service",
          value: this.client.queueService.isReady() ? "✅ Ready" : "❌ Not Ready",
          inline: true,
        });
      }

      if (isAvailable) {
        embed.setColor("Green");
        embed.setDescription("✅ All Redis connections are working properly!");
      } else {
        embed.setColor("Orange");
        embed.setDescription("⚠️ BullMQ connections are not ready. Check the connection details above.");
      }
    } catch (error) {
      logger.error("Redis test failed:", error);
      embed.setColor("Red");
      embed.setDescription("❌ Redis connection test failed");
      embed.addFields({
        name: "Error",
        value: error instanceof Error ? error.message : "Unknown error",
        inline: false,
      });
    }

    return { embeds: [embed], ephemeral: true };
  }
}

export default new RedisTestCommand();

export const builder = new SlashCommandBuilder()
  .setName("redis-test")
  .setDescription("Test Redis connectivity and BullMQ connections");
