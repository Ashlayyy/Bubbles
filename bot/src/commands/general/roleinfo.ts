import { EmbedBuilder, PermissionsBitField, Role, SlashCommandBuilder } from "discord.js";
import logger from "../../logger.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import type { CommandConfig, CommandResponse } from "../_core/index.js";
import { GeneralCommand } from "../_core/specialized/GeneralCommand.js";

/**
 * Roleinfo Command - Display detailed information about a role
 */
export class RoleinfoCommand extends GeneralCommand {
  constructor() {
    const config: CommandConfig = {
      name: "roleinfo",
      description: "Display detailed information about a role",
      category: "general",
      permissions: {
        level: PermissionLevel.PUBLIC,
        isConfigurable: true,
      },
      ephemeral: false,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      throw new Error("This command only supports slash command format");
    }

    const roleOption = this.getRoleOption("role", true);

    // Ensure we have a proper Role object
    if (!(roleOption instanceof Role)) {
      return {
        content: "❌ Invalid role provided.",
        ephemeral: true,
      };
    }

    const role = roleOption;

    try {
      const embed = new EmbedBuilder()
        .setTitle(`🎭 Role Information: ${role.name}`)
        .setColor(role.color || 0x99aab5)
        .setTimestamp()
        .setFooter({
          text: `Role ID: ${role.id}`,
          iconURL: this.user.displayAvatarURL(),
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
      const member = this.guild.members.cache.get(this.user.id);
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

      // Log command usage
      await this.client.logManager.log(this.guild.id, "COMMAND_ROLEINFO", {
        userId: this.user.id,
        channelId: this.interaction.channel?.id,
        metadata: {
          roleId: role.id,
          roleName: role.name,
          memberCount: role.members.size,
        },
      });

      return { embeds: [embed] };
    } catch (error) {
      logger.error("Error in roleinfo command:", error);
      return {
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Error")
            .setDescription("Failed to fetch role information. Please try again.")
            .setTimestamp(),
        ],
        ephemeral: true,
      };
    }
  }
}

// Export the command instance
export default new RoleinfoCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("roleinfo")
  .setDescription("Display detailed information about a role")
  .addRoleOption((opt) => opt.setName("role").setDescription("Role to get information about").setRequired(true));
