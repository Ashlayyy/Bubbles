import { QueueRepeatMode } from "discord-player";
import type { EmbedField } from "discord.js";
import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
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
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { kebabCase, camelCase } = lodash;

/** Omit `greetings` from `GuildConfig` */
const guildConfigSettings = Object.keys(guildConfigDefaults).filter((setting) => setting !== "greetings");

// Base slash command builder
const builder = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Manage server-specific bot settings.")
  .setDefaultMemberPermissions(0)
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

  // Create embed with settings
  const settingsEmbed = client.genEmbed({
    title: `${interaction.guild?.name ?? "NO NAME"} [id: \`${interaction.guildId}\`] Server-wide Settings`,
    fields: settingsFieldArr,
    thumbnail: {
      url: "attachment://settings.png",
    },
  });

  await interaction.followUp({
    embeds: [settingsEmbed],
    files: ["assets/icons/settings.png"],
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
