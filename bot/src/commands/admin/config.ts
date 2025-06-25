import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";

import camelCaseFn from "lodash/camelCase.js";
import kebabCaseFn from "lodash/kebabCase.js";
import {
  getGuildConfig,
  defaults as guildConfigDefaults,
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
  handleLoggingHelp,
  handleSetGoodbyeChannel,
  handleSetWelcomeChannel,
  resetSettings,
} from "../../subCommandHandlers/config/configHandler.js";

// Helper to build yes/no text
const boolEmoji = (v: boolean) => (v ? "✅ Enabled" : "❌ Disabled");

// Mapping of logical groups to guildConfig setting keys (camelCase)
export const settingGroups: Record<string, string[]> = {
  // Existing moderation group already defined explicitly above – only add extra keys
  music: ["defaultRepeatMode", "musicChannelId"],
  "reaction-roles": ["reactionRoleChannels", "logReactionRoles"],
  welcome: ["welcomeChannelId", "welcomeEnabled"],
  goodbye: ["goodbyeChannelId", "goodbyeEnabled"],
  tickets: [
    "ticketChannelId",
    "ticketCategoryId",
    "useTicketThreads",
    "ticketOnCallRoleId",
    "ticketSilentClaim",
    "ticketAccessType",
    "ticketAccessRoleId",
    "ticketAccessPermission",
    "ticketLogChannelId",
  ],
  logging: ["logSettingsId"],
  appeals: ["appealSettingsId"],
  general: ["maxMessagesCleared"],
};

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

    // ----------------------------------------------------------------
    // Dynamically generate grouped subcommands for each setting
    // ----------------------------------------------------------------
    // Iterate over logical setting groups (excluding moderation which is handled manually)
    Object.entries(settingGroups).forEach(([grpName, keys]) => {
      if (grpName === "moderation") return; // skip, already defined

      builder.addSubcommandGroup((group) => {
        group.setName(grpName).setDescription(`${grpName.replace(/-/g, " ")} settings`);

        keys.forEach((key) => {
          const subName = kebabCase(key);
          const defaultVal = (guildConfigDefaults as Record<string, unknown>)[key];

          group.addSubcommand((sub) => {
            sub.setName(subName).setDescription(guildConfigDescriptions[key] ?? "Update setting");

            if (typeof defaultVal === "boolean") {
              sub.addBooleanOption((opt) => opt.setName("new-value").setDescription("New value").setRequired(true));
            } else if (typeof defaultVal === "number") {
              sub.addIntegerOption((opt) => opt.setName("new-value").setDescription("New value").setRequired(true));
            } else {
              sub.addStringOption((opt) => opt.setName("new-value").setDescription("New value").setRequired(true));
            }

            return sub;
          });
        });

        return group;
      });
    });

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

    // Generic group-based handler (new system)
    if (subcommandGroup) {
      const groupSettings = settingGroups[subcommandGroup];
      const settingKey = camelCase(subcommand);
      if (groupSettings.includes(settingKey)) {
        const defaultVal = (guildConfigDefaults as Record<string, unknown>)[settingKey];

        let newVal: unknown;

        if (typeof defaultVal === "boolean") {
          newVal = options.getBoolean("new-value", true);
        } else if (typeof defaultVal === "number") {
          newVal = options.getInteger("new-value", true);
        } else {
          // Attempt to fetch as channel / role / string
          newVal = options.getString("new-value", true);

          const channelOption = options.getChannel("new-value");
          if (channelOption) {
            // When a channel option exists we prefer its ID
            newVal = channelOption.id;
          }

          const roleOption = options.getRole("new-value");
          if (roleOption) {
            newVal = roleOption.id;
          }
        }

        await changeSetting(interaction, settingKey, newVal);
        return;
      }
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
