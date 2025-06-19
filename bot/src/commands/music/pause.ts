import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder().setName("pause").setDescription("ADMIN ONLY: Pause music."),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Show loading message
      await interaction.editReply({
        content: "⏸️ Pausing music...",
      });

      // Use unified queue system for pause action
      if (client.queueService) {
        await client.queueService.processRequest({
          type: "PAUSE_MUSIC",
          data: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresRealTime: true,
        });
      } else {
        // Fallback: direct music player access
        const { useQueue } = await import("discord-player");
        const queue = useQueue(interaction.guild.id);
        if (queue?.isPlaying()) {
          queue.node.pause();
        }
      }

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
