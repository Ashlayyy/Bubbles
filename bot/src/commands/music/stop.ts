import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("stop").setDescription("ADMIN ONLY: Stop music and clear the queue."),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Use unified queue system for stop action
      if (client.queueService) {
        await client.queueService.processRequest({
          type: "STOP_MUSIC",
          data: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresRealTime: true,
        });

        await interaction.editReply({
          content: "⏹️ Music has been stopped and queue cleared!",
        });
      } else {
        // Fallback: inform user that queue service is not available
        await interaction.editReply({
          content: "❌ Music queue service is not available. Please try again later.",
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to stop music. Please try again.",
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
