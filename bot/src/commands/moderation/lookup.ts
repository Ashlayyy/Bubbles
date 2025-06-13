import { GuildMember, SlashCommandBuilder, time, TimestampStyles, User } from "discord.js";

import Command from "../../structures/Command.js";
import type { ModerationCase } from "../../structures/ModerationManager.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

export default new Command(
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Get comprehensive information about a user")
    .addUserOption((option) => option.setName("user").setDescription("The user to look up").setRequired(true))
    .addBooleanOption((option) =>
      option.setName("detailed").setDescription("Show detailed case information").setRequired(false)
    ),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const targetUser = interaction.options.getUser("user", true);
    const detailed = interaction.options.getBoolean("detailed") ?? false;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get member information (if in server)
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      // Get moderation data
      const cases = await client.moderationManager.getUserHistory(interaction.guild.id, targetUser.id, 50);
      const totalPoints = await client.moderationManager.getInfractionPoints(interaction.guild.id, targetUser.id);

      // Calculate risk assessment
      const riskAssessment = calculateRiskLevel(targetUser, member, cases, totalPoints);

      // Build main embed
      const embed = client.genEmbed({
        title: `🔍 User Lookup - ${targetUser.tag}`,
        thumbnail: { url: targetUser.displayAvatarURL({ size: 256 }) },
        color: getRiskColor(riskAssessment.level),
        fields: [
          {
            name: "👤 Basic Information",
            value: [
              `**Username:** ${targetUser.username}`,
              `**Display Name:** ${targetUser.displayName || "None"}`,
              `**User ID:** ${targetUser.id}`,
              `**Account Created:** ${time(targetUser.createdAt, TimestampStyles.RelativeTime)}`,
              `**Bot Account:** ${targetUser.bot ? "Yes" : "No"}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "🏠 Server Status",
            value: member
              ? [
                  `**In Server:** Yes`,
                  `**Joined:** ${member.joinedAt ? time(member.joinedAt, TimestampStyles.RelativeTime) : "Unknown"}`,
                  `**Nickname:** ${member.nickname ?? "None"}`,
                  `**Highest Role:** ${member.roles.highest.name}`,
                  `**Timed Out:** ${member.isCommunicationDisabled() ? "Yes" : "No"}`,
                ].join("\n")
              : "**In Server:** No",
            inline: false,
          },
          {
            name: "⚖️ Moderation Summary",
            value: [
              `**Total Cases:** ${cases.length.toString()}`,
              `**Total Points:** ${totalPoints.toString()}`,
              `**Active Cases:** ${cases.filter((c) => c.isActive).length.toString()}`,
              `**Last Incident:** ${cases[0] ? time(cases[0].createdAt, TimestampStyles.RelativeTime) : "None"}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🚨 Risk Assessment",
            value: [
              `**Risk Level:** ${getRiskEmoji(riskAssessment.level)} ${riskAssessment.level}`,
              `**Risk Factors:**`,
              riskAssessment.factors.length > 0
                ? riskAssessment.factors.map((f) => `• ${f}`).join("\n")
                : "• None detected",
            ].join("\n"),
            inline: true,
          },
        ],
        footer: { text: `Lookup performed by ${interaction.user.tag}` },
        timestamp: new Date(),
      });

      // Add role information if member exists
      if (member && member.roles.cache.size > 1) {
        const roles = member.roles.cache
          .filter((role) => role.id !== interaction.guild?.id) // Exclude @everyone
          .sort((a, b) => b.position - a.position)
          .map((role) => role.name)
          .slice(0, 10); // Limit to 10 roles

        embed.addFields({
          name: `🎭 Roles (${(member.roles.cache.size - 1).toString()})`,
          value: roles.join(", ") + (member.roles.cache.size > 11 ? "..." : ""),
          inline: false,
        });
      }

      // Add case breakdown
      if (cases.length > 0) {
        const caseBreakdown = getCaseBreakdown(cases);
        embed.addFields({
          name: "📊 Case Breakdown",
          value: Object.entries(caseBreakdown)
            .map(([type, count]) => `**${type}:** ${count.toString()}`)
            .join(" | "),
          inline: false,
        });

        // Add recent cases if detailed
        if (detailed && cases.length > 0) {
          const recentCases = cases.slice(0, 5);
          embed.addFields({
            name: "📋 Recent Cases",
            value: recentCases
              .map(
                (c) =>
                  `**#${c.caseNumber.toString()}** - ${c.type} (${c.points.toString()}pts) - ${time(c.createdAt, TimestampStyles.ShortDate)}\n${c.reason ?? "No reason"}`
              )
              .join("\n\n"),
            inline: false,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: `❌ Failed to lookup **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
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

interface RiskAssessment {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
}

function calculateRiskLevel(
  user: User,
  member: GuildMember | null,
  cases: ModerationCase[],
  totalPoints: number
): RiskAssessment {
  const factors: string[] = [];
  let riskScore = 0;

  // Account age factor
  const accountAge = Date.now() - user.createdAt.getTime();
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

  if (daysSinceCreation < 7) {
    factors.push("Very new account (< 7 days)");
    riskScore += 3;
  } else if (daysSinceCreation < 30) {
    factors.push("New account (< 30 days)");
    riskScore += 1;
  }

  // Points-based risk
  if (totalPoints >= 15) {
    factors.push("High infraction points");
    riskScore += 3;
  } else if (totalPoints >= 10) {
    factors.push("Moderate infraction points");
    riskScore += 2;
  } else if (totalPoints >= 5) {
    factors.push("Some infraction points");
    riskScore += 1;
  }

  // Recent activity
  const recentCases = cases.filter(
    (c) => Date.now() - c.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
  );

  if (recentCases.length >= 3) {
    factors.push("Multiple recent infractions");
    riskScore += 2;
  } else if (recentCases.length >= 2) {
    factors.push("Recent infractions");
    riskScore += 1;
  }

  // Active bans/timeouts
  const activeCases = cases.filter((c) => c.isActive);
  if (activeCases.some((c) => c.type === "BAN")) {
    factors.push("Currently banned");
    riskScore += 4;
  }
  if (member?.isCommunicationDisabled()) {
    factors.push("Currently timed out");
    riskScore += 1;
  }

  // Default username pattern (common bot pattern)
  if (/^[a-z]+\d+$/.test(user.username.toLowerCase())) {
    factors.push("Suspicious username pattern");
    riskScore += 1;
  }

  // Determine risk level
  let level: RiskAssessment["level"];
  if (riskScore >= 8) level = "CRITICAL";
  else if (riskScore >= 5) level = "HIGH";
  else if (riskScore >= 2) level = "MEDIUM";
  else level = "LOW";

  return { level, factors };
}

function getRiskColor(level: string): number {
  const colors = {
    LOW: 0x2ecc71, // Green
    MEDIUM: 0xf1c40f, // Yellow
    HIGH: 0xe67e22, // Orange
    CRITICAL: 0xe74c3c, // Red
  };
  return colors[level as keyof typeof colors] || 0x95a5a6;
}

function getRiskEmoji(level: string): string {
  const emojis = {
    LOW: "🟢",
    MEDIUM: "🟡",
    HIGH: "🟠",
    CRITICAL: "🔴",
  };
  return emojis[level as keyof typeof emojis] || "⚪";
}

function getCaseBreakdown(cases: ModerationCase[]): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const case_ of cases) {
    breakdown[case_.type] = (breakdown[case_.type] ?? 0) + 1;
  }

  return breakdown;
}
