import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

import { prisma } from "../../database/index.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((option) => option.setName("user").setDescription("The user to ban").setRequired(true))
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for the ban (or alias name)").setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration (e.g., 1d, 3h, 30m) - leave empty for permanent")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
    )
    .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false)),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user", true);
    let reason = interaction.options.getString("reason") ?? "No reason provided";
    const durationStr = interaction.options.getString("duration");
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

      // Parse duration if provided
      let duration: number | undefined;
      if (durationStr) {
        const parsedDuration = parseDuration(durationStr);
        if (parsedDuration === null) {
          await interaction.editReply({
            content: "❌ Invalid duration format. Use format like: 1d, 3h, 30m",
          });
          return;
        }
        duration = parsedDuration;
      }

      // Execute the ban
      const case_ = await client.moderationManager.ban(
        interaction.guild,
        targetUser.id,
        interaction.user.id,
        reason,
        duration,
        evidence.length > 0 ? evidence : undefined,
        !silent
      );

      const durationText = duration ? ` for ${formatDuration(duration)}` : " permanently";

      await interaction.editReply({
        content: `✅ **${targetUser.tag}** has been banned${durationText}.\n📋 **Case #${case_.caseNumber.toString()}** created.`,
      });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to ban **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.MODERATOR,
      discordPermissions: [PermissionsBitField.Flags.BanMembers],
      isConfigurable: true,
    },
  }
);

function parseDuration(durationStr: string): number | null {
  const regex = /^(\d+)([smhdw])$/;
  const match = regex.exec(durationStr);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

function formatDuration(seconds: number): string {
  const units = [
    { name: "week", seconds: 604800 },
    { name: "day", seconds: 86400 },
    { name: "hour", seconds: 3600 },
    { name: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${count} ${unit.name}${count !== 1 ? "s" : ""}`;
    }
  }

  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}
