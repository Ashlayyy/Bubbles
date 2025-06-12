import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../database/index";
import Command, { GuildChatInputCommandInteraction } from "../../structures/Command";
import { PermissionLevel } from "../../structures/PermissionTypes";

async function handleRoleSubcommand(interaction: GuildChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const roleName = interaction.options.getString("role");
  const permission = interaction.options.getString("permission");
  const guildId = interaction.guildId;

  if (!guildId) return;

  switch (subcommand) {
    case "create": {
      const newRoleName = interaction.options.getString("name", true);
      const existingRole = await prisma.customRole.findUnique({
        where: { guildId_name: { guildId, name: newRoleName } },
      });
      if (existingRole) {
        await interaction.followUp(`❌ Role \`${newRoleName}\` already exists.`);
        return;
      }
      await prisma.customRole.create({
        data: {
          guildId,
          name: newRoleName,
          permissions: [],
        },
      });
      await interaction.followUp(`✅ Created role \`${newRoleName}\`.`);
      break;
    }
    case "delete": {
      if (!roleName) return;
      const role = await prisma.customRole.findUnique({ where: { guildId_name: { guildId, name: roleName } } });
      if (!role) {
        await interaction.followUp(`❌ Role \`${roleName}\` not found.`);
        return;
      }
      await prisma.customRole.delete({ where: { guildId_name: { guildId, name: roleName } } });
      // Also delete assignments
      await prisma.customRoleAssignment.deleteMany({ where: { roleId: role.id } });
      await interaction.followUp(`✅ Deleted role \`${roleName}\`.`);
      break;
    }
    case "list": {
      const roles = await prisma.customRole.findMany({ where: { guildId } });
      if (roles.length === 0) {
        await interaction.followUp("No custom roles found.");
        return;
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
              (r) =>
                `**${r.name}** (${r.userCount.toString()} users)\nPermissions: \`${r.permissions.join(", ") || "None"}\``
            )
            .join("\n\n")
        );
      await interaction.followUp({ embeds: [embed] });
      break;
    }
    case "permission_add": {
      if (!roleName || !permission) return;
      const role = await prisma.customRole.findUnique({ where: { guildId_name: { guildId, name: roleName } } });
      if (!role) {
        await interaction.followUp(`❌ Role \`${roleName}\` not found.`);
        return;
      }
      if (role.permissions.includes(permission)) {
        await interaction.followUp(`❌ Role \`${roleName}\` already has the permission \`${permission}\`.`);
        return;
      }
      await prisma.customRole.update({
        where: { guildId_name: { guildId, name: roleName } },
        data: { permissions: { push: permission } },
      });
      await interaction.followUp(`✅ Added permission \`${permission}\` to role \`${roleName}\`.`);
      break;
    }
    case "permission_remove": {
      if (!roleName || !permission) return;
      const role = await prisma.customRole.findUnique({ where: { guildId_name: { guildId, name: roleName } } });
      if (!role) {
        await interaction.followUp(`❌ Role \`${roleName}\` not found.`);
        return;
      }
      if (!role.permissions.includes(permission)) {
        await interaction.followUp(`❌ Role \`${roleName}\` does not have the permission \`${permission}\`.`);
        return;
      }
      const newPermissions = role.permissions.filter((p) => p !== permission);
      await prisma.customRole.update({
        where: { guildId_name: { guildId, name: roleName } },
        data: { permissions: newPermissions },
      });
      await interaction.followUp(`✅ Removed permission \`${permission}\` from role \`${roleName}\`.`);
      break;
    }
  }
}

async function handleUserSubcommand(interaction: GuildChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser("user", true);
  const roleName = interaction.options.getString("role", true);
  const guildId = interaction.guildId;

  if (!guildId) return;

  const role = await prisma.customRole.findUnique({ where: { guildId_name: { guildId, name: roleName } } });
  if (!role) {
    await interaction.followUp(`❌ Role \`${roleName}\` not found.`);
    return;
  }

  switch (subcommand) {
    case "assign_role": {
      const existingAssignment = await prisma.customRoleAssignment.findUnique({
        where: { guildId_userId_roleId: { guildId, userId: user.id, roleId: role.id } },
      });
      if (existingAssignment) {
        await interaction.followUp(`❌ User <@${user.id}> already has the role \`${roleName}\`.`);
        return;
      }
      await prisma.customRoleAssignment.create({
        data: {
          guildId,
          userId: user.id,
          roleId: role.id,
          assignedBy: interaction.user.id,
        },
      });
      await interaction.followUp(`✅ Assigned role \`${roleName}\` to <@${user.id}>.`);
      break;
    }
    case "unassign_role": {
      const existingAssignment = await prisma.customRoleAssignment.findUnique({
        where: { guildId_userId_roleId: { guildId, userId: user.id, roleId: role.id } },
      });
      if (!existingAssignment) {
        await interaction.followUp(`❌ User <@${user.id}> does not have the role \`${roleName}\`.`);
        return;
      }
      await prisma.customRoleAssignment.delete({
        where: {
          id: existingAssignment.id,
        },
      });
      await interaction.followUp(`✅ Unassigned role \`${roleName}\` from <@${user.id}>.`);
      break;
    }
  }
}

export default new Command(
  new SlashCommandBuilder()
    .setName("rbac")
    .setDescription("Manage Role-Based Access Control.")
    .setDefaultMemberPermissions(0)
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
    ),

  async (_client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;

    await interaction.deferReply({ ephemeral: true });

    const group = interaction.options.getSubcommandGroup();

    try {
      if (group === "role") {
        await handleRoleSubcommand(interaction);
      } else if (group === "user") {
        await handleUserSubcommand(interaction);
      }
    } catch (error) {
      console.error(error);
      await interaction.followUp("❌ An error occurred.");
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
