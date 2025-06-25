import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { EmbedField } from "discord.js";
import getQueue from "../../functions/music/getQueue.js";
import { toDisplayString } from "../../functions/music/queueRepeatMode.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import Command, { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Helper function to check if queue service is available
async function checkQueueService(client: Client, interaction: GuildChatInputCommandInteraction): Promise<boolean> {
  if (!client.queueService) {
    await interaction.editReply({
      content: "❌ Music queue service is not available. Please try again later.",
    });
    return false;
  }
  return true;
}

// Player Control Handlers
async function handlePlay(client: Client, interaction: GuildChatInputCommandInteraction) {
  const query = interaction.options.getString("query", true);

  await interaction.deferReply();

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

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

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🎵 Added to Queue")
      .setDescription(`**${query}**`)
      .addFields(
        { name: "👤 Requested by", value: `<@${interaction.user.id}>`, inline: true },
        { name: "📍 Channel", value: `<#${interaction.channelId}>`, inline: true }
      )
      .setThumbnail("attachment://music.png")
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      files: ["assets/icons/music.png"],
    });
  } catch (error) {
    logger.error("Error playing music:", error);
    await interaction.editReply({
      content: "❌ Failed to play music. Please try again.",
    });
  }
}

async function handlePause(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

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

    await interaction.editReply({
      content: "⏸️ **Music paused**",
    });
  } catch (error) {
    logger.error("Error pausing music:", error);
    await interaction.editReply({
      content: "❌ Failed to pause music. Please try again.",
    });
  }
}

async function handleResume(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

    await client.queueService.processRequest({
      type: "RESUME_MUSIC",
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
      content: "▶️ **Music resumed**",
    });
  } catch (error) {
    logger.error("Error resuming music:", error);
    await interaction.editReply({
      content: "❌ Failed to resume music. Please try again.",
    });
  }
}

async function handleSkip(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

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
      content: "⏭️ **Track skipped**",
    });
  } catch (error) {
    logger.error("Error skipping music:", error);
    await interaction.editReply({
      content: "❌ Failed to skip music. Please try again.",
    });
  }
}

async function handleStop(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

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
      content: "⏹️ **Music stopped and queue cleared**",
    });
  } catch (error) {
    logger.error("Error stopping music:", error);
    await interaction.editReply({
      content: "❌ Failed to stop music. Please try again.",
    });
  }
}

// Queue Management Handlers
async function handleQueue(client: Client, interaction: GuildChatInputCommandInteraction) {
  const guildQueue = await getQueue(interaction);
  if (!guildQueue) return;

  // Check if queue is empty
  if (!guildQueue.currentTrack && guildQueue.tracks.toArray().length === 0) {
    await interaction.reply({
      content: "📭 **No tracks in queue!**\n\nUse `/music player play` to add some music.",
      ephemeral: true,
    });
    return;
  }

  const embedFieldArr: EmbedField[] = [];

  // Add currently playing track
  if (guildQueue.currentTrack) {
    const track = guildQueue.currentTrack;
    embedFieldArr.unshift({
      name: `🎵 Now Playing: ${track.title}`,
      value: `👤 **Artist:** ${track.author}\n🔗 **URL:** ${track.url}\n📝 **Requested by:** ${track.requestedBy ?? "Unknown User"}`,
      inline: false,
    });
  }

  // Add queued tracks
  embedFieldArr.push(
    ...guildQueue.tracks.toArray().map((track, i) => ({
      name: `${i + 1}. ${track.title}`,
      value: `👤 **Artist:** ${track.author}\n🔗 **URL:** ${track.url}\n📝 **Requested by:** ${track.requestedBy ?? "Unknown User"}`,
      inline: false,
    }))
  );

  const controlButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("music_pause").setLabel("Pause").setEmoji("⏸️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_skip").setLabel("Skip").setEmoji("⏭️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("music_stop").setLabel("Stop").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("music_shuffle").setLabel("Shuffle").setEmoji("🔀").setStyle(ButtonStyle.Secondary)
  );

  await client.sendMultiPageEmbed(interaction, embedFieldArr, {
    otherEmbedData: {
      title: `🎵 Music Queue [${toDisplayString(guildQueue.repeatMode)}]`,
      color: 0x3498db,
      thumbnail: { url: "attachment://music.png" },
    },
    otherReplyOptions: {
      files: ["assets/icons/music.png"],
    },
  });
}

async function handleShuffle(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

    await client.queueService.processRequest({
      type: "SHUFFLE_MUSIC",
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
      content: "🔀 **Queue shuffled**",
    });
  } catch (error) {
    logger.error("Error shuffling music:", error);
    await interaction.editReply({
      content: "❌ Failed to shuffle queue. Please try again.",
    });
  }
}

async function handleRepeat(client: Client, interaction: GuildChatInputCommandInteraction) {
  const mode = interaction.options.getInteger("mode", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

    await client.queueService.processRequest({
      type: "SET_REPEAT_MODE",
      data: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        repeatMode: mode,
      },
      source: "rest",
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      requiresRealTime: true,
    });

    const modeNames = ["Off", "Track", "Queue", "Autoplay"];
    await interaction.editReply({
      content: `🔁 **Repeat mode:** ${modeNames[mode]}`,
    });
  } catch (error) {
    logger.error("Error setting repeat mode:", error);
    await interaction.editReply({
      content: "❌ Failed to set repeat mode. Please try again.",
    });
  }
}

