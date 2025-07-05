import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { ResponseBuilder, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { AdminCommand } from "../_core/specialized/AdminCommand.js";

/**
 * RBAC Command - Manage Role-Based Access Control
 */
export class RBACCommand extends AdminCommand {
  constructor() {
    const config: CommandConfig = {
      name: "rbac",
      description: "Manage Role-Based Access Control",
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

    const interaction = this.interaction as import("discord.js").ChatInputCommandInteraction;
    const group = interaction.options.getSubcommandGroup();

    try {
      if (group === "role") {
        return await this.handleRoleSubcommand();
      } else if (group === "user") {
        return await this.handleUserSubcommand();
      } else {
        return this.createAdminError("Invalid Group", "Unknown subcommand group");
      }
    } catch (error) {
      return this.createAdminError(
        "RBAC Error",
        `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleRoleSubcommand(): Promise<CommandResponse> {
    const interaction = this.interaction as import("discord.js").ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();
    const roleName = interaction.options.getString("role");
    const permission = interaction.options.getString("permission");

    switch (subcommand) {
      case "create": {
        const newRoleName = this.getStringOption("name", true);
        const existingRole = await prisma.customRole.findUnique({
          where: { guildId_name: { guildId: this.guild.id, name: newRoleName } },
        });
        if (existingRole) {
          return this.createAdminError("Role Exists", `Role \`${newRoleName}\` already exists.`);
        }
        await prisma.customRole.create({
          data: {
            guildId: this.guild.id,
            name: newRoleName,
            permissions: [],
          },
        });
        return new ResponseBuilder()
          .success("Role Created")
          .content(`✅ Created role \`${newRoleName}\`.`)
          .ephemeral()
          .build();
      }

      case "delete": {
        if (!roleName) {
          return this.createAdminError("Missing Parameter", "Role name is required");
        }
        const role = await prisma.customRole.findUnique({
          where: { guildId_name: { guildId: this.guild.id, name: roleName } },
        });
        if (!role) {
          return this.createAdminError("Role Not Found", `Role \`${roleName}\` not found.`);
        }
        await prisma.customRole.delete({ where: { guildId_name: { guildId: this.guild.id, name: roleName } } });
        // Also delete assignments
        await prisma.customRoleAssignment.deleteMany({ where: { roleId: role.id } });
        return new ResponseBuilder()
          .success("Role Deleted")
          .content(`✅ Deleted role \`${roleName}\`.`)
          .ephemeral()
          .build();
      }

      case "list": {
        const roles = await prisma.customRole.findMany({ where: { guildId: this.guild.id } });
        if (roles.length === 0) {
          return new ResponseBuilder().info("No Roles").content("No custom roles found.").ephemeral().build();
        }

        const rolesWithCounts = await Promise.all(
          roles.map(async (role) => {
            const count = await prisma.customRoleAssignment.count({ where: { roleId: role.id } });
            return { ...role, userCount: count };
          })
        );

        const embed = new EmbedBuilder()
          .setTitle("Custom Roles")
          .setColor("Blue")
          .setDescription(
            rolesWithCounts
              .map(
                (r) => `**${r.name}** (${r.userCount} users)\nPermissions: \`${r.permissions.join(", ") || "None"}\``
              )
              .join("\n\n")
          );
        return { embeds: [embed], ephemeral: true };
      }

      case "permission_add": {
        if (!roleName || !permission) {
          return this.createAdminError("Missing Parameters", "Role name and permission are required");
        }
        const role = await prisma.customRole.findUnique({
          where: { guildId_name: { guildId: this.guild.id, name: roleName } },
        });
        if (!role) {
          return this.createAdminError("Role Not Found", `Role \`${roleName}\` not found.`);
        }
        if (role.permissions.includes(permission)) {
          return this.createAdminError(
            "Permission Exists",
            `Role \`${roleName}\` already has the permission \`${permission}\`.`
          );
        }
        await prisma.customRole.update({
          where: { guildId_name: { guildId: this.guild.id, name: roleName } },
          data: { permissions: { push: permission } },
        });
        return new ResponseBuilder()
          .success("Permission Added")
          .content(`✅ Added permission \`${permission}\` to role \`${roleName}\`.`)
          .ephemeral()
          .build();
      }

      case "permission_remove": {
        if (!roleName || !permission) {
          return this.createAdminError("Missing Parameters", "Role name and permission are required");
        }
        const role = await prisma.customRole.findUnique({
          where: { guildId_name: { guildId: this.guild.id, name: roleName } },
        });
        if (!role) {
          return this.createAdminError("Role Not Found", `Role \`${roleName}\` not found.`);
        }
        if (!role.permissions.includes(permission)) {
          return this.createAdminError(
            "Permission Not Found",
            `Role \`${roleName}\` does not have the permission \`${permission}\`.`
          );
        }
        const newPermissions = role.permissions.filter((p) => p !== permission);
        await prisma.customRole.update({
          where: { guildId_name: { guildId: this.guild.id, name: roleName } },
          data: { permissions: newPermissions },
        });
        return new ResponseBuilder()
          .success("Permission Removed")
          .content(`✅ Removed permission \`${permission}\` from role \`${roleName}\`.`)
          .ephemeral()
          .build();
      }

      default:
        return this.createAdminError("Invalid Subcommand", "Unknown role subcommand");
    }
  }

  private async handleUserSubcommand(): Promise<CommandResponse> {
    const interaction = this.interaction as import("discord.js").ChatInputCommandInteraction;
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user", true);
    const roleName = interaction.options.getString("role", true);

    const role = await prisma.customRole.findUnique({
      where: { guildId_name: { guildId: this.guild.id, name: roleName } },
    });
    if (!role) {
      return this.createAdminError("Role Not Found", `Role \`${roleName}\` not found.`);
    }

    switch (subcommand) {
      case "assign_role": {
        const existingAssignment = await prisma.customRoleAssignment.findUnique({
          where: { guildId_userId_roleId: { guildId: this.guild.id, userId: user.id, roleId: role.id } },
        });
        if (existingAssignment) {
          return this.createAdminError(
            "Role Already Assigned",
            `User <@${user.id}> already has the role \`${roleName}\`.`
          );
        }
        await prisma.customRoleAssignment.create({
          data: {
            guildId: this.guild.id,
            userId: user.id,
            roleId: role.id,
            assignedBy: this.user.id,
          },
        });
        return new ResponseBuilder()
          .success("Role Assigned")
          .content(`✅ Assigned role \`${roleName}\` to <@${user.id}>.`)
          .ephemeral()
          .build();
      }

      case "unassign_role": {
        const existingAssignment = await prisma.customRoleAssignment.findUnique({
          where: { guildId_userId_roleId: { guildId: this.guild.id, userId: user.id, roleId: role.id } },
        });
        if (!existingAssignment) {
          return this.createAdminError(
            "Role Not Assigned",
            `User <@${user.id}> does not have the role \`${roleName}\`.`
          );
        }
        await prisma.customRoleAssignment.delete({
          where: {
            id: existingAssignment.id,
          },
        });
        return new ResponseBuilder()
          .success("Role Unassigned")
          .content(`✅ Unassigned role \`${roleName}\` from <@${user.id}>.`)
          .ephemeral()
          .build();
      }

      default:
        return this.createAdminError("Invalid Subcommand", "Unknown user subcommand");
    }
  }
}

