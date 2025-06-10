import { SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a user")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user to remove timeout from").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for removing timeout").setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const targetUser = interaction.options.getUser("user", true);
    let reason = interaction.options.getString("reason") ?? "No reason provided";
    const silent = interaction.options.getBoolean("silent") ?? false;

    try {
      // Check if reason is an alias and expand it
      if (reason !== "No reason provided") {
        const aliasName = reason.toUpperCase();
        const alias = await prisma.alias.findUnique({
          where: { guildId_name: { guildId: interaction.guild.id, name: aliasName } },
        });

        if (alias) {
          // Expand alias content with variables
          reason = alias.content;
          reason = reason.replace(/\{user\}/g, `<@${targetUser.id}>`);
          reason = reason.replace(/\{server\}/g, interaction.guild.name);
          reason = reason.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

          // Update usage count
          await prisma.alias.update({
            where: { id: alias.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      // Check if user is in the server
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: `❌ **${targetUser.tag}** is not in this server.`,
          ephemeral: true,
        });
        return;
      }

      // Check if user is actually timed out
      if (!member.isCommunicationDisabled()) {
        await interaction.reply({
          content: `❌ **${targetUser.tag}** is not currently timed out.`,
          ephemeral: true,
        });
        return;
      }

      // Execute the untimeout using the moderation system
      const case_ = await client.moderationManager.moderate(interaction.guild, {
        type: "UNTIMEOUT",
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        reason,
        severity: "LOW",
        points: 0, // No points for removing timeouts
        notifyUser: !silent,
      });

      await interaction.reply({
        content: `🔊 **${targetUser.tag}** timeout has been removed.\n📋 **Case #${case_.caseNumber}** created.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to remove timeout from **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);
