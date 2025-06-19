import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("skip").setDescription("ADMIN ONLY: Skip music."),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Use unified queue system for skip action
      if (client.queueService) {
        await client.queueService.processRequest({
          type: "SKIP_MUSIC",
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
          content: "⏭️ Music has been skipped!",
        });
      } else {
        // Fallback: inform user that queue service is not available
        await interaction.editReply({
          content: "❌ Music queue service is not available. Please try again later.",
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to skip music. Please try again.",
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
