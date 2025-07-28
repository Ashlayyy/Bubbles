import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

class LevelingSettingsCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "settings",
      description: "Configure leveling settings for the server",
      category: "leveling",
      permissions: {
        level: PermissionLevel.ADMIN,
        discordPermissions: [PermissionsBitField.Flags.Administrator],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    const action = this.getStringOption("action") || "view";
    const guildId = this.guild.id;

    try {
      const customApiUrl = process.env.API_URL || "http://localhost:3001";

      if (action === "view") {
        return await this.viewSettings(customApiUrl, guildId);
      } else if (action === "enable" || action === "disable") {
        return await this.toggleLeveling(customApiUrl, guildId, action === "enable");
      } else if (action === "set-xp-rate") {
        const xpRate = this.getIntegerOption("xp-rate");
        if (!xpRate || xpRate < 1 || xpRate > 100) {
          return this.createGeneralError("Invalid Value", "XP rate must be between 1 and 100.");
        }
        return await this.setXpRate(customApiUrl, guildId, xpRate);
      } else if (action === "set-cooldown") {
        const cooldown = this.getIntegerOption("cooldown");
        if (!cooldown || cooldown < 10 || cooldown > 300) {
          return this.createGeneralError("Invalid Value", "Cooldown must be between 10 and 300 seconds.");
        }
        return await this.setCooldown(customApiUrl, guildId, cooldown);
      } else if (action === "ignore-channel") {
        const channel = this.getChannelOption("channel");
        if (!channel) {
          return this.createGeneralError("Invalid Input", "Please specify a channel to ignore.");
        }
        return await this.toggleIgnoredChannel(customApiUrl, guildId, channel.id, true);
      } else if (action === "unignore-channel") {
        const channel = this.getChannelOption("channel");
        if (!channel) {
          return this.createGeneralError("Invalid Input", "Please specify a channel to unignore.");
        }
        return await this.toggleIgnoredChannel(customApiUrl, guildId, channel.id, false);
      } else if (action === "ignore-role") {
        const role = this.getRoleOption("role");
        if (!role) {
          return this.createGeneralError("Invalid Input", "Please specify a role to ignore.");
        }
        return await this.toggleIgnoredRole(customApiUrl, guildId, role.id, true);
      } else if (action === "unignore-role") {
        const role = this.getRoleOption("role");
        if (!role) {
          return this.createGeneralError("Invalid Input", "Please specify a role to unignore.");
        }
        return await this.toggleIgnoredRole(customApiUrl, guildId, role.id, false);
      } else if (action === "set-level-up-channel") {
        const channel = this.getChannelOption("channel");
        return await this.setLevelUpChannel(customApiUrl, guildId, channel?.id || null);
      } else if (action === "set-level-up-message") {
        const message = this.getStringOption("message");
        if (!message) {
          return this.createGeneralError("Invalid Input", "Please specify a level-up message.");
        }
        return await this.setLevelUpMessage(customApiUrl, guildId, message);
      }

      return this.createGeneralError("Invalid Action", "Unknown action specified.");
    } catch (error) {
      logger.error("Error in leveling settings command:", error);
      return this.createGeneralError(
        "Error",
        "An error occurred while managing leveling settings. Please try again later."
      );
    }
  }

  private async viewSettings(apiUrl: string, guildId: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to fetch settings.");
    }

    const settings = data.data;

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Leveling Settings")
      .setColor(settings.enabled ? "#00ff00" : "#ff0000")
      .setTimestamp()
      .setFooter({
        text: `Requested by ${this.user.username}`,
        iconURL: this.user.displayAvatarURL(),
      });

    // Basic settings
    embed.addFields({
      name: "🎯 Basic Settings",
      value: [
        `**Status:** ${settings.enabled ? "✅ Enabled" : "❌ Disabled"}`,
        `**XP per Message:** ${settings.xpPerMessage || 15}`,
        `**XP Cooldown:** ${settings.xpCooldown || 60} seconds`,
        `**Level Up Message:** ${settings.levelUpMessage || "Default message"}`,
        `**Level Up Channel:** ${settings.levelUpChannel ? `<#${settings.levelUpChannel}>` : "Same channel"}`,
      ].join("\n"),
      inline: false,
    });

    // Ignored channels
    if (settings.ignoredChannels?.length > 0) {
      embed.addFields({
        name: "🚫 Ignored Channels",
        value: settings.ignoredChannels.map((id: string) => `<#${id}>`).join(", "),
        inline: false,
      });
    }

    // Ignored roles
    if (settings.ignoredRoles?.length > 0) {
      embed.addFields({
        name: "🚫 Ignored Roles",
        value: settings.ignoredRoles.map((id: string) => `<@&${id}>`).join(", "),
        inline: false,
      });
    }

    // Multiplier roles
    if (settings.multiplierRoles?.length > 0) {
      embed.addFields({
        name: "🚀 Multiplier Roles",
        value: settings.multiplierRoles.map((role: any) => `<@&${role.roleId}> (${role.multiplier}x)`).join(", "),
        inline: false,
      });
    }

    // No XP roles
    if (settings.noXpRoles?.length > 0) {
      embed.addFields({
        name: "❌ No XP Roles",
        value: settings.noXpRoles.map((id: string) => `<@&${id}>`).join(", "),
        inline: false,
      });
    }

    embed.addFields({
      name: "📖 Quick Commands",
      value: [
        "`/leveling settings action:enable` - Enable leveling",
        "`/leveling settings action:disable` - Disable leveling",
        "`/leveling settings action:set-xp-rate xp-rate:20` - Set XP rate",
        "`/leveling settings action:set-cooldown cooldown:30` - Set cooldown",
        "`/leveling settings action:ignore-channel channel:#general` - Ignore channel",
        "`/leveling settings action:ignore-role role:@Bots` - Ignore role",
      ].join("\n"),
      inline: false,
    });

    await this.logCommandUsage("settings", { action: "view", guildId });
    return { embeds: [embed], ephemeral: true };
  }

  private async toggleLeveling(apiUrl: string, guildId: string, enabled: boolean): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: enabled ? "enable" : "disable", guildId });
    return this.createGeneralSuccess(
      "Settings Updated",
      `Leveling system has been **${enabled ? "enabled" : "disabled"}** for this server.`
    );
  }

  private async setXpRate(apiUrl: string, guildId: string, xpRate: number): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ xpPerMessage: xpRate }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: "set-xp-rate", xpRate, guildId });
    return this.createGeneralSuccess("Settings Updated", `XP rate has been set to **${xpRate}** per message.`);
  }

  private async setCooldown(apiUrl: string, guildId: string, cooldown: number): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ xpCooldown: cooldown }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: "set-cooldown", cooldown, guildId });
    return this.createGeneralSuccess("Settings Updated", `XP cooldown has been set to **${cooldown}** seconds.`);
  }

  private async toggleIgnoredChannel(
    apiUrl: string,
    guildId: string,
    channelId: string,
    ignore: boolean
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ignoredChannels: {
          action: ignore ? "add" : "remove",
          channelId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", {
      action: ignore ? "ignore-channel" : "unignore-channel",
      channelId,
      guildId,
    });
    return this.createGeneralSuccess(
      "Settings Updated",
      `Channel <#${channelId}> has been ${ignore ? "added to" : "removed from"} the ignored channels list.`
    );
  }

  private async toggleIgnoredRole(
    apiUrl: string,
    guildId: string,
    roleId: string,
    ignore: boolean
  ): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ignoredRoles: {
          action: ignore ? "add" : "remove",
          roleId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: ignore ? "ignore-role" : "unignore-role", roleId, guildId });
    return this.createGeneralSuccess(
      "Settings Updated",
      `Role <@&${roleId}> has been ${ignore ? "added to" : "removed from"} the ignored roles list.`
    );
  }

  private async setLevelUpChannel(apiUrl: string, guildId: string, channelId: string | null): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ levelUpChannel: channelId }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: "set-level-up-channel", channelId, guildId });
    return this.createGeneralSuccess(
      "Settings Updated",
      channelId
        ? `Level-up messages will now be sent to <#${channelId}>.`
        : "Level-up messages will now be sent to the same channel where the user gained the level."
    );
  }

  private async setLevelUpMessage(apiUrl: string, guildId: string, message: string): Promise<CommandResponse> {
    const response = await fetch(`${apiUrl}/api/leveling/${guildId}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ levelUpMessage: message }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.success) {
      return this.createGeneralError("API Error", data.error || "Failed to update settings.");
    }

    await this.logCommandUsage("settings", { action: "set-level-up-message", message, guildId });
    return this.createGeneralSuccess(
      "Settings Updated",
      `Level-up message has been updated.\n\nAvailable placeholders: {user}, {level}, {xp}`
    );
  }
}

export default new LevelingSettingsCommand();

export const builder = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure leveling settings for the server")
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("Action to perform")
      .setRequired(true)
      .addChoices(
        { name: "View Settings", value: "view" },
        { name: "Enable Leveling", value: "enable" },
        { name: "Disable Leveling", value: "disable" },
        { name: "Set XP Rate", value: "set-xp-rate" },
        { name: "Set Cooldown", value: "set-cooldown" },
        { name: "Ignore Channel", value: "ignore-channel" },
        { name: "Unignore Channel", value: "unignore-channel" },
        { name: "Ignore Role", value: "ignore-role" },
        { name: "Unignore Role", value: "unignore-role" },
        { name: "Set Level Up Channel", value: "set-level-up-channel" },
        { name: "Set Level Up Message", value: "set-level-up-message" }
      )
  )
  .addIntegerOption((option) =>
    option.setName("xp-rate").setDescription("XP per message (1-100)").setMinValue(1).setMaxValue(100)
  )
  .addIntegerOption((option) =>
    option
      .setName("cooldown")
      .setDescription("Cooldown between XP awards in seconds (10-300)")
      .setMinValue(10)
      .setMaxValue(300)
  )
  .addChannelOption((option) =>
    option.setName("channel").setDescription("Channel to ignore/unignore or set as level-up channel")
  )
  .addRoleOption((option) => option.setName("role").setDescription("Role to ignore/unignore"))
  .addStringOption((option) =>
    option.setName("message").setDescription("Custom level-up message (use {user}, {level}, {xp} placeholders)")
  );
