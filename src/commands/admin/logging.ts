import { ChannelType, SlashCommandBuilder } from "discord.js";

import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Configure comprehensive server logging")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Quick setup with common log channels")
        .addChannelOption((opt) =>
          opt
            .setName("moderation")
            .setDescription("Channel for moderation logs (bans, kicks, warns)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("members")
            .setDescription("Channel for member activity (joins, leaves, role changes)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("messages")
            .setDescription("Channel for message logs (edits, deletes)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("voice")
            .setDescription("Channel for voice activity logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("server")
            .setDescription("Channel for server changes (channels, roles, settings)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("View current logging configuration"))
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable all log types"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable all logging"))
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set specific log type to a channel")
        .addStringOption((opt) =>
          opt.setName("logtype").setDescription("The log type to configure").setRequired(true).setAutocomplete(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The channel to send logs to")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "setup": {
          const channels = {
            moderation: interaction.options.getChannel("moderation"),
            members: interaction.options.getChannel("members"),
            messages: interaction.options.getChannel("messages"),
            voice: interaction.options.getChannel("voice"),
            server: interaction.options.getChannel("server"),
          };

          // Build channel routing
          const channelRouting: Record<string, string> = {};

          if (channels.moderation) {
            // Route all moderation logs to moderation channel
            const modTypes = ["MOD_CASE_CREATE", "MOD_WARN_ISSUED", "MEMBER_BAN", "MEMBER_KICK", "MEMBER_TIMEOUT"];
            modTypes.forEach((type) => (channelRouting[type] = channels.moderation?.id || ""));
          }

          if (channels.members) {
            // Route member activity to members channel
            const memberTypes = [
              "MEMBER_JOIN",
              "MEMBER_LEAVE",
              "MEMBER_ROLE_ADD",
              "MEMBER_ROLE_REMOVE",
              "MEMBER_NICKNAME_CHANGE",
            ];
            memberTypes.forEach((type) => (channelRouting[type] = channels.members!.id));
          }

          if (channels.messages) {
            // Route message logs to messages channel
            const messageTypes = ["MESSAGE_DELETE", "MESSAGE_EDIT", "MESSAGE_BULK_DELETE"];
            messageTypes.forEach((type) => (channelRouting[type] = channels.messages!.id));
          }

          if (channels.voice) {
            // Route voice logs to voice channel
            const voiceTypes = ["VOICE_JOIN", "VOICE_LEAVE", "VOICE_MOVE"];
            voiceTypes.forEach((type) => (channelRouting[type] = channels.voice!.id));
          }

          if (channels.server) {
            // Route server logs to server channel
            const serverTypes = ["CHANNEL_CREATE", "CHANNEL_DELETE", "ROLE_CREATE", "ROLE_DELETE", "SERVER_UPDATE"];
            serverTypes.forEach((type) => (channelRouting[type] = channels.server!.id));
          }

          // Setup logging with the LogManager
          await client.logManager.setupBasicLogging(interaction.guild.id, channelRouting);

          const setupSummary = Object.entries(channels)
            .filter(([_, channel]) => channel)
            .map(([type, channel]) => `• **${type}**: ${channel}`)
            .join("\n");

          await interaction.followUp({
            content: `✅ **Logging Setup Complete!**\n\n${setupSummary}\n\n🔍 **${Object.keys(channelRouting).length}** log types configured automatically.\n\n💡 *Use \`/logging status\` to see all active log types.*`,
          });
          break;
        }

        case "status": {
          // Show current configuration
          await interaction.followUp({
            content: `📊 **Logging Status**\n\n🚧 *Status view coming soon...*\n\nFor now, check your log channels to see if logs are appearing!`,
          });
          break;
        }

        case "enable": {
          // Enable all log types
          await client.logManager.enableAllLogTypes(interaction.guild.id);
          await interaction.followUp({
            content: `✅ **All log types enabled!**\n\n📝 **100+** different events will now be logged to their configured channels.\n\n💡 *Use \`/logging setup\` to configure channels if you haven't already.*`,
          });
          break;
        }

        case "disable": {
          // Disable all logging
          await client.logManager.disableAllLogTypes(interaction.guild.id);
          await interaction.followUp({
            content: `❌ **All logging disabled.**\n\n⚠️ No events will be logged until you re-enable them with \`/logging enable\`.`,
          });
          break;
        }

        case "channel": {
          const logType = interaction.options.getString("logtype", true);
          const channel = interaction.options.getChannel("channel", true);

          await client.logManager.setChannelRouting(interaction.guild.id, {
            [logType]: channel.id,
          });

          await interaction.followUp({
            content: `✅ **${logType}** logs will now be sent to ${channel}`,
          });
          break;
        }

        default: {
          await interaction.followUp({
            content: "❌ Unknown subcommand",
          });
        }
      }
    } catch (error) {
      await interaction.followUp({
        content: `❌ Error configuring logging: ${error instanceof Error ? error.message : "Unknown error"}`,
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
