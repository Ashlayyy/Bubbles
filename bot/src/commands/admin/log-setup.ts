import { ChannelType, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// All log types except bulk operations
const ALL_LOG_TYPES = [
  // Member events
  "MEMBER_JOIN",
  "MEMBER_LEAVE",
  "MEMBER_UPDATE",
  "MEMBER_BAN",
  "MEMBER_UNBAN",

  // Message events (excluding bulk)
  "MESSAGE_DELETE",
  "MESSAGE_UPDATE",
  "REACTION_ADD",
  "REACTION_REMOVE",
  "REACTION_EMOJI_REMOVE",
  // Excluded: MESSAGE_DELETE_BULK, REACTION_REMOVE_ALL

  // Channel events
  "CHANNEL_CREATE",
  "CHANNEL_DELETE",
  "CHANNEL_UPDATE",

  // Role events
  "ROLE_CREATE",
  "ROLE_DELETE",
  "ROLE_UPDATE",

  // Guild events
  "GUILD_UPDATE",
  "BOT_GUILD_JOIN",
  "BOT_GUILD_LEAVE",

  // Emoji/Sticker events
  "EMOJI_CREATE",
  "EMOJI_DELETE",
  "EMOJI_UPDATE",
  "STICKER_CREATE",
  "STICKER_DELETE",

  // Thread events
  "THREAD_CREATE",
  "THREAD_DELETE",
  "THREAD_UPDATE",

  // Invite events
  "INVITE_CREATE",
  "INVITE_DELETE",

  // Scheduled events
  "SCHEDULED_EVENT_CREATE",
  "SCHEDULED_EVENT_UPDATE",

  // User events
  "USER_UPDATE",

  // System events
  "WEBHOOKS_UPDATE",

  // Moderation events
  "MOD_WARN_ISSUED",
  "MOD_KICK_ISSUED",
  "MOD_BAN_ISSUED",
  "MOD_TIMEOUT_ISSUED",
  "MOD_NOTE_ISSUED",
  "MOD_UNBAN_ISSUED",
  "MOD_UNTIMEOUT_ISSUED",
];

export default new Command(
  new SlashCommandBuilder()
    .setName("log-setup")
    .setDescription("Quick setup for comprehensive logging - routes all events to one channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send all logs to")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption((option) =>
      option
        .setName("include_bulk")
        .setDescription("Include bulk operations (bulk message deletes, etc.) - can be spammy")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const channel = interaction.options.getChannel("channel", true);
    const includeBulk = interaction.options.getBoolean("include_bulk") ?? false;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Build log types list
      const logTypes = includeBulk
        ? [...ALL_LOG_TYPES, "MESSAGE_DELETE_BULK", "REACTION_REMOVE_ALL"]
        : [...ALL_LOG_TYPES];

      // Create channel routing object - all log types go to the same channel
      const channelRouting: Record<string, string> = {};
      for (const logType of logTypes) {
        channelRouting[logType] = channel.id;
      }

      // Upsert log settings
      await prisma.logSettings.upsert({
        where: { guildId: interaction.guild.id },
        update: {
          channelRouting,
          enabledLogTypes: logTypes,
          updatedAt: new Date(),
        },
        create: {
          guildId: interaction.guild.id,
          channelRouting,
          enabledLogTypes: logTypes,
          ignoredUsers: [],
          ignoredRoles: [],
          ignoredChannels: [],
        },
      });

      // Also update the guild config to link log settings
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: {
          logSettingsId: interaction.guild.id, // LogSettings uses guildId as ID
        },
        create: {
          guildId: interaction.guild.id,
          logSettingsId: interaction.guild.id,
        },
      });

      const bulkText = includeBulk ? " (including bulk operations)" : " (excluding bulk operations)";

      await interaction.editReply({
        content:
          `✅ **Logging setup complete!**\n\n` +
          `📊 **${logTypes.length} log types** configured to send to <#${channel.id}>${bulkText}\n\n` +
          `**Included Events:**\n` +
          `• Member activities (join, leave, updates, bans)\n` +
          `• Message activities (delete, edit, reactions)\n` +
          `• Server changes (channels, roles, settings)\n` +
          `• Community features (threads, events, invites)\n` +
          `• Content management (emojis, stickers)\n` +
          `• Moderation actions (warns, kicks, bans)\n` +
          `• User profile changes\n\n` +
          `💡 Use \`/settings\` for advanced per-event configuration.`,
      });

      logger.info(
        `Log setup completed for guild ${interaction.guild.id} by ${interaction.user.id} - ${logTypes.length} types to ${channel.id}`
      );
    } catch (error) {
      logger.error("Error setting up logging:", error);

      await interaction.editReply({
        content:
          `❌ **Failed to setup logging**\n\n` +
          `Error: ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `Please try again or contact support if the issue persists.`,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: false,
    },
  }
);
