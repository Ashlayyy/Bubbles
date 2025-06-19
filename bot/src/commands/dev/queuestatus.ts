import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("queue-status").setDescription("[DEV] Check the status of the queue system"),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Access the unified queue service from the client
      const queueService = client.queueService;

      if (!queueService) {
        const embed = new EmbedBuilder()
          .setTitle("🔧 Queue System Status")
          .setColor("Red")
          .setDescription("❌ **Queue service not initialized**\nThe unified queue service is not available.")
          .addFields({
            name: "Status",
            value: "❌ Not Running",
            inline: true,
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check if the queue service is ready
      const isReady = queueService.isReady();

      // Get system health
      const health = await queueService.getHealth();

      // Get metrics
      const metrics = queueService.getMetrics();

      const embed = new EmbedBuilder()
        .setTitle("🔧 Unified Queue System Status")
        .setColor(isReady ? "Green" : "Orange")
        .addFields(
          {
            name: "Queue Service",
            value: isReady ? "✅ Ready" : "❌ Not Ready",
            inline: true,
          },
          {
            name: "WebSocket Protocol",
            value: health.protocols.websocket.healthy ? "✅ Healthy" : "❌ Unhealthy",
            inline: true,
          },
          {
            name: "Queue Protocol",
            value: health.protocols.queue.healthy ? "✅ Healthy" : "❌ Unhealthy",
            inline: true,
          },
          {
            name: "System Metrics",
            value: [
              `**REST Requests:** ${metrics.restRequests}`,
              `**WebSocket Messages:** ${metrics.websocketMessages}`,
              `**Queue Jobs:** ${metrics.queueJobs}`,
              `**Duplicate Operations:** ${metrics.duplicateOperations}`,
              `**Protocol Failures:** ${metrics.totalProtocolFailures}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "Cross-Protocol Performance",
            value: [
              `**REST→WebSocket Delay:** ${metrics.restToWebSocketDelay.toFixed(2)}ms`,
              `**Queue→WebSocket Delay:** ${metrics.queueToWebSocketDelay.toFixed(2)}ms`,
              `**WebSocket Fallbacks:** ${metrics.websocketFallbackToQueue}`,
              `**Queue Fallbacks:** ${metrics.queueFallbackToWebSocket}`,
            ].join("\n"),
            inline: false,
          }
        )
        .setFooter({ text: "Unified system handles cross-protocol request routing" })
        .setTimestamp();

      if (!isReady) {
        embed.setDescription(
          "⚠️ **Queue system not ready**\n" + "The unified processor may still be initializing or experiencing issues."
        );
      } else {
        embed.setDescription("✅ Unified queue system is operating normally with multi-protocol support.");
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Error checking queue status: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.DEVELOPER,
    },
  }
);
