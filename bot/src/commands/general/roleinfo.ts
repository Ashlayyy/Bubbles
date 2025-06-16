import { EmbedBuilder, PermissionsBitField, Role, SlashCommandBuilder } from "discord.js";

import logger from "../../logger.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Display detailed information about a role")
    .addRoleOption((opt) => opt.setName("role").setDescription("Role to get information about").setRequired(true)),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const roleOption = interaction.options.getRole("role", true);

    // Ensure we have a proper Role object
    if (!(roleOption instanceof Role)) {
      await interaction.reply({
        content: "❌ Invalid role provided.",
        ephemeral: true,
      });
      return;
    }

    const role = roleOption;

    try {
      const embed = new EmbedBuilder()
        .setTitle(`🎭 Role Information: ${role.name}`)
        .setColor(role.color || 0x99aab5)
        .setTimestamp()
        .setFooter({
          text: `Role ID: ${role.id}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Basic role info
      embed.addFields(
        {
          name: "📋 Basic Info",
          value: [
            `**Name:** ${role.name}`,
            `**Mention:** ${role.toString()}`,
            `**Color:** ${role.hexColor}`,
            `**Position:** ${role.position}`,
            `**ID:** ${role.id}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "⚙️ Settings",
          value: [
            `**Hoisted:** ${role.hoist ? "Yes" : "No"}`,
            `**Mentionable:** ${role.mentionable ? "Yes" : "No"}`,
            `**Managed:** ${role.managed ? "Yes" : "No"}`,
            `**Members:** ${role.members.size.toLocaleString()}`,
          ].join("\n"),
          inline: true,
        }
      );

      // Creation date
      embed.addFields({
        name: "📅 Created",
        value: `<t:${Math.floor(role.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(role.createdTimestamp / 1000)}:R>)`,
        inline: false,
      });

      // Permissions (only show if user has manage roles permission or is admin)
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (
        member?.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
        member?.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        const permissions = role.permissions.toArray();
        if (permissions.length > 0) {
          const permissionList = permissions
            .map((perm) => {
              // Format permission names nicely
              return perm
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
            })
            .slice(0, 20); // Limit to 20 permissions

          embed.addFields({
            name: `🔐 Permissions (${permissions.length})`,
            value:
              permissionList.join(", ") + (permissions.length > 20 ? `\n*and ${permissions.length - 20} more...*` : ""),
            inline: false,
          });
        }
      }

      // Role members (if reasonable count)
      if (role.members.size > 0 && role.members.size <= 20) {
        const memberList = role.members.map((member) => member.user.username).join(", ");
        embed.addFields({
          name: `👥 Members (${role.members.size})`,
          value: memberList,
          inline: false,
        });
      } else if (role.members.size > 20) {
        const sampleMembers = role.members
          .first(5)
          .map((member) => member.user.username)
          .join(", ");

        embed.addFields({
          name: `👥 Members (${role.members.size})`,
          value: `${sampleMembers} *and ${role.members.size - 5} more...*`,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Log command usage
      await client.logManager.log(interaction.guild.id, "COMMAND_ROLEINFO", {
        userId: interaction.user.id,
        channelId: interaction.channel?.id,
        metadata: {
          roleId: role.id,
          roleName: role.name,
          memberCount: role.members.size,
        },
      });
    } catch (error) {
      logger.error("Error in roleinfo command:", error);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to fetch role information. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.PUBLIC,
      isConfigurable: true,
    },
  }
);