// Export the command instance
export default new RBACCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("rbac")
  .setDescription("Manage Role-Based Access Control")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addSubcommandGroup((group) =>
    group
      .setName("role")
      .setDescription("Manage custom roles.")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new custom role.")
          .addStringOption((opt) => opt.setName("name").setDescription("The name of the new role.").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete a custom role.")
          .addStringOption((opt) =>
            opt
              .setName("role")
              .setDescription("The name of the role to delete.")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) => sub.setName("list").setDescription("List all custom roles."))
      .addSubcommand((sub) =>
        sub
          .setName("permission_add")
          .setDescription("Add a permission to a custom role.")
          .addStringOption((opt) =>
            opt.setName("role").setDescription("The name of the role.").setRequired(true).setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("permission")
              .setDescription("The permission to add (e.g., 'command.clear').")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("permission_remove")
          .setDescription("Remove a permission from a custom role.")
          .addStringOption((opt) =>
            opt.setName("role").setDescription("The name of the role.").setRequired(true).setAutocomplete(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("permission")
              .setDescription("The permission to remove.")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("user")
      .setDescription("Manage user role assignments.")
      .addSubcommand((sub) =>
        sub
          .setName("assign_role")
          .setDescription("Assign a custom role to a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to assign the role to.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("role")
              .setDescription("The name of the role to assign.")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("unassign_role")
          .setDescription("Unassign a custom role from a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to unassign the role from.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("role")
              .setDescription("The name of the role to unassign.")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
  );
