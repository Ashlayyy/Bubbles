import { QueueRepeatMode } from "discord-player";
import type { EmbedField } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import lodash from "lodash";

import {
  deleteGuildConfig,
  getGuildConfig,
  defaults as guildConfigDefaults,
  descriptions as guildConfigDescriptions,
  setGoodbyeChannel,
  setWelcomeChannel,
  updateGuildConfig,
} from "../../database/GuildConfig.js";
import { isQueueRepeatMode, toDisplayString } from "../../functions/music/queueRepeatMode.js";
import type Client from "../../structures/Client.js";
import type { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import Command from "../../structures/Command.js";
import { ALL_LOG_TYPES, LOG_CATEGORIES } from "../../structures/LogManager.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { kebabCase, camelCase } = lodash;

/** Omit `greetings` from `GuildConfig` */
const guildConfigSettings = Object.keys(guildConfigDefaults).filter((setting) => setting !== "greetings");

// High-volume events ⇒ single source of truth
const HIGH_VOLUME_EVENTS = [...LOG_CATEGORIES.HIGH_VOLUME];

// Base slash command builder
const builder = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Manage server-specific bot settings.")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-welcome-channel")
      .setDescription("Sets the channel where welcome messages are sent.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to send welcome messages to.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-goodbye-channel")
      .setDescription("Sets the channel where goodbye messages are sent.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to send goodbye messages to.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("display").setDescription("Show current settings for this guild/server.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-reaction-role-log-channel")
      .setDescription("Set the channel where reaction role activities will be logged.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to send reaction role logs to.")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable-reaction-role-logging").setDescription("Disable reaction role logging to channel.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("toggle-reaction-role-db-logging")
      .setDescription("Enable or disable database logging of reaction role activities.")
      .addBooleanOption((option) =>
        option.setName("enabled").setDescription("Enable or disable database logging.").setRequired(true)
      )
  )
  // New comprehensive logging commands
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup-logging")
      .setDescription("Quick setup for comprehensive server logging.")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Choose your logging setup type")
          .setRequired(true)
          .addChoices(
            { name: "Single Channel (All logs in one place)", value: "single" },
            { name: "Four Channels (Organized by category)", value: "four" },
            { name: "Custom (Manual configuration)", value: "custom" }
          )
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Primary logging channel (for single-channel setup)")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-moderation-log-channel")
      .setDescription("Set channel for moderation logs (bans, kicks, warns, timeouts).")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for moderation logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-member-log-channel")
      .setDescription("Set channel for member activity (joins, leaves, role changes).")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for member logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-message-log-channel")
      .setDescription("Set channel for message logs (edits, deletes, reactions).")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for message logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-server-log-channel")
      .setDescription("Set channel for server changes (channels, roles, settings).")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for server logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-voice-log-channel")
      .setDescription("Set channel for voice activity logs.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for voice logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("high-volume-events")
      .setDescription("Configure high-volume events (presence, typing, etc.).")
      .addStringOption((option) =>
        option
          .setName("action")
          .setDescription("What to do with high-volume events")
          .setRequired(true)
          .addChoices(
            { name: "Enable All", value: "enable" },
            { name: "Disable All", value: "disable" },
            { name: "View Status", value: "status" }
          )
      )
      .addChannelOption((option) =>
        option
          .setName("separate-channel")
          .setDescription("Route high-volume events to a separate channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("enable-all-logging").setDescription("Enable all log types for comprehensive logging.")
  )
  .addSubcommand((subcommand) => subcommand.setName("disable-all-logging").setDescription("Disable all logging."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("log-category")
      .setDescription("Enable/disable an entire category of logs.")
      .addStringOption((option) =>
        option
          .setName("category")
          .setDescription("Log category to configure")
          .setRequired(true)
          .addChoices(
            { name: "Messages", value: "MESSAGE" },
            { name: "Members", value: "MEMBER" },
            { name: "Roles", value: "ROLE" },
            { name: "Channels", value: "CHANNEL" },
            { name: "Voice", value: "VOICE" },
            { name: "Server", value: "SERVER" },
            { name: "Moderation", value: "MODERATION" },
            { name: "Invites", value: "INVITE" },
            { name: "Emojis/Stickers", value: "EMOJI" }
          )
      )
      .addBooleanOption((option) =>
        option.setName("enabled").setDescription("Enable or disable this category").setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("audit-logs")
      .setDescription("Configure Discord audit log integration.")
      .addBooleanOption((option) =>
        option.setName("enabled").setDescription("Enable or disable audit log integration").setRequired(true)
      )
  );

// Add settings
builder
  // maxMessagesCleared
  .addSubcommand((option) =>
    option
      .setName(kebabCase(guildConfigSettings[0]))
      .setDescription("ADMIN ONLY: " + guildConfigDescriptions[guildConfigSettings[0]])
      .addIntegerOption((subOption) =>
        subOption
          .setName("new-value")
          .setDescription("Enter a new value.")
          .setMinValue(2)
          .setMaxValue(100)
          .setRequired(true)
      )
  )
  // musicChannelId
  .addSubcommandGroup((groupOption) =>
    groupOption
      .setName(kebabCase(guildConfigSettings[1]))
      .setDescription(guildConfigDescriptions[guildConfigSettings[1]])
      .addSubcommand((option) =>
        option
          .setName("overwrite")
          .setDescription("ADMIN ONLY: " + "Overwrite current value with a new one.")
          .addChannelOption((subOption) =>
            subOption.setName("new-value").setDescription("Enter a new value.").addChannelTypes(0).setRequired(true)
          )
      )
      .addSubcommand((option) =>
        option.setName("disable").setDescription("ADMIN ONLY: " + "Disable this setting (set to an empty value).")
      )
  )
  // defaultRepeatMode
  .addSubcommand((option) =>
    option
      .setName(kebabCase(guildConfigSettings[2]))
      .setDescription("ADMIN ONLY: " + guildConfigDescriptions[guildConfigSettings[2]])
      .addIntegerOption((subOption) =>
        subOption
          .setName("new-value")
          .setDescription("Enter a new value.")
          .setRequired(true)
          .addChoices(
            { name: "OFF", value: QueueRepeatMode.OFF },
            { name: "TRACK", value: QueueRepeatMode.TRACK },
            { name: "QUEUE", value: QueueRepeatMode.QUEUE },
            { name: "AUTOPLAY", value: QueueRepeatMode.AUTOPLAY }
          )
      )
  );

export default new Command(
  builder,
  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "set-welcome-channel":
        await handleSetWelcomeChannel(interaction);
        break;
      case "set-goodbye-channel":
        await handleSetGoodbyeChannel(interaction);
        break;
      case "set-reaction-role-log-channel":
        await handleSetReactionRoleLogChannel(interaction);
        break;
      case "disable-reaction-role-logging":
        await handleDisableReactionRoleLogging(interaction);
        break;
      case "toggle-reaction-role-db-logging":
        await handleToggleReactionRoleDbLogging(interaction);
        break;
      case "display":
        await displayCurrentSettings(client, interaction);
        break;

      // New logging configuration handlers
      case "setup-logging":
        await handleSetupLogging(client, interaction);
        break;
      case "set-moderation-log-channel":
        await handleSetModerationLogChannel(client, interaction);
        break;
      case "set-member-log-channel":
        await handleSetMemberLogChannel(client, interaction);
        break;
      case "set-message-log-channel":
        await handleSetMessageLogChannel(client, interaction);
        break;
      case "set-server-log-channel":
        await handleSetServerLogChannel(client, interaction);
        break;
      case "set-voice-log-channel":
        await handleSetVoiceLogChannel(client, interaction);
        break;
      case "high-volume-events":
        await handleHighVolumeEvents(client, interaction);
        break;
      case "enable-all-logging":
        await handleEnableAllLogging(client, interaction);
        break;
      case "disable-all-logging":
        await handleDisableAllLogging(client, interaction);
        break;
      case "log-category":
        await handleLogCategory(client, interaction);
        break;
      case "audit-logs":
        await handleAuditLogs(client, interaction);
        break;

      default: {
        // First, check if subcommand is a guild setting
        const settingName = camelCase(subcommand);
        if (guildConfigSettings.includes(settingName)) {
          await changeSetting(interaction, {
            name: settingName,
            value: interaction.options.get("new-value")?.value ?? "",
          });
          return;
        }

        // Second, check if subcommand is in a subcommand group
        const subCommandGroupQuery = interaction.options.getSubcommandGroup(false);
        switch (subCommandGroupQuery) {
          case "music-channel-id": {
            const name = camelCase(subCommandGroupQuery);
            switch (subcommand) {
              case "overwrite": {
                await changeSetting(interaction, {
                  name,
                  value: interaction.options.getChannel("new-value", true).id,
                });
                break;
              }

              case "disable": {
                await changeSetting(interaction, {
                  name,
                  value: "",
                });
                break;
              }
            }
            return;
          }
        }

        // Lastly, check for reset
        if (subcommand === "reset") {
          await resetSettings(interaction);
          return;
        }

        await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
      }
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
    },
  }
);

interface SettingData {
  /** Name of setting in camel-case */
  name: string;
  value: number | string | boolean | null;
}

interface SettingDisplay {
  /** Name of setting in kebab-case */
  name: string;
  /** Value represented as a string */
  value: string;
}

async function displayCurrentSettings(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  const currentGuildConfig = await getGuildConfig(interaction.guildId);

  const settingsFieldArr: EmbedField[] = guildConfigSettings.map((setting) => {
    let currentValue: number | string | boolean | null;
    const value = currentGuildConfig[setting as keyof typeof guildConfigDefaults];

    if (Array.isArray(value)) {
      const array = value;
      currentValue = "[ ";

      for (let i = 0; i < array.length; i++) {
        currentValue = currentValue + array[i];
        if (i !== array.length - 1) {
          currentValue = currentValue + ", ";
        }
      }

      currentValue = currentValue + " ]";
    } else {
      currentValue = value;
    }

    const settingData: SettingData = {
      name: setting,
      value: currentValue,
    };

    const settingDisplay: SettingDisplay = {
      name: kebabCase(settingData.name),
      value: getSettingDisplayValue(settingData),
    };

    // Ensure we have valid strings for field name and value
    const fieldName = `${settingDisplay.name}: \`${settingDisplay.value}\``;
    const fieldValue = guildConfigDescriptions[settingData.name] || "No description available";

    return {
      name: fieldName,
      value: fieldValue,
      inline: false,
    };
  });

  // Pagination settings
  const itemsPerPage = 10;
  const totalPages = Math.ceil(settingsFieldArr.length / itemsPerPage);
  let currentPage = 0;

  const generateEmbed = (page: number) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageFields = settingsFieldArr.slice(start, end);

    return client.genEmbed({
      title: `${interaction.guild?.name ?? "NO NAME"} [id: \`${interaction.guildId}\`] Server-wide Settings`,
      description: `Page ${page + 1} of ${totalPages} • ${settingsFieldArr.length} total settings`,
      fields: pageFields,
      thumbnail: {
        url: "attachment://settings.png",
      },
      footer: {
        text: `Showing ${start + 1}-${Math.min(end, settingsFieldArr.length)} of ${settingsFieldArr.length} settings`,
      },
    });
  };

  const generateButtons = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Previous button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("settings_prev")
        .setLabel("◀ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0)
    );

    // Page indicator
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("settings_page")
        .setLabel(`${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    // Next button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("settings_next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );

    return row;
  };

  // Send initial message
  const embed = generateEmbed(currentPage);
  const components = totalPages > 1 ? [generateButtons(currentPage)] : [];

  const message = await interaction.followUp({
    embeds: [embed],
    components,
    files: ["assets/icons/settings.png"],
  });

  // If only one page, no need for interaction handling
  if (totalPages <= 1) return;

  // Handle button interactions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", (buttonInteraction) => {
    void (async () => {
      try {
        if (buttonInteraction.customId === "settings_prev" && currentPage > 0) {
          currentPage--;
        } else if (buttonInteraction.customId === "settings_next" && currentPage < totalPages - 1) {
          currentPage++;
        }

        const newEmbed = generateEmbed(currentPage);
        const newComponents = [generateButtons(currentPage)];

        await buttonInteraction.update({
          embeds: [newEmbed],
          components: newComponents,
        });
      } catch (error) {
        // Handle error silently
      }
    })();
  });

  collector.on("end", () => {
    void (async () => {
      try {
        // Disable all buttons when collector expires
        const disabledRow = new ActionRowBuilder<ButtonBuilder>();

        disabledRow.addComponents(
          new ButtonBuilder()
            .setCustomId("settings_prev")
            .setLabel("◀ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        disabledRow.addComponents(
          new ButtonBuilder()
            .setCustomId("settings_page")
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        disabledRow.addComponents(
          new ButtonBuilder()
            .setCustomId("settings_next")
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        await message.edit({
          components: [disabledRow],
        });
      } catch {
        // Message might be deleted, ignore error
      }
    })();
  });
}

async function resetSettings(interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  // Reset
  await deleteGuildConfig(interaction.guildId);

  // Generate new based on defaults
  await getGuildConfig(interaction.guildId);

  await interaction.followUp({
    content: `Reset guild/server settings to defaults!`,
  });
}

async function changeSetting(interaction: GuildChatInputCommandInteraction, newSettingData: SettingData) {
  await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
  await updateGuildConfig(interaction.guildId, {
    [newSettingData.name]: newSettingData.value,
  });

  const newSettingDisplay: SettingDisplay = {
    name: kebabCase(newSettingData.name),
    value: getSettingDisplayValue(newSettingData),
  };

  await interaction.followUp({
    content: `Changed \`${newSettingDisplay.name}\` value to \`${newSettingDisplay.value}\``,
  });
}

