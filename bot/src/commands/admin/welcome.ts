import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Welcome/Goodbye System Command - Manage welcome messages and auto-role assignment
 */
export class WelcomeCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "welcome",
      description: "Manage welcome messages and auto-role assignment",
      category: "admin",
      permissions: {
        level: PermissionLevel.ADMIN,
        isConfigurable: true,
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

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    try {
      switch (subcommand) {
        case "test":
          return await this.handleTest();
        case "auto-role":
          return await this.handleAutoRole();
        case "message":
          return await this.handleMessage();
        case "stats":
          return await this.handleStats();
        default:
          throw new Error("Unknown subcommand");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createAdminError("Welcome System Error", errorMessage);
    }
  }

  private async handleTest(): Promise<CommandResponse> {
    const type = this.getStringOption("type", true) as "welcome" | "goodbye";
    const testUser = this.getUserOption("user") ?? this.user;

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: this.guild.id },
    });

    if (!config) {
      return this.createAdminError(
        "No Configuration",
        "Welcome system has not been configured yet. Use `/setup welcome` first."
      );
    }

    if (type === "welcome" && !config.welcomeEnabled) {
      return this.createAdminError("Welcome Disabled", "Welcome messages are currently disabled.");
    }

    if (type === "goodbye" && !config.goodbyeEnabled) {
      return this.createAdminError("Goodbye Disabled", "Goodbye messages are currently disabled.");
    }

    const channelId = type === "welcome" ? config.welcomeChannelId : config.goodbyeChannelId;
    if (!channelId) {
      return this.createAdminError(
        "No Channel Set",
        `${type === "welcome" ? "Welcome" : "Goodbye"} channel is not configured.`
      );
    }

    const channel = this.guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) {
      return this.createAdminError("Invalid Channel", `The ${type} channel is not accessible.`);
    }

    // Create test message
    const embed = this.client.genEmbed({
      title: type === "welcome" ? "👋 Welcome!" : "👋 Goodbye!",
      description:
        type === "welcome"
          ? `Welcome to **${this.guild.name}**, ${testUser}! We're glad to have you here.`
          : `Goodbye, ${testUser}! We'll miss you.`,
      color: type === "welcome" ? 0x2ecc71 : 0xe74c3c,
      fields: [
        { name: "👤 User", value: `${testUser} (${testUser.id})`, inline: true },
        { name: "📅 Joined", value: `<t:${Math.floor(testUser.createdAt.getTime() / 1000)}:F>`, inline: true },
        { name: "🎭 Member Count", value: `${this.guild.memberCount}`, inline: true },
      ],
      thumbnail: { url: testUser.displayAvatarURL() },
    });

    try {
      await channel.send({ embeds: [embed] });

      return this.createAdminSuccess("Test Message Sent", `Test ${type} message has been sent to <#${channelId}>.`);
    } catch (error) {
      return this.createAdminError(
        "Failed to Send",
        `Could not send test message to <#${channelId}>. Check bot permissions.`
      );
    }
  }

  private async handleAutoRole(): Promise<CommandResponse> {
    const action = this.getStringOption("action", true) as "add" | "remove" | "list";
    const roleId = this.getStringOption("role");

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: this.guild.id },
    });

    if (!config) {
      return this.createAdminError(
        "No Configuration",
        "Welcome system has not been configured yet. Use `/setup welcome` first."
      );
    }

    const currentRoles = config.moderatorRoleIds;

    switch (action) {
      case "add": {
        if (!roleId) {
          return this.createAdminError("Role Required", "Please specify a role to add.");
        }

        const role = this.guild.roles.cache.get(roleId);
        if (!role) {
          return this.createAdminError("Invalid Role", "The specified role does not exist.");
        }

        if (currentRoles.includes(roleId)) {
          return this.createAdminError("Role Already Added", "This role is already in the auto-role list.");
        }

        const newRoles = [...currentRoles, roleId];
        await prisma.guildConfig.update({
          where: { guildId: this.guild.id },
          data: { moderatorRoleIds: newRoles },
        });

        return this.createAdminSuccess("Auto-Role Added", `Role <@&${roleId}> has been added to the auto-role list.`);
      }

      case "remove": {
        if (!roleId) {
          return this.createAdminError("Role Required", "Please specify a role to remove.");
        }

        if (!currentRoles.includes(roleId)) {
          return this.createAdminError("Role Not Found", "This role is not in the auto-role list.");
        }

        const updatedRoles = currentRoles.filter((id) => id !== roleId);
        await prisma.guildConfig.update({
          where: { guildId: this.guild.id },
          data: { moderatorRoleIds: updatedRoles },
        });

        return this.createAdminSuccess(
          "Auto-Role Removed",
          `Role <@&${roleId}> has been removed from the auto-role list.`
        );
      }

      case "list": {
        if (currentRoles.length === 0) {
          return this.createAdminInfo("No Auto-Roles", "No auto-roles are currently configured.");
        }

        const embed = this.client.genEmbed({
          title: "🎭 Auto-Roles",
          description: "Roles that will be automatically assigned to new members:",
          color: 0x3498db,
          fields: currentRoles.map((roleId, index) => ({
            name: `Role ${index + 1}`,
            value: `<@&${roleId}>`,
            inline: true,
          })),
        });

        return { embeds: [embed], ephemeral: true };
      }
    }
  }

  private async handleMessage(): Promise<CommandResponse> {
    const type = this.getStringOption("type", true) as "welcome" | "goodbye";
    const message = this.getStringOption("message");
    const embedEnabled = this.getBooleanOption("embed-enabled") ?? true;

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: this.guild.id },
    });

    if (!config) {
      return this.createAdminError(
        "No Configuration",
        "Welcome system has not been configured yet. Use `/setup welcome` first."
      );
    }

    // For now, we'll store custom messages in the welcomeStats field
    // In a full implementation, you'd want a dedicated table for this
    const currentStats = config.welcomeStats ?? {};
    currentStats[`${type}Message`] = message;
    currentStats[`${type}EmbedEnabled`] = embedEnabled;

    await prisma.guildConfig.update({
      where: { guildId: this.guild.id },
      data: { welcomeStats: currentStats },
    });

    const embed = this.client.genEmbed({
      title: "✅ Message Updated",
      description: `${type === "welcome" ? "Welcome" : "Goodbye"} message has been updated.`,
      color: 0x2ecc71,
      fields: [
        { name: "📝 Message", value: message ?? "Using default message", inline: false },
        { name: "🎨 Embed Enabled", value: embedEnabled ? "✅ Yes" : "❌ No", inline: true },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleStats(): Promise<CommandResponse> {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: this.guild.id },
    });

    if (!config) {
      return this.createAdminError(
        "No Configuration",
        "Welcome system has not been configured yet. Use `/setup welcome` first."
      );
    }

    // Get recent member joins (last 7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMembers = this.guild.members.cache.filter((member) => member.joinedAt && member.joinedAt > oneWeekAgo);

    const embed = this.client.genEmbed({
      title: "📊 Welcome System Statistics",
      description: "Current configuration and recent activity:",
      color: 0x3498db,
      fields: [
        {
          name: "👋 Welcome Channel",
          value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set",
          inline: true,
        },
        { name: "👋 Welcome Enabled", value: config.welcomeEnabled ? "✅ Yes" : "❌ No", inline: true },
        {
          name: "👋 Goodbye Channel",
          value: config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : "Not set",
          inline: true,
        },
        { name: "👋 Goodbye Enabled", value: config.goodbyeEnabled ? "✅ Yes" : "❌ No", inline: true },
        {
          name: "🎭 Auto-Roles",
          value: config.moderatorRoleIds.length ? config.moderatorRoleIds.map((id) => `<@&${id}>`).join(", ") : "None",
          inline: false,
        },
        { name: "📈 Recent Joins", value: `${recentMembers.size} members in the last 7 days`, inline: true },
        { name: "👥 Total Members", value: `${this.guild.memberCount}`, inline: true },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }
}

// Export the command instance
export default new WelcomeCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Manage welcome messages and auto-role assignment")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Test welcome or goodbye message")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Type of message to test")
          .setRequired(true)
          .addChoices({ name: "Welcome", value: "welcome" }, { name: "Goodbye", value: "goodbye" })
      )
      .addUserOption((option) => option.setName("user").setDescription("User to test with (defaults to you)"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("auto-role")
      .setDescription("Manage auto-role assignment")
      .addStringOption((option) =>
        option
          .setName("action")
          .setDescription("Action to perform")
          .setRequired(true)
          .addChoices(
            { name: "Add Role", value: "add" },
            { name: "Remove Role", value: "remove" },
            { name: "List Roles", value: "list" }
          )
      )
      .addStringOption((option) => option.setName("role").setDescription("Role ID (required for add/remove)"))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("message")
      .setDescription("Set custom welcome or goodbye message")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Type of message")
          .setRequired(true)
          .addChoices({ name: "Welcome", value: "welcome" }, { name: "Goodbye", value: "goodbye" })
      )
      .addStringOption((option) => option.setName("message").setDescription("Custom message (leave empty for default)"))
      .addBooleanOption((option) => option.setName("embed-enabled").setDescription("Enable embed formatting"))
  )
  .addSubcommand((subcommand) => subcommand.setName("stats").setDescription("View welcome system statistics"));
