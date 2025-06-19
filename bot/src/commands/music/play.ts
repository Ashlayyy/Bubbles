import { SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("🎵 Play music")
    .addStringOption((option) =>
      option.setName("query").setDescription("🎵 What to play").setRequired(true).setAutocomplete(true)
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const query = interaction.options.getString("query");
    if (!query) return;

    await interaction.deferReply();

    try {
      // Use unified queue system for play action
      if (client.queueService) {
        await client.queueService.processRequest({
          type: "PLAY_MUSIC",
          data: {
            query,
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            channelId: interaction.channelId,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresRealTime: true,
        });

        await interaction.editReply({
          content: `🎵 Added **${query}** to the queue!`,
        });
      } else {
        // Fallback: inform user that queue service is not available
        await interaction.editReply({
          content: "❌ Music queue service is not available. Please try again later.",
        });
      }
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to play music. Please try again.",
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
