import { GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import PermissionManager from "../../structures/PermissionManager.js";
import type { CommandPermissionConfig } from "../../structures/PermissionTypes.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Helper interfaces for type safety
interface MaintenanceData {
  reason?: string;
  enabledBy: string;
  isEnabled: boolean;
  allowedUsers: string[];
}

interface CommandPermissionData {
  permissionLevel: string;
  isConfigurable: boolean;
  requiredRoles: string[];
  allowedUsers: string[];
  deniedUsers: string[];
}

interface AuditLogEntry {
  action: string;
  timestamp: Date;
  userId: string;
  commandName?: string;
  reason?: string;
}

export default new Command(
  new SlashCommandBuilder()
    .setName("permissions")
    .setDescription("ADMIN ONLY: Manage command permissions")
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check your permissions or another user's permissions")
        .addUserOption((opt) => opt.setName("user").setDescription("User to check permissions for (optional)"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set permissions for a command")
        .addStringOption((opt) =>
          opt.setName("command").setDescription("Command name").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("level")
            .setDescription("Permission level")
            .setRequired(true)
            .addChoices(
              { name: "Public", value: "PUBLIC" },
              { name: "Moderator", value: "MODERATOR" },
              { name: "Admin", value: "ADMIN" },
              { name: "Owner", value: "OWNER" },
              { name: "Custom", value: "CUSTOM" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("roles").setDescription("Required role IDs (comma separated)").setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("users").setDescription("Allowed user IDs (comma separated)").setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List command permissions")
        .addStringOption((opt) => opt.setName("command").setDescription("Specific command to check"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset command to default permissions")
        .addStringOption((opt) => opt.setName("command").setDescription("Command name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("audit")
        .setDescription("View permission audit log")
        .addStringOption((opt) => opt.setName("command").setDescription("Filter by command"))
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("Number of entries to show").setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("maintenance")
        .setDescription("Manage maintenance mode")
        .addSubcommand((sub) =>
          sub
            .setName("enable")
            .setDescription("Enable maintenance mode")
            .addStringOption((opt) => opt.setName("reason").setDescription("Reason for maintenance"))
        )
        .addSubcommand((sub) => sub.setName("disable").setDescription("Disable maintenance mode"))
        .addSubcommand((sub) => sub.setName("status").setDescription("Check maintenance mode status"))
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply({ flags: 64 /* MessageFlags.Ephemeral */ });
    const permissionManager = new PermissionManager();
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    try {
      // Handle maintenance subcommand group
      if (subcommandGroup === "maintenance") {
        switch (subcommand) {
          case "enable": {
            const reason = interaction.options.getString("reason") ?? "No reason provided";

            await permissionManager.enableMaintenanceMode(interaction.guildId, reason, interaction.user.id);

            await interaction.followUp({
              content: `✅ Maintenance mode enabled. Reason: ${reason}`,
              flags: MessageFlags.Ephemeral,
            });
            break;
          }

          case "disable": {
            await permissionManager.disableMaintenanceMode(interaction.guildId, interaction.user.id);

            await interaction.followUp({
              content: `✅ Maintenance mode disabled.`,
              flags: MessageFlags.Ephemeral,
            });
            break;
          }

          case "status": {
            const isEnabled = await permissionManager.isMaintenanceMode(interaction.guildId);

            try {
              const maintenanceData = await permissionManager.getMaintenanceMode(interaction.guildId);

              if (isEnabled && maintenanceData) {
                const data = maintenanceData as MaintenanceData;
                await interaction.followUp({
                  content: `🚧 Maintenance mode is **enabled**\nReason: ${data.reason ?? "No reason"}\nEnabled by: <@${data.enabledBy}>`,
                  flags: MessageFlags.Ephemeral,
                });
              } else {
                await interaction.followUp({
                  content: `✅ Maintenance mode is **disabled**`,
                  flags: MessageFlags.Ephemeral,
                });
              }
            } catch (error) {
              logger.error("Error getting maintenance mode data", error);
              await interaction.followUp({
                content: `✅ Maintenance mode is **${isEnabled ? "enabled" : "disabled"}**`,
                flags: MessageFlags.Ephemeral,
              });
            }
            break;
          }
        }
        return;
      }

      // Handle permission subcommands
      switch (subcommand) {
        case "check": {
          const targetUser = interaction.options.getUser("user");
          let targetMember: GuildMember;

          if (targetUser) {
            if (!interaction.guild) {
              await interaction.followUp({
                content: "❌ This command can only be used in a server.",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
            try {
              targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
              await interaction.followUp({
                content: "❌ Could not find the specified user in this server.",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
          } else {
            targetMember = interaction.member as GuildMember;
          }

          // Determine user's effective permission level
          let effectiveLevel = PermissionLevel.PUBLIC;
          const userRoles = targetMember.roles.cache.map((role) => role.name).join(", ");
          const isDeveloper = process.env.DEVELOPER_USER_IDS?.split(",").includes(targetMember.user.id) ?? false;
          const isOwner = targetMember.guild.ownerId === targetMember.user.id;
          const isAdmin = targetMember.permissions.has("Administrator");

          if (isDeveloper) {
            effectiveLevel = PermissionLevel.DEVELOPER;
          } else if (isOwner) {
            effectiveLevel = PermissionLevel.OWNER;
          } else if (isAdmin) {
            effectiveLevel = PermissionLevel.ADMIN;
          } else if (
            targetMember.permissions.has(["ModerateMembers", "ManageMessages", "KickMembers", "BanMembers"], false)
          ) {
            effectiveLevel = PermissionLevel.MODERATOR;
          }

          // Check access to different command categories
          const testCommands = ["ping", "help", "clear", "embed"];
          const accessResults = [];

          for (const commandName of testCommands) {
            const command = client.commands.get(commandName);
            if (command) {
              const result = await permissionManager.checkPermission(targetMember, commandName, interaction.guildId);
              accessResults.push({
                command: commandName,
                category: command.category,
                access: result.allowed,
                reason: result.reason,
              });
            }
          }

          const embed = client.genEmbed({
            title: `Permission Check${targetUser ? ` - ${targetUser.displayName}` : ""}`,
            description: targetUser ? `Checking permissions for <@${targetUser.id}>` : "Checking your permissions",
            fields: [
              {
                name: "📊 Basic Information",
                value: [
                  `**User:** <@${targetMember.user.id}>`,
                  `**Effective Level:** \`${effectiveLevel}\``,
                  `**Is Owner:** ${isOwner ? "✅" : "❌"}`,
                  `**Is Admin:** ${isAdmin ? "✅" : "❌"}`,
                  `**Is Developer:** ${isDeveloper ? "✅" : "❌"}`,
                ].join("\n"),
                inline: false,
              },
              {
                name: "🎭 Roles",
                value: userRoles || "No roles",
                inline: false,
              },
              {
                name: "🔐 Command Access Examples",
                value:
                  accessResults
                    .map(
                      (result) =>
                        `**${result.command}** (\`${result.category}\`): ${result.access ? "✅" : "❌"}${result.reason && !result.access ? ` - ${result.reason}` : ""}`
                    )
                    .join("\n") || "No commands tested",
                inline: false,
              },
              {
                name: "ℹ️ Note",
                value:
                  "This shows your effective permission level and access to sample commands. Individual commands may have custom permissions that override these defaults.",
                inline: false,
              },
            ],
            color: isDeveloper ? 0xff0000 : isOwner ? 0xffd700 : isAdmin ? 0xff6b35 : 0x00ff00,
          });

          await interaction.followUp({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        case "set": {
          const commandName = interaction.options.getString("command", true);
          const level = interaction.options.getString("level", true) as PermissionLevel;
          const rolesStr = interaction.options.getString("roles");
          const usersStr = interaction.options.getString("users");

          // Check if command exists
          const command = client.commands.get(commandName);
          if (!command) {
            await interaction.followUp({
              content: `❌ Command \`${commandName}\` not found.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Check if command is configurable
          try {
            const existingPermission = await permissionManager.getCommandPermission(interaction.guildId, commandName);
            if (existingPermission && !(existingPermission as CommandPermissionData).isConfigurable) {
              await interaction.followUp({
                content: `❌ Command \`${commandName}\` permissions cannot be modified.`,
                flags: MessageFlags.Ephemeral,
              });
              return;
            }
          } catch (error) {
            logger.error("Error checking command permissions", error);
            // Continue with setting permissions if we can't check existing ones
          }

          const permissionConfig: CommandPermissionConfig = {
            level: level,
            isConfigurable: level === PermissionLevel.CUSTOM,
            requiredRoles:
              rolesStr
                ?.split(",")
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0) ?? [],
            allowedUsers:
              usersStr
                ?.split(",")
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0) ?? [],
            deniedUsers: [],
          };

          await permissionManager.setCommandPermission(
            interaction.guildId,
            commandName,
            permissionConfig,
            interaction.user.id
          );

          let details = `Level: \`${level}\``;
          if (permissionConfig.requiredRoles && permissionConfig.requiredRoles.length > 0) {
            details += `\nRequired roles: ${permissionConfig.requiredRoles.map((id) => `<@&${id}>`).join(", ")}`;
          }
          if (permissionConfig.allowedUsers && permissionConfig.allowedUsers.length > 0) {
            details += `\nAllowed users: ${permissionConfig.allowedUsers.map((id) => `<@${id}>`).join(", ")}`;
          }

          await interaction.followUp({
            content: `✅ Updated permissions for \`${commandName}\`\n${details}`,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        case "list": {
          const commandName = interaction.options.getString("command");

          if (commandName) {
            // Show specific command permissions
            try {
              const permission = await permissionManager.getCommandPermission(interaction.guildId, commandName);
              const command = client.commands.get(commandName);

              if (!command) {
                await interaction.followUp({
                  content: `❌ Command \`${commandName}\` not found.`,
                  flags: MessageFlags.Ephemeral,
                });
                return;
              }

              if (permission) {
                const permData = permission as CommandPermissionData;
                let details = `**${commandName}** (Custom)\n`;
                details += `Level: \`${permData.permissionLevel}\`\n`;
                details += `Configurable: ${permData.isConfigurable ? "✅" : "❌"}\n`;

                if (permData.requiredRoles.length > 0) {
                  details += `Required roles: ${permData.requiredRoles.map((id) => `<@&${id}>`).join(", ")}\n`;
                }
                if (permData.allowedUsers.length > 0) {
                  details += `Allowed users: ${permData.allowedUsers.map((id) => `<@${id}>`).join(", ")}\n`;
                }
                if (permData.deniedUsers.length > 0) {
                  details += `Denied users: ${permData.deniedUsers.map((id) => `<@${id}>`).join(", ")}\n`;
                }

                await interaction.followUp({
                  content: details,
                  flags: MessageFlags.Ephemeral,
                });
              } else {
                // Show default permissions
                const defaultLevel = command.defaultPermissions.level;
                await interaction.followUp({
                  content: `**${commandName}** (Default)\nLevel: \`${defaultLevel}\`\nCategory: \`${command.category}\``,
                  flags: MessageFlags.Ephemeral,
                });
              }
            } catch (error) {
              logger.error("Error getting command permissions", error);
              await interaction.followUp({
                content: `❌ Error retrieving permissions for command \`${commandName}\`.`,
                flags: MessageFlags.Ephemeral,
              });
            }
          } else {
            // Show all commands with custom permissions
            const embed = client.genEmbed({
              title: "Custom Command Permissions",
              description: "Commands with custom permission settings",
              fields: [],
            });

            // This would need pagination for large lists, keeping simple for now
            await interaction.followUp({
              content: "Use `/permissions list <command>` to view specific command permissions.",
              embeds: [embed],
              flags: MessageFlags.Ephemeral,
            });
          }
          break;
        }

        case "reset": {
          const commandName = interaction.options.getString("command", true);

          // Check if command exists
          const command = client.commands.get(commandName);
          if (!command) {
            await interaction.followUp({
              content: `❌ Command \`${commandName}\` not found.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await permissionManager.resetCommandPermission(interaction.guildId, commandName, interaction.user.id);

          await interaction.followUp({
            content: `✅ Command \`${commandName}\` reset to default permissions.`,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }

        case "audit": {
          const commandName = interaction.options.getString("command");
          const limit = interaction.options.getInteger("limit") ?? 10;

          try {
            const auditLog = await permissionManager.getAuditLog(interaction.guildId, limit, commandName ?? undefined);

            if (!Array.isArray(auditLog) || auditLog.length === 0) {
              await interaction.followUp({
                content: "No audit log entries found.",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }

            const embed = client.genEmbed({
              title: `Permission Audit Log${commandName ? ` - ${commandName}` : ""}`,
              description: `Showing last ${auditLog.length} entries`,
              fields: auditLog.map((entry) => {
                const auditEntry = entry as AuditLogEntry;
                return {
                  name: `${auditEntry.action} - ${auditEntry.timestamp.toLocaleString()}`,
                  value: `User: <@${auditEntry.userId}>${auditEntry.commandName ? `\nCommand: \`${auditEntry.commandName}\`` : ""}${auditEntry.reason ? `\nReason: ${auditEntry.reason}` : ""}`,
                  inline: false,
                };
              }),
            });

            await interaction.followUp({
              embeds: [embed],
              flags: MessageFlags.Ephemeral,
            });
          } catch (error) {
            logger.error("Error getting audit log", error);
            await interaction.followUp({
              content: "❌ Error retrieving audit log.",
              flags: MessageFlags.Ephemeral,
            });
          }
          break;
        }

        default: {
          await interaction.followUp({
            content: "❌ Unknown subcommand",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (error) {
      logger.error("Error in permissions command", error);
      await interaction.followUp({
        content: "❌ An error occurred while processing the command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: false, // This command itself cannot be reconfigured
    },
  }
);
