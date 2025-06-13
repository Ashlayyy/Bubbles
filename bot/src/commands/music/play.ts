import { useMainPlayer } from "discord-player";
import { GuildMember, SlashCommandBuilder } from "discord.js";

import { getGuildConfig } from "../../database/GuildConfig.js";
import getQueue from "../../functions/music/getQueue.js";
import { isQueueRepeatMode } from "../../functions/music/queueRepeatMode.js";
import logger from "../../logger.js";
import queueService from "../../services/queueService";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import QueueMetadata from "../../structures/QueueMetadata.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("ADMIN ONLY: Play/search music.")
    .addStringOption((option) =>
      option.setName("query").setDescription("Song title or YouTube link.").setRequired(true)
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (!(interaction.member instanceof GuildMember))
      throw new TypeError("Expected `interaction.member` to be of type `GuildMember`");

    await interaction.deferReply({ ephemeral: true });

    // Check if user is currently in a voice channel
    if (!interaction.member.voice.channel) {
      await interaction.editReply({
        content: "Join a voice channel first!",
      });
      return;
    }

    const query = interaction.options.getString("query", true);

    try {
      // For play commands, we'll handle it immediately for better user experience
      // but we could also queue it for consistency
      const player = useMainPlayer();
      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
      });

      if (searchResult.isEmpty()) {
        await interaction.editReply({
          content: "Could not get a definitive link from your query! Try adding more details.",
        });
        return;
      }

      const guildQueue = await getQueue(interaction, true);
      if (!guildQueue) {
        logger.info("Player is creating a new GuildQueue");

        const { queue } = await player.play(interaction.member.voice.channel, searchResult, {
          nodeOptions: {
            metadata: new QueueMetadata(client, interaction),
            selfDeaf: true,
          },
          requestedBy: interaction.user,
        });

        const { defaultRepeatMode } = await getGuildConfig(interaction.guildId);
        if (!isQueueRepeatMode(defaultRepeatMode)) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new TypeError(`Invalid default QueueRepeatMode value in database: "${defaultRepeatMode}"`);
        }

        if (queue.repeatMode !== defaultRepeatMode) queue.setRepeatMode(defaultRepeatMode);

        // Log the action through queue system for tracking
        await queueService.addMusicAction({
          type: "PLAY_MUSIC",
          query,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });
      } else {
        logger.info("Player is using pre-existing GuildQueue");

        await player.play(interaction.member.voice.channel, searchResult, {
          requestedBy: interaction.user,
        });

        // Log the action through queue system for tracking
        await queueService.addMusicAction({
          type: "PLAY_MUSIC",
          query,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });
      }
    } catch (error) {
      logger.error("Error in play command:", error);
      await interaction.editReply({
        content: "❌ Failed to play music. Please try again.",
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
