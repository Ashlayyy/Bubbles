import { SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((option) => option.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the kick").setRequired(false))
    .addStringOption((option) =>
      option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user", true);
    let reason = interaction.options.getString("reason") ?? "No reason provided";
    const evidence =
      interaction.options
        .getString("evidence")
        ?.split(",")
        .map((s) => s.trim()) ?? [];
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

      // Get the moderation manager from client
      const moderationManager = client.moderationManager;

      // Execute the kick - the system handles everything automatically!
      const case_ = await moderationManager.kick(
        interaction.guild,
        targetUser.id,
        interaction.user.id,
        reason,
        evidence.length > 0 ? evidence : undefined
      );

      // If silent, update the case to not notify user
      if (silent) {
        await moderationManager.updateCaseNotification(case_.id, false);
      }

      // Simple success response
      await interaction.editReply({
        content: `✅ **${targetUser.tag}** has been kicked.\n📋 **Case #${case_.caseNumber.toString()}** created.`,
      });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to kick **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.MODERATOR,
      isConfigurable: true,
    },
  }
);
