import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse, SlashCommandInteraction } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * Permissions Command - Manage bot permissions and roles
 */
export class PermissionsCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "permissions",
      description: "ADMIN ONLY: Manage bot permissions and roles",
      category: "admin",
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
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const subcommand = (this.interaction as SlashCommandInteraction).options.getSubcommand();

    try {
      switch (subcommand) {
        case "setrole":
          return await this.handleSetRole();
        case "removerole":
          return await this.handleRemoveRole();
        case "list":
          return await this.handleList();
        case "reset":
          return await this.handleReset();
        case "setcommand":
          return await this.handleSetCommand();
        case "removecommand":
          return await this.handleRemoveCommand();
        case "listcommands":
          return await this.handleListCommands();
        default:
          return {
            content: "❌ Unknown subcommand",
            ephemeral: true,
          };
      }
    } catch (error) {
      logger.error("Error in permissions command:", error);
      return {
        content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleSetRole(): Promise<CommandResponse> {
    const level = this.getStringOption("level", true);
    const role = this.getRoleOption("role", true);

    try {
      // Get or create guild config
      const guildConfig = await prisma.guildConfig.upsert({
        where: { guildId: this.guild.id },
        update: {},
        create: { guildId: this.guild.id },
      });

      // Update the moderator roles array
      const updatedRoles = [...guildConfig.moderatorRoleIds];

      switch (level) {
        case "moderator":
          if (!updatedRoles.includes(role.id)) {
            updatedRoles.push(role.id);
          }
          break;
        default:
          return {
            content: "❌ Invalid permission level. Only 'moderator' is supported for role-based permissions.",
            ephemeral: true,
          };
      }

      await prisma.guildConfig.update({
        where: { id: guildConfig.id },
        data: { moderatorRoleIds: updatedRoles },
      });

      // Notify API of permission configuration change
      const customClient = this.client as any as Client;
      if (customClient.queueService) {
        try {
          await customClient.queueService.processRequest({
            type: "CONFIG_UPDATE",
            data: {
              guildId: this.guild.id,
              section: "PERMISSIONS",
              changes: { moderatorRoleIds: updatedRoles },
              action: "SET_PERMISSION_ROLE",
              updatedBy: this.user.id,
            },
            source: "rest",
            userId: this.user.id,
            guildId: this.guild.id,
            requiresReliability: true,
          });
        } catch (error) {
          console.warn("Failed to notify API of permission change:", error);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Permission Role Set")
        .setDescription(`**Moderator** role has been added: ${role}.`)
        .addFields({
          name: "📋 Details",
          value: [`**Level:** Moderator`, `**Role:** ${role}`, `**Role ID:** \`${role.id}\``].join("\n"),
          inline: false,
        })
        .setTimestamp();

      // Log permission change
      await this.client.logManager.log(this.guild.id, "PERMISSION_CONFIG", {
        userId: this.user.id,
        metadata: {
          action: "SET_ROLE",
          level,
          roleId: role.id,
          roleName: role.name,
        },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error setting permission role:", error);
      return {
        content: `❌ Failed to set permission role: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleRemoveRole(): Promise<CommandResponse> {
    const level = this.getStringOption("level", true);
    const role = this.getRoleOption("role");

    try {
      // Get guild config
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      if (!guildConfig) {
        return {
          content: "❌ No permission configuration found for this server.",
          ephemeral: true,
        };
      }

      let updatedRoles = [...guildConfig.moderatorRoleIds];
      let removedRoleId: string | null = null;

      switch (level) {
        case "moderator":
          if (role) {
            // Remove specific role
            const index = updatedRoles.indexOf(role.id);
            if (index > -1) {
              updatedRoles.splice(index, 1);
              removedRoleId = role.id;
            } else {
              return {
                content: `❌ Role ${role} is not currently set as a moderator role.`,
                ephemeral: true,
              };
            }
          } else {
            // Remove all moderator roles
            if (updatedRoles.length === 0) {
              return {
                content: "❌ No moderator roles are currently set.",
                ephemeral: true,
              };
            }
            updatedRoles = [];
            removedRoleId = "all";
          }
          break;
        default:
          return {
            content: "❌ Invalid permission level",
            ephemeral: true,
          };
      }

      await prisma.guildConfig.update({
        where: { id: guildConfig.id },
        data: { moderatorRoleIds: updatedRoles },
      });

      // Notify API of permission configuration change
      const customClient = this.client as any as Client;
      if (customClient.queueService) {
        try {
          await customClient.queueService.processRequest({
            type: "CONFIG_UPDATE",
            data: {
              guildId: this.guild.id,
              section: "PERMISSIONS",
              changes: { moderatorRoleIds: updatedRoles },
              action: "REMOVE_PERMISSION_ROLE",
              updatedBy: this.user.id,
            },
            source: "rest",
            userId: this.user.id,
            guildId: this.guild.id,
            requiresReliability: true,
          });
        } catch (error) {
          console.warn("Failed to notify API of permission change:", error);
        }
      }

      const removedRoleDisplay = role ? role.toString() : "All moderator roles";

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ Permission Role Removed")
        .setDescription(`**Moderator** role(s) have been removed.`)
        .addFields({
          name: "📋 Details",
          value: [`**Level:** Moderator`, `**Removed:** ${removedRoleDisplay}`].join("\n"),
          inline: false,
        })
        .setTimestamp();

      // Log permission change
      await this.client.logManager.log(this.guild.id, "PERMISSION_CONFIG", {
        userId: this.user.id,
        metadata: {
          action: "REMOVE_ROLE",
          level,
          roleId: removedRoleId,
          roleName: role?.name ?? "All",
        },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error removing permission role:", error);
      return {
        content: `❌ Failed to remove permission role: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleList(): Promise<CommandResponse> {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🔐 Permission Roles Configuration")
        .setTimestamp()
        .setFooter({ text: `Server: ${this.guild.name}` });

      if (!guildConfig || guildConfig.moderatorRoleIds.length === 0) {
        embed.setDescription("❌ No permission roles configured for this server.");
        embed.addFields({
          name: "💡 Getting Started",
          value: "Use `/permissions setrole` to configure permission roles.",
          inline: false,
        });

        return { embeds: [embed], ephemeral: true };
      }

      // Moderator roles
      const moderatorRoles = guildConfig.moderatorRoleIds
        .map((roleId) => this.guild.roles.cache.get(roleId))
        .filter((role) => role !== undefined)
        .map((role) => role.toString());

      embed.addFields({
        name: "🛡️ Moderator Roles",
        value: moderatorRoles.length > 0 ? moderatorRoles.join("\n") : "None configured",
        inline: false,
      });

      embed.setDescription(
        `**${moderatorRoles.length}** moderator role${moderatorRoles.length === 1 ? "" : "s"} configured.\n\n` +
          "**Note:** Server owners always have full access regardless of role configuration."
      );

      // Add hierarchy information
      embed.addFields({
        name: "📊 Permission Hierarchy",
        value: [
          "**Owner** - Full access (automatic)",
          "**Administrator** - All commands (Discord permission)",
          "**Moderator** - Moderation commands (configured roles)",
          "**Members** - General commands only",
        ].join("\n"),
        inline: false,
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error listing permission roles:", error);
      return {
        content: `❌ Failed to list permission roles: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleReset(): Promise<CommandResponse> {
    try {
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: this.guild.id },
      });

      if (!guildConfig || guildConfig.moderatorRoleIds.length === 0) {
        return {
          content: "❌ No permission configuration found to reset.",
          ephemeral: true,
        };
      }

      // Reset all permission role configurations
      await prisma.guildConfig.update({
        where: { id: guildConfig.id },
        data: {
          moderatorRoleIds: [],
        },
      });

      // Also clear all command permissions
      await prisma.commandPermission.deleteMany({
        where: { guildId: this.guild.id },
      });

      // Notify API of permission reset
      const customClient = this.client as any as Client;
      if (customClient.queueService) {
        try {
          await customClient.queueService.processRequest({
            type: "CONFIG_UPDATE",
            data: {
              guildId: this.guild.id,
              section: "PERMISSIONS",
              changes: {
                moderatorRoleIds: [],
                commandPermissions: "cleared",
              },
              action: "RESET_PERMISSION_ROLES",
              updatedBy: this.user.id,
            },
            source: "rest",
            userId: this.user.id,
            guildId: this.guild.id,
            requiresReliability: true,
          });
        } catch (error) {
          console.warn("Failed to notify API of permission reset:", error);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle("🔄 Permission Configuration Reset")
        .setDescription("All permission configurations have been reset.")
        .addFields({
          name: "📋 Changes",
          value: ["**Moderator Roles:** Cleared", "**Command Permissions:** Cleared"].join("\n"),
          inline: false,
        })
        .addFields({
          name: "⚠️ Important",
          value:
            "Only server owners and users with Administrator permission will have access to admin commands until new roles are configured.",
          inline: false,
        })
        .setTimestamp();

      // Log permission reset
      await this.client.logManager.log(this.guild.id, "PERMISSION_CONFIG", {
        userId: this.user.id,
        metadata: {
          action: "RESET_ALL",
        },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error resetting permission roles:", error);
      return {
        content: `❌ Failed to reset permission roles: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleSetCommand(): Promise<CommandResponse> {
    const commandName = this.getStringOption("command", true);
    const level = this.getStringOption("permission_level", true);
    const roles = this.getStringOption("roles");

    try {
      const requiredRoles = roles ? roles.split(",").map((r) => r.trim()) : [];

      // Validate permission level
      const validLevels = ["OWNER", "ADMIN", "MODERATOR", "HELPER", "MEMBER"];
      if (!validLevels.includes(level)) {
        return {
          content: `❌ Invalid permission level. Valid levels: ${validLevels.join(", ")}`,
          ephemeral: true,
        };
      }

      // Create or update command permission
      const commandPermission = await prisma.commandPermission.upsert({
        where: {
          guildId_commandName: {
            guildId: this.guild.id,
            commandName: commandName,
          },
        },
        update: {
          permissionLevel: level,
          requiredRoles: requiredRoles,
          updatedAt: new Date(),
        },
        create: {
          guildId: this.guild.id,
          commandName: commandName,
          permissionLevel: level,
          requiredRoles: requiredRoles,
          createdBy: this.user.id,
        },
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Command Permission Set")
        .setDescription(`Permission for command \`${commandName}\` has been configured.`)
        .addFields({
          name: "📋 Configuration",
          value: [
            `**Command:** \`${commandName}\``,
            `**Permission Level:** ${level}`,
            `**Required Roles:** ${requiredRoles.length > 0 ? requiredRoles.map((r) => `<@&${r}>`).join(", ") : "None"}`,
          ].join("\n"),
          inline: false,
        })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error setting command permission:", error);
      return {
        content: `❌ Failed to set command permission: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleRemoveCommand(): Promise<CommandResponse> {
    const commandName = this.getStringOption("command", true);

    try {
      const deleted = await prisma.commandPermission.deleteMany({
        where: {
          guildId: this.guild.id,
          commandName: commandName,
        },
      });

      if (deleted.count === 0) {
        return {
          content: `❌ No custom permission found for command \`${commandName}\`.`,
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ Command Permission Removed")
        .setDescription(`Custom permission for command \`${commandName}\` has been removed.`)
        .addFields({
          name: "ℹ️ Info",
          value: "The command will now use its default permission requirements.",
          inline: false,
        })
        .setTimestamp();

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error removing command permission:", error);
      return {
        content: `❌ Failed to remove command permission: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }

  private async handleListCommands(): Promise<CommandResponse> {
    try {
      const commandPermissions = await prisma.commandPermission.findMany({
        where: { guildId: this.guild.id },
        orderBy: { commandName: "asc" },
      });

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🔐 Command Permissions")
        .setTimestamp()
        .setFooter({ text: `Server: ${this.guild.name}` });

      if (commandPermissions.length === 0) {
        embed.setDescription("❌ No custom command permissions configured.");
        embed.addFields({
          name: "💡 Getting Started",
          value: "Use `/permissions setcommand` to configure command permissions.",
          inline: false,
        });

        return { embeds: [embed], ephemeral: true };
      }

      const permissionList = commandPermissions
        .map((cp) => {
          const roles = cp.requiredRoles
            .map((roleId) => this.guild.roles.cache.get(roleId)?.toString() ?? `<@&${roleId}>`)
            .join(", ");

          return `**\`${cp.commandName}\`**\n└ Level: ${cp.permissionLevel}${roles ? `\n└ Roles: ${roles}` : ""}`;
        })
        .join("\n\n");

      embed.setDescription(
        `**${commandPermissions.length}** command${commandPermissions.length === 1 ? "" : "s"} with custom permissions:\n\n${permissionList}`
      );

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      logger.error("Error listing command permissions:", error);
      return {
        content: `❌ Failed to list command permissions: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new PermissionsCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("permissions")
  .setDescription("ADMIN ONLY: Manage bot permissions and roles")
  .addSubcommand((sub) =>
    sub
      .setName("setrole")
      .setDescription("Add a role to a permission level")
      .addStringOption((opt) =>
        opt
          .setName("level")
          .setDescription("Permission level")
          .setRequired(true)
          .addChoices({ name: "Moderator", value: "moderator" })
      )
      .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign to this level").setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName("removerole")
      .setDescription("Remove a role from a permission level")
      .addStringOption((opt) =>
        opt
          .setName("level")
          .setDescription("Permission level")
          .setRequired(true)
          .addChoices({ name: "Moderator", value: "moderator" })
      )
      .addRoleOption((opt) => opt.setName("role").setDescription("Specific role to remove (leave empty to remove all)"))
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List current permission role configuration"))
  .addSubcommand((sub) => sub.setName("reset").setDescription("Reset all permission configurations"))
  .addSubcommand((sub) =>
    sub
      .setName("setcommand")
      .setDescription("Set custom permission for a specific command")
      .addStringOption((opt) => opt.setName("command").setDescription("Command name").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("permission_level")
          .setDescription("Required permission level")
          .setRequired(true)
          .addChoices(
            { name: "Owner", value: "OWNER" },
            { name: "Admin", value: "ADMIN" },
            { name: "Moderator", value: "MODERATOR" },
            { name: "Helper", value: "HELPER" },
            { name: "Member", value: "MEMBER" }
          )
      )
      .addStringOption((opt) =>
        opt.setName("roles").setDescription("Comma-separated list of required role IDs (optional)")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("removecommand")
      .setDescription("Remove custom permission for a specific command")
      .addStringOption((opt) => opt.setName("command").setDescription("Command name").setRequired(true))
  )
  .addSubcommand((sub) => sub.setName("listcommands").setDescription("List all custom command permissions"));
