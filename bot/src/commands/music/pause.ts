import { SlashCommandBuilder } from "discord.js";

import queueService from "../../services/queueService.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("pause").setDescription("ADMIN ONLY: Pause music."),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Show loading message
      await interaction.editReply({
        content: "⏸️ Pausing music...",
      });

      // Use queue system for pause action
      await queueService.addMusicAction({
        type: "PAUSE_MUSIC",
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: "⏸️ Music has been paused!",
      });
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to pause music. Please try again.",
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