function getSettingDisplayValue(settingData: SettingData): string {
  if (settingData.value === null) {
    return "`Not Set`";
  }

  switch (settingData.name) {
    case "defaultRepeatMode": {
      if (typeof settingData.value !== "number") throw new TypeError("settingData.value must be of type 'number'");
      if (!isQueueRepeatMode(settingData.value))
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new TypeError(`Invalid QueueRepeatMode value: "${settingData.value}"`);

      return `\`${toDisplayString(settingData.value)}\``;
    }

    case "logReactionRoles":
    case "reactionRoleLoggingEnabled": {
      return typeof settingData.value === "boolean" ? (settingData.value ? "Enabled" : "Disabled") : "Unknown";
    }

    case "reactionRoleLogChannelId":
    case "welcomeChannelId":
    case "goodbyeChannelId": {
      if (typeof settingData.value === "string" && settingData.value !== "") {
        return `<#${settingData.value}>`;
      }
      return "`Not Set`";
    }

    default: {
      return `\`${settingData.value.toString()}\``;
    }
  }
}

async function handleSetWelcomeChannel(interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);
  await setWelcomeChannel(interaction.guild.id, channel.id);

  await interaction.reply({
    content: `Welcome messages will now be sent in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSetGoodbyeChannel(interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);
  await setGoodbyeChannel(interaction.guild.id, channel.id);

  await interaction.reply({
    content: `Goodbye messages will now be sent in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSetReactionRoleLogChannel(interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  // Enable logging and set the channel
  await updateGuildConfig(interaction.guild.id, {
    reactionRoleLoggingEnabled: true,
    reactionRoleLogChannelId: channel.id,
  });

  await interaction.reply({
    content: `Reaction role activities will now be logged in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleDisableReactionRoleLogging(interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await updateGuildConfig(interaction.guild.id, {
    reactionRoleLoggingEnabled: false,
    reactionRoleLogChannelId: null,
  });

  await interaction.reply({
    content: "Reaction role logging to channel has been disabled.",
    flags: MessageFlags.Ephemeral,
  });
}

async function handleToggleReactionRoleDbLogging(interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean("enabled", true);

  await updateGuildConfig(interaction.guild.id, {
    logReactionRoles: enabled,
  });

  await interaction.reply({
    content: `Database logging of reaction role activities has been ${enabled ? "enabled" : "disabled"}.`,
    flags: MessageFlags.Ephemeral,
  });
}

// New comprehensive logging handlers

async function handleSetupLogging(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const type = interaction.options.getString("type", true);
  const channel = interaction.options.getChannel("channel");

  try {
    const channelRouting: Record<string, string> = {};
    let message = "";

    switch (type) {
      case "single": {
        if (!channel) {
          await interaction.followUp({
            content: "❌ You must specify a channel for single-channel setup.",
          });
          return;
        }

        // Route ALL log types to the single channel
        ALL_LOG_TYPES.forEach((logType: string) => {
          channelRouting[logType] = channel.id;
        });

        message = `✅ **Single-channel logging setup complete!**\n\n📍 All logs will be sent to <#${channel.id}>\n\n🔍 **${ALL_LOG_TYPES.length.toString()}** log types configured automatically.`;
        break;
      }

      case "four": {
        await interaction.followUp({
          content: `🔧 **Four-channel setup initiated**\n\nPlease create or designate these channels:\n\n📋 **#mod-logs** - Moderation events\n👥 **#member-logs** - Member activity\n💬 **#message-logs** - Message events\n🔧 **#server-logs** - Server changes\n\n💡 *Use the individual channel commands to set them up:*\n\`/settings set-moderation-log-channel\`\n\`/settings set-member-log-channel\`\n\`/settings set-message-log-channel\`\n\`/settings set-server-log-channel\``,
        });
        return;
      }

      case "custom": {
        message = `🎛️ **Custom logging setup**\n\n💡 Use these commands to configure individual channels:\n\n**Channel Commands:**\n\`/settings set-moderation-log-channel\`\n\`/settings set-member-log-channel\`\n\`/settings set-message-log-channel\`\n\`/settings set-server-log-channel\`\n\`/settings set-voice-log-channel\`\n\n**Category Commands:**\n\`/settings log-category\` - Enable/disable categories\n\`/settings high-volume-events\` - Manage spam events\n\n**Bulk Commands:**\n\`/settings enable-all-logging\`\n\`/settings disable-all-logging\``;

        await interaction.followUp({ content: message });
        return;
      }
    }

    if (Object.keys(channelRouting).length > 0) {
      // Convert to category-based routing
      const categoryRouting: Record<string, string> = {};

      // Map channels to their categories
      if (channelRouting.MEMBER_BAN) {
        categoryRouting.MODERATION = channelRouting.MEMBER_BAN;
      }
      if (channelRouting.MEMBER_JOIN) {
        categoryRouting.MEMBER = channelRouting.MEMBER_JOIN;
      }
      if (channelRouting.MESSAGE_DELETE) {
        categoryRouting.MESSAGE = channelRouting.MESSAGE_DELETE;
      }
      if (channelRouting.CHANNEL_CREATE) {
        categoryRouting.CHANNEL = channelRouting.CHANNEL_CREATE;
        categoryRouting.ROLE = channelRouting.CHANNEL_CREATE;
        categoryRouting.SERVER = channelRouting.CHANNEL_CREATE;
        categoryRouting.INVITE = channelRouting.CHANNEL_CREATE;
      }
      if (channelRouting.VOICE_JOIN) {
        categoryRouting.VOICE = channelRouting.VOICE_JOIN;
      }

      // Setup logging with the LogManager using category-based routing
      await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);
      await client.logManager.enableAllLogTypes(interaction.guild.id);
    }

    await interaction.followUp({ content: message });
  } catch (error) {
    await interaction.followUp({
      content: `❌ Error setting up logging: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleSetModerationLogChannel(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  try {
    // Set up category-based routing for MODERATION
    const categoryRouting: Record<string, string> = {
      MODERATION: channel.id,
    };

    await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);

    // Get the number of event types in this category
    const moderationTypes = LOG_CATEGORIES.MODERATION;

    await interaction.reply({
      content: `✅ **Moderation logs configured!**\n\n📍 Channel: <#${channel.id}>\n🔍 **${moderationTypes.length.toString()}** moderation event types will be logged here.\n\n📋 *Includes: bans, kicks, warns, timeouts, and other moderation actions.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error setting moderation log channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSetMemberLogChannel(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  try {
    // Set up category-based routing for MEMBER
    const categoryRouting: Record<string, string> = {
      MEMBER: channel.id,
    };

    await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);

    // Get the number of event types in this category
    const memberTypes = LOG_CATEGORIES.MEMBER;

    await interaction.reply({
      content: `✅ **Member logs configured!**\n\n📍 Channel: <#${channel.id}>\n🔍 **${memberTypes.length.toString()}** member event types will be logged here.\n\n👥 *Includes: joins, leaves, role changes, nickname changes, and more.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error setting member log channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSetMessageLogChannel(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  try {
    // Set up category-based routing for MESSAGE
    const categoryRouting: Record<string, string> = {
      MESSAGE: channel.id,
    };

    await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);

    // Get the number of event types in this category
    const messageTypes = LOG_CATEGORIES.MESSAGE;

    await interaction.reply({
      content: `✅ **Message logs configured!**\n\n📍 Channel: <#${channel.id}>\n🔍 **${messageTypes.length.toString()}** message event types will be logged here.\n\n💬 *Includes: edits, deletes, reactions, pins, and more.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error setting message log channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSetServerLogChannel(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  try {
    // Set up category-based routing for server-related categories
    const categoryRouting: Record<string, string> = {
      SERVER: channel.id,
      CHANNEL: channel.id,
      ROLE: channel.id,
      INVITE: channel.id,
    };

    await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);

    // Get the number of event types in these categories
    const serverTypes = [
      ...LOG_CATEGORIES.SERVER,
      ...LOG_CATEGORIES.CHANNEL,
      ...LOG_CATEGORIES.ROLE,
      ...LOG_CATEGORIES.INVITE,
    ];

    await interaction.reply({
      content: `✅ **Server logs configured!**\n\n📍 Channel: <#${channel.id}>\n🔍 **${serverTypes.length.toString()}** server event types will be logged here.\n\n🔧 *Includes: channels, roles, server settings, invites, and more.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error setting server log channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSetVoiceLogChannel(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const channel = interaction.options.getChannel("channel", true);

  try {
    // Set up category-based routing for VOICE
    const categoryRouting: Record<string, string> = {
      VOICE: channel.id,
    };

    await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);

    // Get the number of event types in this category
    const voiceTypes = LOG_CATEGORIES.VOICE;

    await interaction.reply({
      content: `✅ **Voice logs configured!**\n\n📍 Channel: <#${channel.id}>\n🔍 **${voiceTypes.length.toString()}** voice event types will be logged here.\n\n🎵 *Includes: joins, leaves, mutes, unmutes, streaming, and more.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error setting voice log channel: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleHighVolumeEvents(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const action = interaction.options.getString("action", true);
  const separateChannel = interaction.options.getChannel("separate-channel");

  try {
    switch (action) {
      case "enable": {
        if (separateChannel) {
          // Create a HIGH_VOLUME category mapping
          const categoryRouting: Record<string, string> = {
            HIGH_VOLUME: separateChannel.id,
          };
          await client.logManager.setupCategoryLogging(interaction.guild.id, categoryRouting);
        }

        await client.logManager.enableLogTypes(interaction.guild.id, HIGH_VOLUME_EVENTS);

        await interaction.reply({
          content: `✅ **High-volume events enabled!**\n\n${separateChannel ? `📍 Routed to: <#${separateChannel.id}>` : "📍 Using existing channel routing"}\n\n⚠️ **Events enabled:**\n${HIGH_VOLUME_EVENTS.map((e) => `• ${e}`).join("\n")}\n\n💡 *These events can generate many logs. Monitor your channels.*`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "disable": {
        await client.logManager.disableLogTypes(interaction.guild.id, HIGH_VOLUME_EVENTS);

        await interaction.reply({
          content: `❌ **High-volume events disabled!**\n\n🔇 **Events disabled:**\n${HIGH_VOLUME_EVENTS.map((e) => `• ${e}`).join("\n")}`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "status": {
        const settings = await client.logManager.getSettings(interaction.guild.id);
        const enabledHighVolume = HIGH_VOLUME_EVENTS.filter((event) => settings.enabledLogTypes.includes(event));
        const disabledHighVolume = HIGH_VOLUME_EVENTS.filter((event) => !settings.enabledLogTypes.includes(event));

        await interaction.reply({
          content: `📊 **High-Volume Events Status**\n\n✅ **Enabled (${enabledHighVolume.length.toString()}):**\n${enabledHighVolume.map((e) => `• ${e}`).join("\n") || "None"}\n\n❌ **Disabled (${disabledHighVolume.length.toString()}):**\n${disabledHighVolume.map((e) => `• ${e}`).join("\n") || "None"}`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
    }
  } catch (error) {
    await interaction.reply({
      content: `❌ Error managing high-volume events: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleEnableAllLogging(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  try {
    await client.logManager.enableAllLogTypes(interaction.guild.id);

    await interaction.reply({
      content: `✅ **All logging enabled!**\n\n🔍 **${ALL_LOG_TYPES.length.toString()}** log types are now active.\n\n💡 *Make sure you have channels configured with:*\n\`/settings setup-logging\``,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error enabling all logging: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleDisableAllLogging(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  try {
    await client.logManager.disableAllLogTypes(interaction.guild.id);

    await interaction.reply({
      content: `❌ **All logging disabled!**\n\n🔇 No events will be logged until you re-enable them.\n\n💡 *Use \`/settings enable-all-logging\` to restore logging.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error disabling all logging: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleLogCategory(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const category = interaction.options.getString("category", true);
  const enabled = interaction.options.getBoolean("enabled", true);

  try {
    const categoryLogTypes = [...LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES]];

    if (categoryLogTypes.length === 0) {
      await interaction.reply({
        content: `❌ Unknown or empty log category: ${category}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (enabled) {
      await client.logManager.enableLogTypes(interaction.guild.id, categoryLogTypes);
    } else {
      await client.logManager.disableLogTypes(interaction.guild.id, categoryLogTypes);
    }

    await interaction.reply({
      content: `${enabled ? "✅" : "❌"} **${category} logs ${enabled ? "enabled" : "disabled"}!**\n\n🔍 **${categoryLogTypes.length.toString()}** log types affected:\n${categoryLogTypes
        .slice(0, 10)
        .map((e: string) => `• ${e}`)
        .join(
          "\n"
        )}${categoryLogTypes.length > 10 ? `\n... and ${(categoryLogTypes.length - 10).toString()} more` : ""}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error configuring log category: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleAuditLogs(client: Client, interaction: GuildChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const enabled = interaction.options.getBoolean("enabled", true);

  try {
    // This would integrate with Discord's audit log API
    // For now, we'll just acknowledge the setting
    await interaction.reply({
      content: `${enabled ? "✅" : "❌"} **Audit log integration ${enabled ? "enabled" : "disabled"}!**\n\n${enabled ? "🔍 Discord audit logs will be captured and correlated with events." : "🔇 Audit log integration is disabled."}\n\n💡 *This feature enhances moderation logs with "who did what" context.*`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Error configuring audit logs: ${error instanceof Error ? error.message : "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
