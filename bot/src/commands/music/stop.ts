import { SlashCommandBuilder } from "discord.js";

import queueService from "../../services/QueueService.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("stop").setDescription("ADMIN ONLY: Stops playing music."),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Show loading message
      await interaction.editReply({
        content: "⏹️ Stopping music...",
      });

      // Use queue system for stop action
      await queueService.addMusicAction({
        type: "STOP_MUSIC",
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });

      await interaction.editReply({
        content: "⏹️ Music has been stopped!",
      });
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
