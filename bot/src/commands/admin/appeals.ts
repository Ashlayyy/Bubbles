import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { SlashCommandInteraction } from "../_core/types.js";

import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

// Quick Setup Handler
async function _handleQuickSetup(client: Client, interaction: GuildChatInputCommandInteraction) {
  const channelId = interaction.options.getChannel("channel")?.id;

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      enabled: true,
      appealChannelId: channelId,
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Appeals System Quick Setup Complete")
      .setColor(0x2ecc71)
      .setDescription("Appeals system has been configured successfully!")
      .addFields(
        { name: "🔘 Status", value: "✅ Enabled", inline: true },
        { name: "📝 Channel", value: channelId ? `<#${channelId}>` : "Not set", inline: true },
        { name: "🌐 Website", value: "Default URL", inline: true }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });

    // Log the quick setup
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "quick_setup",
        channelId,
      },
    });
  } catch (error) {
    logger.error("Error in appeals quick setup:", error);
    await interaction.followUp({
      content: "❌ Failed to configure appeals system. Please try again.",
      ephemeral: true,
    });
  }
}

// Status Handler
async function _handleStatus(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    const settings = await client.moderationManager.getAppealsSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle("⚖️ Appeals System Status")
      .setColor(0x3498db)
      .addFields(
        { name: "🔘 Discord Bot", value: settings.discordBotEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "🌐 Web Form", value: settings.webFormEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        {
          name: "📝 Channel",
          value:
            "appealChannelId" in settings && settings.appealChannelId ? `<#${settings.appealChannelId}>` : "Not set",
          inline: true,
        },
        { name: "⏰ Cooldown", value: `${settings.appealCooldown / 3600} hours`, inline: true },
        { name: "🔢 Max Appeals", value: `${settings.maxAppealsPerUser} per user`, inline: true }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error getting appeals status:", error);
    await interaction.followUp({
      content: "❌ Failed to get appeals status. Please try again.",
      ephemeral: true,
    });
  }
}

// Toggle Handler
async function _handleToggle(client: Client, interaction: GuildChatInputCommandInteraction) {
  const enable = interaction.options.getSubcommand() === "enable";

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      enabled: enable,
    });

    await interaction.followUp({
      content: `${enable ? "✅" : "❌"} Appeals system has been **${enable ? "enabled" : "disabled"}**.`,
      ephemeral: true,
    });

    // Log the toggle
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "toggle",
        enabled: enable,
      },
    });
  } catch (error) {
    logger.error("Error toggling appeals system:", error);
    await interaction.followUp({
      content: "❌ Failed to toggle appeals system. Please try again.",
      ephemeral: true,
    });
  }
}

// Messages Handler
async function _handleMessages(client: Client, interaction: GuildChatInputCommandInteraction) {
  const received = interaction.options.getString("received");
  const approved = interaction.options.getString("approved");
  const denied = interaction.options.getString("denied");

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      appealReceived: received ?? undefined,
      appealApproved: approved ?? undefined,
      appealDenied: denied ?? undefined,
    });

    const embed = new EmbedBuilder().setTitle("✅ Appeal Messages Updated").setColor(0x2ecc71).setTimestamp();

    if (received) embed.addFields({ name: "📥 Received Message", value: received, inline: false });
    if (approved) embed.addFields({ name: "✅ Approved Message", value: approved, inline: false });
    if (denied) embed.addFields({ name: "❌ Denied Message", value: denied, inline: false });

    if (!received && !approved && !denied) {
      embed.setDescription("No messages were updated. Use the options to set custom messages.");
    }

    await interaction.followUp({ embeds: [embed], ephemeral: true });

    // Log the message update
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "messages",
        messagesUpdated: { received, approved, denied },
      },
    });
  } catch (error) {
    logger.error("Error updating appeal messages:", error);
    await interaction.followUp({
      content: "❌ Failed to update appeal messages. Please try again.",
      ephemeral: true,
    });
  }
}

/**
 * Appeals Command - Manage appeals configuration
 */
export class AppealsCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "appeals",
      description: "Manage appeals configuration",
      category: "admin",
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    // Validate admin permissions for server management
    this.validateAdminPerms(["ManageGuild"]);

    // Ensure this is a slash command interaction
    if (!this.isSlashCommand()) {
      throw new Error("This command must be used as a slash command.");
    }

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    switch (subcommand) {
      case "enable":
        return await this.handleEnable();
      case "disable":
        return await this.handleDisable();
      case "config":
        return await this.handleConfig();
      default:
        throw new Error("Invalid subcommand");
    }
  }

  private async handleEnable(): Promise<CommandResponse> {
    try {
      await this.client.moderationManager.configureAppealsSettings(this.guild.id, {
        enabled: true,
      });

      return this.createAdminSuccess(
        "Appeals System Enabled",
        "The appeals system has been enabled for this server. Users can now submit appeals for their bans/mutes."
      );
    } catch (error) {
      throw new Error(`Failed to enable appeals: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async handleDisable(): Promise<CommandResponse> {
    try {
      await this.client.moderationManager.configureAppealsSettings(this.guild.id, {
        enabled: false,
      });

      return this.createAdminSuccess(
        "Appeals System Disabled",
        "The appeals system has been disabled for this server."
      );
    } catch (error) {
      throw new Error(`Failed to disable appeals: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async handleConfig(): Promise<CommandResponse> {
    try {
      if (!this.isSlashCommand()) {
        throw new Error("This command must be used as a slash command.");
      }

      const slash = this.interaction as SlashCommandInteraction;

      const channelId = slash.options.getChannel("channel")?.id ?? undefined;

      await this.client.moderationManager.configureAppealsSettings(this.guild.id, {
        appealChannelId: channelId,
      });

      return this.createAdminSuccess(
        "Appeals Configuration Updated",
        "Appeals configuration has been updated successfully."
      );
    } catch (error) {
      throw new Error(`Failed to update appeals config: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// Export the command instance
export default new AppealsCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("appeals")
  .setDescription("Manage appeals configuration")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand.setName("enable").setDescription("Enable the appeals system for this server")
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("disable").setDescription("Disable the appeals system for this server")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("config")
      .setDescription("Configure appeals settings")
      .addChannelOption((option) =>
        option.setName("channel").setDescription("Channel where appeals will be sent").setRequired(false)
      )
  );