// Settings Handlers
async function handleVolumeSet(client: Client, interaction: GuildChatInputCommandInteraction) {
  const volume = interaction.options.getInteger("level", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    if (!client.queueService) {
      await interaction.editReply({
        content: "❌ Music queue service is not available. Please try again later.",
      });
      return;
    }
    if (!interaction.guild) return;

    await client.queueService.processRequest({
      type: "SET_VOLUME",
      data: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        volume: volume,
      },
      source: "rest",
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      requiresRealTime: true,
    });

    await interaction.editReply({
      content: `🔊 **Volume set to:** ${volume}%`,
    });
  } catch (error) {
    logger.error("Error setting volume:", error);
    await interaction.editReply({
      content: "❌ Failed to set volume. Please try again.",
    });
  }
}

async function handleStatus(client: Client, interaction: GuildChatInputCommandInteraction) {
  const guildQueue = await getQueue(interaction);

  if (!guildQueue) {
    await interaction.reply({
      content: "📭 **No active music session**\n\nUse `/music player play` to start playing music.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🎵 Music Player Status")
    .setColor(guildQueue.currentTrack ? 0x2ecc71 : 0x95a5a6)
    .setThumbnail("attachment://music.png")
    .setTimestamp();

  if (guildQueue.currentTrack) {
    const track = guildQueue.currentTrack;
    embed.addFields(
      { name: "🎵 Now Playing", value: `**${track.title}** by ${track.author}`, inline: false },
      { name: "📝 Requested by", value: `<@${track.requestedBy}>`, inline: true },
      { name: "⏱️ Status", value: guildQueue.node.isPaused() ? "⏸️ Paused" : "▶️ Playing", inline: true },
      { name: "🔁 Repeat Mode", value: toDisplayString(guildQueue.repeatMode), inline: true },
      { name: "📊 Queue Length", value: `${guildQueue.tracks.toArray().length} tracks`, inline: true },
      { name: "🔊 Volume", value: `${guildQueue.node.volume}%`, inline: true }
    );
  } else {
    embed.setDescription("No track currently playing");
  }

  await interaction.reply({
    embeds: [embed],
    files: ["assets/icons/music.png"],
    ephemeral: true,
  });
}

// Main command builder
export default new Command(
  (() => {
    const builder = new SlashCommandBuilder()
      .setName("music")
      .setDescription("🎵 Music player and queue management")

      // Player Control Group
      .addSubcommandGroup((group) =>
        group
          .setName("player")
          .setDescription("Control music playback")
          .addSubcommand((sub) =>
            sub
              .setName("play")
              .setDescription("Play a song or add to queue")
              .addStringOption((opt) =>
                opt
                  .setName("query")
                  .setDescription("Song name, URL, or search query")
                  .setRequired(true)
                  .setAutocomplete(true)
              )
          )
          .addSubcommand((sub) => sub.setName("pause").setDescription("Pause the current track"))
          .addSubcommand((sub) => sub.setName("resume").setDescription("Resume the paused track"))
          .addSubcommand((sub) => sub.setName("skip").setDescription("Skip the current track"))
          .addSubcommand((sub) => sub.setName("stop").setDescription("Stop music and clear the queue"))
          .addSubcommand((sub) => sub.setName("status").setDescription("Show current player status"))
      )

      // Queue Management Group
      .addSubcommandGroup((group) =>
        group
          .setName("queue")
          .setDescription("Manage the music queue")
          .addSubcommand((sub) => sub.setName("show").setDescription("Display the current queue with controls"))
          .addSubcommand((sub) => sub.setName("shuffle").setDescription("Shuffle the queue"))
          .addSubcommand((sub) =>
            sub
              .setName("repeat")
              .setDescription("Set repeat mode")
              .addIntegerOption((opt) =>
                opt
                  .setName("mode")
                  .setDescription("Repeat mode")
                  .setRequired(true)
                  .addChoices(
                    { name: "Off", value: 0 },
                    { name: "Track", value: 1 },
                    { name: "Queue", value: 2 },
                    { name: "Autoplay", value: 3 }
                  )
              )
          )
          .addSubcommand((sub) => sub.setName("clear").setDescription("Clear the entire queue"))
      )

      // Settings Group
      .addSubcommandGroup((group) =>
        group
          .setName("settings")
          .setDescription("Configure music player settings")
          .addSubcommand((sub) =>
            sub
              .setName("volume")
              .setDescription("Set player volume")
              .addIntegerOption((opt) =>
                opt
                  .setName("level")
                  .setDescription("Volume level (0-100)")
                  .setRequired(true)
                  .setMinValue(0)
                  .setMaxValue(100)
              )
          )
      );

    return builder;
  })(),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommandGroup) {
        case "player":
          switch (subcommand) {
            case "play":
              await handlePlay(client, interaction);
              break;
            case "pause":
              await handlePause(client, interaction);
              break;
            case "resume":
              await handleResume(client, interaction);
              break;
            case "skip":
              await handleSkip(client, interaction);
              break;
            case "stop":
              await handleStop(client, interaction);
              break;
            case "status":
              await handleStatus(client, interaction);
              break;
          }
          break;

        case "queue":
          switch (subcommand) {
            case "show":
              await handleQueue(client, interaction);
              break;
            case "shuffle":
              await handleShuffle(client, interaction);
              break;
            case "repeat":
              await handleRepeat(client, interaction);
              break;
            case "clear":
              await handleStop(client, interaction); // Clear is same as stop
              break;
          }
          break;

        case "settings":
          switch (subcommand) {
            case "volume":
              await handleVolumeSet(client, interaction);
              break;
          }
          break;
      }
    } catch (error) {
      logger.error("Error in music command:", error);
      const errorMessage = "❌ An unexpected error occurred. Please try again.";

      if (interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);
