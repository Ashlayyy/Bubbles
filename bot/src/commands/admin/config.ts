import { ChannelType, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import camelCaseFn from "lodash/camelCase.js";
import kebabCaseFn from "lodash/kebabCase.js";

import {
  getGuildConfig,
  defaults as guildConfigDefaults,
  descriptions as guildConfigDescriptions,
  updateGuildConfig,
} from "../../database/GuildConfig.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

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

/**
 * Config Command - Server configuration & management
 */
export class ConfigCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "config",
      description: "Server configuration & management",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        isConfigurable: false,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const interaction = this.interaction as import("discord.js").ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup(false);

    try {
      // Handle view subcommand
      if (subcommand === "view") {
        return await this.handleViewConfig();
      }

      // Handle moderation group
      if (subcommandGroup === "moderation" && subcommand === "notify_user") {
        return await this.handleModerationNotifyUser();
      }

      if (subcommandGroup === "moderation" && subcommand === "case_rule") {
        return await this.handleModerationCaseRule();
      }

      // Handle specific subcommands
      switch (subcommand) {
        case "set-welcome-channel":
          return await this.handleSetWelcomeChannel();
        case "set-goodbye-channel":
          return await this.handleSetGoodbyeChannel();
        case "display":
          return await this.handleDisplaySettings();
        case "logging-help":
          return this.handleLoggingHelp();
        case "reset":
          return await this.handleResetSettings();
        case "set-modlog-channel":
          return await this.handleSetModlogChannel();
        default:
          // Handle grouped settings
          if (subcommandGroup) {
            return await this.handleGroupedSetting(subcommandGroup, subcommand);
          }

          throw new Error("Unknown configuration option.");
      }
    } catch (error) {
      return this.createAdminError(
        "Configuration Error",
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  }

  private async handleViewConfig(): Promise<CommandResponse> {
    const config = await getGuildConfig(this.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`📑 Guild Configuration for ${this.guild.name}`)
      .setColor(0x3498db)
      .setTimestamp();

    const notifyVal = boolEmoji((config as unknown as { notify_user?: boolean }).notify_user ?? false);
    embed.addFields(
      { name: "Notify User (Moderation)", value: notifyVal, inline: true },
      { name: "Max Messages Cleared", value: String(config.maxMessagesCleared), inline: true },
      { name: "Music Channel", value: config.musicChannelId || "Not set", inline: true }
    );

    return { embeds: [embed], ephemeral: true };
  }

  private async handleModerationNotifyUser(): Promise<CommandResponse> {
    const enabled = this.getBooleanOption("enabled", true);
    await updateGuildConfig(this.guild.id, { notify_user: enabled } as Record<string, unknown>);

    return this.createAdminSuccess(
      "Moderation Settings Updated",
      `DM notifications have been ${enabled ? "enabled" : "disabled"}.`
    );
  }

  private async handleModerationCaseRule(): Promise<CommandResponse> {
    const action = this.getStringOption("action", true).toUpperCase();
    const handling = this.getStringOption("handling", true).toUpperCase();

    const allowedActions = ["BAN", "UNBAN", "TIMEOUT", "UNTIMEOUT", "KICK", "WARN", "NOTE"];
    const allowedModes = ["NEW", "UPDATE"];

    if (!allowedActions.includes(action)) {
      throw new Error(`Unknown action ${action}`);
    }
    if (!allowedModes.includes(handling)) {
      throw new Error(`Handling must be NEW or UPDATE`);
    }

    const config = await getGuildConfig(this.guild.id);
    const rules: Record<string, string> =
      (config as unknown as { moderation_case_rules?: Record<string, string> }).moderation_case_rules ?? {};
    rules[action] = handling;

    await updateGuildConfig(this.guild.id, { moderation_case_rules: rules } as Record<string, unknown>);

    return this.createAdminSuccess(
      "Moderation Case Rule Updated",
      `Action **${action}** will now use **${handling}** handling.`
    );
  }

  private async handleSetWelcomeChannel(): Promise<CommandResponse> {
    const channel = this.getChannelOption("channel", true);
    await updateGuildConfig(this.guild.id, { welcomeChannelId: channel.id });

    return this.createAdminSuccess("Welcome Channel Set", `Welcome channel has been set to <#${channel.id}>.`);
  }

  private async handleSetGoodbyeChannel(): Promise<CommandResponse> {
    const channel = this.getChannelOption("channel", true);
    await updateGuildConfig(this.guild.id, { goodbyeChannelId: channel.id });

    return this.createAdminSuccess("Goodbye Channel Set", `Goodbye channel has been set to <#${channel.id}>.`);
  }

  private async handleDisplaySettings(): Promise<CommandResponse> {
    const config = await getGuildConfig(this.guild.id);

    const embed = new EmbedBuilder().setTitle(`⚙️ ${this.guild.name} Settings`).setColor(0x3498db).setTimestamp();

    // Add key settings as fields
    embed.addFields(
      {
        name: "Welcome Channel",
        value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set",
        inline: true,
      },
      {
        name: "Goodbye Channel",
        value: config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : "Not set",
        inline: true,
      },
      { name: "Music Channel", value: config.musicChannelId ? `<#${config.musicChannelId}>` : "Not set", inline: true },
      { name: "Max Messages Cleared", value: String(config.maxMessagesCleared), inline: true },
      {
        name: "Moderation Notifications",
        value: boolEmoji((config as unknown as { notify_user?: boolean }).notify_user ?? false),
        inline: true,
      }
    );

    return { embeds: [embed], ephemeral: true };
  }

  private handleLoggingHelp(): CommandResponse {
    const embed = new EmbedBuilder()
      .setTitle("📋 Logging Help")
      .setColor(0x3498db)
      .setDescription("Configure logging settings for your server")
      .addFields(
        {
          name: "Available Log Types",
          value: "• Moderation Actions\n• Message Events\n• Member Events\n• Role Changes\n• Channel Changes",
          inline: false,
        },
        {
          name: "Setup Instructions",
          value: "Use the logging configuration commands to set up channels for different event types.",
          inline: false,
        }
      );

    return { embeds: [embed], ephemeral: true };
  }

  private async handleResetSettings(): Promise<CommandResponse> {
    // Reset to default values
    await updateGuildConfig(this.guild.id, guildConfigDefaults);

    return this.createAdminSuccess("Settings Reset", "All settings have been reset to their default values.");
  }

  private async handleSetModlogChannel(): Promise<CommandResponse> {
    const channel = this.getChannelOption("channel", true);

    // Build channelRouting map for all moderation log types
    const types = ["MOD_BAN", "MOD_KICK", "MOD_TIMEOUT", "MOD_UNTIMEOUT", "MOD_WARN", "MOD_NOTE", "MOD_UNBAN"];

    const routing: Record<string, string> = {};
    types.forEach((t) => (routing[t] = channel.id));

    await prisma.logSettings.upsert({
      where: { guildId: this.guild.id },
      update: {
        channelRouting: routing,
        enabledLogTypes: { set: types },
      },
      create: {
        guildId: this.guild.id,
        channelRouting: routing,
        enabledLogTypes: types,
      },
    });

    return this.createAdminSuccess(
      "Moderation Log Channel Set",
      `All moderation actions will now be logged to <#${channel.id}>.`
    );
  }

  private async handleGroupedSetting(subcommandGroup: string, subcommand: string): Promise<CommandResponse> {
    const camelCase = camelCaseFn;
    const groupSettings = settingGroups[subcommandGroup];
    const settingKey = camelCase(subcommand);

    if (!groupSettings.includes(settingKey)) {
      throw new Error(`Unknown setting: ${settingKey}`);
    }

    const defaultVal = (guildConfigDefaults as Record<string, unknown>)[settingKey];
    let newVal: unknown;

    if (typeof defaultVal === "boolean") {
      newVal = this.getBooleanOption("new-value", true);
    } else if (typeof defaultVal === "number") {
      newVal = this.getIntegerOption("new-value", true);
    } else if (settingKey.toLowerCase().includes("channelid")) {
      // Accept any guild channel
      newVal = this.getChannelOption("new-value");
    } else if (settingKey.toLowerCase().includes("roleid")) {
      newVal = this.getRoleOption("new-value");
    } else {
      // Attempt to fetch as channel / role / string
      newVal = this.getStringOption("new-value", true);

      const channelOption = this.getChannelOption("new-value");
      if (channelOption) {
        newVal = channelOption.id;
      }

      const roleOption = this.getRoleOption("new-value");
      if (roleOption) {
        newVal = roleOption.id;
      }
    }

    // Update the setting directly
    await updateGuildConfig(this.guild.id, { [settingKey]: newVal });

    return this.createAdminSuccess("Setting Updated", `Successfully updated ${settingKey} to ${String(newVal)}`);
  }
}

// Export the command instance
export default new ConfigCommand();

// Export the Discord command builder for registration
export const builder = (() => {
  const kebabCase = kebabCaseFn;
  const slashBuilder = new SlashCommandBuilder()
    .setName("config")
    .setDescription("Server configuration & management")
    .setDefaultMemberPermissions(0) // Hide from all regular users
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
        .addSubcommand((sub) =>
          sub
            .setName("case_rule")
            .setDescription("Set how a moderation action creates or updates cases")
            .addStringOption((opt) =>
              opt
                .setName("action")
                .setDescription("Moderation action")
                .setRequired(true)
                .addChoices(
                  { name: "BAN", value: "BAN" },
                  { name: "UNBAN", value: "UNBAN" },
                  { name: "TIMEOUT", value: "TIMEOUT" },
                  { name: "UNTIMEOUT", value: "UNTIMEOUT" },
                  { name: "KICK", value: "KICK" },
                  { name: "WARN", value: "WARN" },
                  { name: "NOTE", value: "NOTE" }
                )
            )
            .addStringOption((opt) =>
              opt
                .setName("handling")
                .setDescription("Behaviour")
                .setRequired(true)
                .addChoices({ name: "NEW", value: "NEW" }, { name: "UPDATE", value: "UPDATE" })
            )
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
    .addSubcommand((s) => s.setName("reset").setDescription("Reset all settings to defaults"))
    .addSubcommand((s) =>
      s
        .setName("set-modlog-channel")
        .setDescription("Set the channel where moderation logs are sent")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    );

  // ----------------------------------------------------------------
  // Dynamically generate grouped subcommands for each setting
  // ----------------------------------------------------------------
  // Iterate over logical setting groups (excluding moderation which is handled manually)
  Object.entries(settingGroups).forEach(([grpName, keys]) => {
    if (grpName === "moderation") return; // skip, already defined

    slashBuilder.addSubcommandGroup((group) => {
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
          } else if (key.toLowerCase().includes("channelid")) {
            // Accept any guild channel
            sub.addChannelOption((opt) => opt.setName("new-value").setDescription("Channel").setRequired(true));
          } else if (key.toLowerCase().includes("roleid")) {
            sub.addRoleOption((opt) => opt.setName("new-value").setDescription("Role").setRequired(true));
          } else {
            sub.addStringOption((opt) => opt.setName("new-value").setDescription("New value").setRequired(true));
          }

          return sub;
        });
      });

      return group;
    });
  });

  return slashBuilder;
})();
