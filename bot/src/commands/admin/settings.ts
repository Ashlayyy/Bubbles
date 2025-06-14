import { QueueRepeatMode } from "discord-player";
import type { EmbedField } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
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
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// eslint-disable-next-line @typescript-eslint/unbound-method
const { kebabCase, camelCase } = lodash;

/** Omit `greetings` from `GuildConfig` */
const guildConfigSettings = Object.keys(guildConfigDefaults).filter((setting) => setting !== "greetings");

// Logging functionality moved to comprehensive /logging command

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

  // Logging is now handled by the comprehensive /logging command
  .addSubcommand((subcommand) =>
    subcommand.setName("logging-help").setDescription("🗂️ Get information about the new comprehensive logging system")
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

      case "display":
        await displayCurrentSettings(client, interaction);
        break;

      // New logging configuration handlers
      case "logging-help":
        await handleLoggingHelp(interaction);
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

// ========================================
// REMOVED: Old reaction role logging functions
// All reaction role logging is now handled by the comprehensive /logging command
// Use /logging setup or /logging toggle REACTION_ROLE to configure reaction role logging
// ========================================

// New comprehensive logging handlers

async function handleLoggingHelp(interaction: GuildChatInputCommandInteraction) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🗂️ New Comprehensive Logging System")
    .setDescription(
      "**Server logging has been completely redesigned!** ✨\n\n" +
        "All logging functionality has been moved to a new, more powerful command system that's easier to use and configure."
    )
    .addFields(
      {
        name: "🚀 New Logging Commands",
        value:
          "**`/logging setup`** - Interactive setup wizard\n" +
          "**`/logging preset`** - Apply pre-configured templates\n" +
          "**`/logging status`** - View current configuration\n" +
          "**`/logging channels`** - Configure channel routing\n" +
          "**`/logging toggle`** - Enable/disable categories\n" +
          "**`/logging advanced`** - Advanced options",
        inline: false,
      },
      {
        name: "✨ What's New",
        value:
          "• **Wizard-based setup** - Step-by-step guidance\n" +
          "• **Smart presets** - Pre-configured for different server types\n" +
          "• **Better organization** - Categories instead of individual events\n" +
          "• **High-volume filtering** - Avoid channel spam\n" +
          "• **Channel routing** - Send different logs to different channels",
        inline: false,
      },
      {
        name: "🎯 Getting Started",
        value:
          "1. **Start with `/logging setup`** for the guided wizard\n" +
          "2. **Or use `/logging preset`** for quick templates\n" +
          "3. **Check `/logging status`** to see what's enabled\n" +
          "4. **Fine-tune with `/logging toggle`** as needed",
        inline: false,
      },
      {
        name: "💡 Migration Tips",
        value:
          "• Your existing log settings are preserved\n" +
          "• Use `/logging status` to see current state\n" +
          "• The new system excludes spam events by default\n" +
          "• You can enable high-volume events if needed",
        inline: false,
      }
    )
    .setFooter({ text: "Use /logging setup to get started with the new system!" })
    .setTimestamp();

  await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}

// ========================================
// REMOVED: Old logging functions
// All logging functionality has been moved to /logging command
// ========================================

// ========================================
// ALL OLD LOGGING FUNCTIONS REMOVED
// Use the new comprehensive /logging command instead!
// ========================================
