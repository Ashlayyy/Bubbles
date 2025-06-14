import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import queueService from "../../services/queueService.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("queue-status").setDescription("[DEV] Check the status of the queue system"),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Check Redis connection
      const isRedisAvailable = await queueService.isRedisAvailable();

      // Get queue stats
      const stats = await queueService.getQueueStats();

      // Check if processors are running (if we can access them)
      let processorStatus = "Unknown";
      try {
        const { QueueProcessor } = await import("../../queue/processor.js");
        // We can't get the actual instance easily, so just check if Redis is working
        processorStatus = isRedisAvailable ? "Running" : "Fallback Mode";
      } catch (error) {
        processorStatus = "Error loading processor";
      }

      const embed = new EmbedBuilder()
        .setTitle("🔧 Queue System Status")
        .setColor(isRedisAvailable ? "Green" : "Orange")
        .addFields(
          {
            name: "Redis Connection",
            value: isRedisAvailable ? "✅ Connected" : "❌ Disconnected",
            inline: true,
          },
          {
            name: "Queue Processor",
            value: processorStatus,
            inline: true,
          },
          {
            name: "Fallback Mode",
            value: isRedisAvailable ? "❌ Disabled" : "✅ Active",
            inline: true,
          },
          {
            name: "Queue Statistics",
            value: [
              `**Waiting:** ${Array.isArray(stats.waiting) ? stats.waiting.length : stats.waiting}`,
              `**Active:** ${Array.isArray(stats.active) ? stats.active.length : stats.active}`,
              `**Completed:** ${Array.isArray(stats.completed) ? stats.completed.length : stats.completed}`,
              `**Failed:** ${Array.isArray(stats.failed) ? stats.failed.length : stats.failed}`,
              `**Delayed:** ${Array.isArray(stats.delayed) ? stats.delayed.length : stats.delayed}`,
            ].join("\n"),
            inline: false,
          }
        )
        .setFooter({ text: "Queue system handles moderation, music, and config actions" })
        .setTimestamp();

      if (!isRedisAvailable) {
        embed.setDescription(
          "⚠️ **Redis is not connected**\n" +
            "Queue system is operating in fallback mode. Actions will be executed directly instead of being queued."
        );
      } else {
        embed.setDescription("✅ Queue system is operating normally with Redis backend.");
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
