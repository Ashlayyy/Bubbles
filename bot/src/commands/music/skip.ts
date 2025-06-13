import { SlashCommandBuilder } from "discord.js";

import queueService from "../../services/queueService.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("skip").setDescription("ADMIN ONLY: Skip the current track."),
  async (_client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Show loading message
      await interaction.editReply({
        content: "⏭️ Skipping track...",
      });

      // Use queue system for skip action
      await queueService.addMusicAction({
        type: "SKIP_MUSIC",
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: "⏭️ Track has been skipped!",
      });
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to skip track. Please try again.",
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
