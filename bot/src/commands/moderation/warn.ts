import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((option) => option.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setRequired(true))
    .addStringOption((option) =>
      option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription("Custom point value (default: 1)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const targetUser = interaction.options.getUser("user", true);
    let reason = interaction.options.getString("reason", true);
    const evidence =
      interaction.options
        .getString("evidence")
        ?.split(",")
        .map((s) => s.trim()) ?? [];
    const points = interaction.options.getInteger("points") ?? 1;
    const silent = interaction.options.getBoolean("silent") ?? false;

    try {
      // Check if reason is an alias and expand it
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

      // Check if user is in the server
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: `❌ **${targetUser.tag}** is not in this server.`,
          ephemeral: true,
        });
        return;
      }

      // Execute the warning
      const case_ = await client.moderationManager.warn(
        interaction.guild,
        targetUser.id,
        interaction.user.id,
        reason,
        evidence.length > 0 ? evidence : undefined,
        points
      );

      if (silent) {
        await client.moderationManager.updateCaseNotification(case_.id, false);
      }

      // Get user's total points for display
      const totalPoints = await client.moderationManager.getInfractionPoints(interaction.guild.id, targetUser.id);

      await interaction.reply({
        content: `⚠️ **${targetUser.tag}** has been warned.\n📋 **Case #${case_.caseNumber}** created.\n🔢 **Total Points:** ${totalPoints}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ Failed to warn **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      });
    }
  },
  {
    permissions: {
      level: PermissionLevel.MODERATOR,
      discordPermissions: [PermissionsBitField.Flags.ModerateMembers],
      isConfigurable: true,
    },
  }
);
