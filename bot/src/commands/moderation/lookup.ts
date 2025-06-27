import { GuildMember, SlashCommandBuilder, time, TimestampStyles, User } from "discord.js";
import type { ModerationCase } from "../../structures/ModerationManager.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Lookup Command - Get comprehensive information about a user
 */
export class LookupCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "lookup",
      description: "Get comprehensive information about a user",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
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

    const targetUser = this.getUserOption("user", true);
    const detailed = this.getBooleanOption("detailed") ?? false;

    try {
      // Get member information (if in server)
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);

      // Get moderation data
      const cases = await this.client.moderationManager.getUserHistory(this.guild.id, targetUser.id, 50);
      const totalPoints = await this.client.moderationManager.getInfractionPoints(this.guild.id, targetUser.id);

      // Calculate risk assessment
      const riskAssessment = calculateRiskLevel(targetUser, member, cases, totalPoints);

      // Build main embed
      const embed = this.client.genEmbed({
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
              `**Total Cases:** ${cases.length}`,
              `**Total Points:** ${totalPoints}`,
              `**Active Cases:** ${cases.filter((c) => c.isActive).length}`,
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
        footer: { text: `Lookup performed by ${this.user.tag}` },
        timestamp: new Date(),
      });

      // Add role information if member exists
      if (member && member.roles.cache.size > 1) {
        const roles = member.roles.cache
          .filter((role) => role.id !== this.guild.id) // Exclude @everyone
          .sort((a, b) => b.position - a.position)
          .map((role) => role.name)
          .slice(0, 10); // Limit to 10 roles

        embed.addFields({
          name: `🎭 Roles (${member.roles.cache.size - 1})`,
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
            .map(([type, count]) => `**${type}:** ${count}`)
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
                  `**#${c.caseNumber}** - ${c.type} (${c.points}pts) - ${time(c.createdAt, TimestampStyles.ShortDate)}\n${c.reason ?? "No reason"}`
              )
              .join("\n\n"),
            inline: false,
          });
        }
      }

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      return this.createModerationError(
        "user lookup",
        targetUser,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

// Export the command instance
export default new LookupCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("lookup")
  .setDescription("Get comprehensive information about a user")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addUserOption((option) => option.setName("user").setDescription("The user to look up").setRequired(true))
  .addBooleanOption((option) =>
    option.setName("detailed").setDescription("Show detailed case information").setRequired(false)
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
  if (activeCases.length > 0) {
    factors.push("Active punishments");
    riskScore += 1;
  }

  // Severity of recent cases
  const severeCases = cases.filter((c) => c.severity === "HIGH" || c.severity === "CRITICAL");
  if (severeCases.length > 0) {
    factors.push("Previous severe infractions");
    riskScore += 1;
  }

  // Determine risk level
  let level: RiskAssessment["level"];
  if (riskScore >= 7) {
    level = "CRITICAL";
  } else if (riskScore >= 5) {
    level = "HIGH";
  } else if (riskScore >= 3) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { level, factors };
}

function getRiskColor(level: string): number {
  switch (level) {
    case "CRITICAL":
      return 0x8b0000; // Dark red
    case "HIGH":
      return 0xff0000; // Red
    case "MEDIUM":
      return 0xff8c00; // Orange
    case "LOW":
    default:
      return 0x00ff00; // Green
  }
}

function getRiskEmoji(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "🚨";
    case "HIGH":
      return "🔴";
    case "MEDIUM":
      return "🟡";
    case "LOW":
    default:
      return "🟢";
  }
}

function getCaseBreakdown(cases: ModerationCase[]): Record<string, number> {
  const breakdown: Record<string, number> = {};

  for (const case_ of cases) {
    breakdown[case_.type] = (breakdown[case_.type] || 0) + 1;
  }

  return breakdown;
}
