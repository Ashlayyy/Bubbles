import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import camelCaseFn from "lodash/camelCase.js";
import kebabCaseFn from "lodash/kebabCase.js";
import {
  getGuildConfig,
  descriptions as guildConfigDescriptions,
  updateGuildConfig,
} from "../../database/GuildConfig.js";
import type Client from "../../structures/Client.js";
import type {
  GuildChatInputCommandInteraction,
  GuildMessageContextMenuCommandInteraction,
} from "../../structures/Command.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import {
  changeSetting,
  displayCurrentSettings as displaySettings,
  guildConfigSettings,
  handleLoggingHelp,
  handleSetGoodbyeChannel,
  handleSetWelcomeChannel,
  resetSettings,
} from "../../subCommandHandlers/config/configHandler.js";

// Helper to build yes/no text
const boolEmoji = (v: boolean) => (v ? "✅ Enabled" : "❌ Disabled");

export default new Command(
  (() => {
    const kebabCase = kebabCaseFn;
    const builder = new SlashCommandBuilder()
      .setName("config")
      .setDescription("Server configuration & management")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
      .addSubcommand((s) => s.setName("view").setDescription("View current guild configuration"))
      .addSubcommandGroup((g) =>
        g
          .setName("moderation")
          .setDescription("Moderation related settings")
          .addSubcommand((sub) =>
            sub
              .setName("notify_user")
              .setDescription("Toggle DM notifications for moderation actions")
              .addBooleanOption((opt) => opt.setName("enabled").setDescription("Enable or disable").setRequired(true))
          )
      )
      .addSubcommand((s) =>
        s
          .setName("set-welcome-channel")
          .setDescription("Set the welcome channel")
          .addChannelOption((o) => o.setName("channel").setDescription("Channel").addChannelTypes(0).setRequired(true))
      )
      .addSubcommand((s) =>
        s
          .setName("set-goodbye-channel")
          .setDescription("Set the goodbye channel")
          .addChannelOption((o) => o.setName("channel").setDescription("Channel").addChannelTypes(0).setRequired(true))
      )
      .addSubcommand((s) => s.setName("display").setDescription("Display all settings"))
      .addSubcommandGroup((g) =>
        g
          .setName("music-channel-id")
          .setDescription("Configure the dedicated music command text channel")
          .addSubcommand((s) =>
            s
              .setName("overwrite")
              .setDescription("Overwrite current value with a new channel")
              .addChannelOption((o) =>
                o.setName("new-value").setDescription("New channel").addChannelTypes(0).setRequired(true)
              )
          )
          .addSubcommand((s) => s.setName("disable").setDescription("Disable this setting (set empty value)"))
      )
      .addSubcommand((s) =>
        s
          .setName(kebabCase("defaultRepeatMode"))
          .setDescription("Set default music repeat mode")
          .addIntegerOption((o) =>
            o
              .setName("new-value")
              .setDescription("Repeat mode")
              .setRequired(true)
              .addChoices(
                { name: "OFF", value: 0 },
                { name: "TRACK", value: 1 },
                { name: "QUEUE", value: 2 },
                { name: "AUTOPLAY", value: 3 }
              )
          )
      )
      .addSubcommand((s) => s.setName("reset").setDescription("Reset all settings to defaults"));

    // Dynamic settings (reuse first three from old builder for brevity)
    if (guildConfigSettings.length > 0) {
      // maxMessagesCleared example numeric
      builder.addSubcommand((opt) =>
        opt
          .setName(kebabCase(guildConfigSettings[0]))
          .setDescription(guildConfigDescriptions[guildConfigSettings[0]])
          .addIntegerOption((so) => so.setName("new-value").setDescription("New value").setRequired(true))
      );
    }

    return builder;
  })(),

  async (client: Client, interaction: GuildChatInputCommandInteraction | GuildMessageContextMenuCommandInteraction) => {
    if (!interaction.isChatInputCommand() || !interaction.inGuild()) {
      return;
    }

    // From here on, interaction is ChatInput
    const options = interaction.options;

    const kebabCase = kebabCaseFn;
    const camelCase = camelCaseFn;

    const subcommand = options.getSubcommand();

    if (subcommand === "view") {
      const config = await getGuildConfig(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle(`📑 Guild Configuration for ${interaction.guild?.name}`)
        .setColor(0x3498db)
        .setTimestamp();

      const notifyVal = boolEmoji((config as unknown as { notify_user?: boolean }).notify_user ?? false);
      embed.addFields(
        { name: "Notify User (Moderation)", value: notifyVal, inline: true },
        { name: "Max Messages Cleared", value: String(config.maxMessagesCleared), inline: true },
        { name: "Music Channel", value: config.musicChannelId || "Not set", inline: true }
        // Add more commonly-requested fields here. Keeping minimal for now.
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Handle subcommand group (moderation notify_user)
    const subcommandGroup = options.getSubcommandGroup(false);
    if (subcommandGroup === "moderation" && subcommand === "notify_user") {
      const enabled = options.getBoolean("enabled", true);
      await updateGuildConfig(interaction.guildId, { notify_user: enabled } as Record<string, unknown>);

      await interaction.reply({
        content: `🔧 Moderation DM notifications have been ${enabled ? "enabled" : "disabled"}.`,
        ephemeral: true,
      });
      return;
    }

    // New subcommands migrated from /settings
    switch (subcommand) {
      case "set-welcome-channel":
        await handleSetWelcomeChannel(interaction);
        return;
      case "set-goodbye-channel":
        await handleSetGoodbyeChannel(interaction);
        return;
      case "display":
        await displaySettings(
          client as unknown as import("../../../../bot/src/structures/Client.js").default,
          interaction
        );
        return;
      case "logging-help":
        await handleLoggingHelp(interaction);
        return;
    }

    // Check dynamic setting change
    const settingName = camelCase(subcommand);
    if (guildConfigSettings.includes(settingName)) {
      const newVal = options.get("new-value")?.value ?? "";
      await changeSetting(interaction, settingName, newVal);
      return;
    }

    // Handle music-channel-id group
    if (subcommandGroup === "music-channel-id") {
      const settingKey = "musicChannelId";
      if (subcommand === "overwrite") {
        const channelId = options.getChannel("new-value", true).id;
        await changeSetting(interaction, settingKey, channelId);
      } else if (subcommand === "disable") {
        await changeSetting(interaction, settingKey, "");
      }
      return;
    }

    // reset command
    if (subcommand === "reset") {
      await resetSettings(interaction);
      return;
    }

    // Fallback
    await interaction.reply({ content: "⚠️ Unknown configuration option.", ephemeral: true });
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: false,
    },
  }
);
