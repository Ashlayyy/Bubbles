import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, parseDuration, parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModSuccess } from "../_shared/ModResponseBuilder.js";

/**
 * Timeout Command - Timeout a user (mute them temporarily)
 */
export class TimeoutCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "timeout",
      description: "Timeout a user (mute them temporarily)",
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
    const durationStr = this.getStringOption("duration", true);
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Parse duration first for early validation
      const duration = parseDuration(durationStr);
      if (duration === null) {
        return this.createModerationError(
          "timeout",
          targetUser,
          `❌ Invalid duration format: **${durationStr}**\n\n` +
            `**Correct format examples:**\n` +
            `• \`30m\` - 30 minutes\n` +
            `• \`2h\` - 2 hours\n` +
            `• \`1d\` - 1 day\n` +
            `• \`7d\` - 7 days\n\n` +
            `**Allowed units:** s(econds), m(inutes), h(ours), d(ays), w(eeks)`
        );
      }

      // Discord timeout limit is 28 days
      const maxDuration = 28 * 24 * 60 * 60; // 28 days in seconds
      if (duration > maxDuration) {
        return this.createModerationError(
          "timeout",
          targetUser,
          `❌ Timeout duration cannot exceed **28 days**.\n\n` +
            `**Requested:** ${this.formatDuration(duration)}\n` +
            `**Maximum allowed:** 28 days\n\n` +
            `💡 **Tip:** For longer punishments, consider using \`/ban\` with a duration.`
        );
      }

      // Get the guild member
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return this.createModerationError(
          "timeout",
          targetUser,
          `❌ **${targetUser.username}** is not a member of this server.`
        );
      }

      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "timeout",
          targetUser,
          `❌ Cannot timeout **${targetUser.username}**\n\n` +
            `**Reason:** ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
            `💡 **Tip:** Only users with lower roles can be timed out.`
        );
      }

      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: targetUser,
        moderator: this.user,
      });

      const evidence = parseEvidence(evidenceStr ?? undefined);

      const case_ = await this.client.moderationManager.timeout(
        this.guild,
        targetUser.id,
        this.user.id,
        duration,
        reason,
        evidence.all.length > 0 ? evidence.all : undefined,
        !silent,
        {
          interactionId: this.interaction.id,
          commandName: this.interaction.commandName,
          interactionLatency: Date.now() - this.interaction.createdTimestamp,
        }
      );

      return buildModSuccess({
        title: `Timeout (${this.formatDuration(duration)}) | Case #${case_.caseNumber}`,
        target: targetUser,
        moderator: this.user,
        reason,
        duration,
        notified: !silent,
        caseNumber: case_.caseNumber,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("hierarchy")) {
        return this.createModerationError(
          "timeout",
          targetUser,
          `❌ Cannot timeout **${targetUser.username}**\n\n` +
            `**Reason:** User has equal or higher permissions than you.\n\n` +
            `💡 **Tip:** Only users with lower roles can be timed out.`
        );
      }

      throw new Error(`Failed to timeout: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private formatDuration(seconds: number): string {
    const units = [
      { name: "week", seconds: 604800 },
      { name: "day", seconds: 86400 },
      { name: "hour", seconds: 3600 },
      { name: "minute", seconds: 60 },
    ];

    for (const unit of units) {
      const count = Math.floor(seconds / unit.seconds);
      if (count > 0) {
        return `${String(count)} ${unit.name}${count !== 1 ? "s" : ""}`;
      }
    }

    return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
  }
}

// Export the command instance
export default new TimeoutCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a user (mute them temporarily)")
  .addUserOption((option) => option.setName("user").setDescription("The user to timeout").setRequired(true))
  .addStringOption((option) =>
    option.setName("duration").setDescription("Duration (e.g., 1d, 3h, 30m) - max 28 days").setRequired(true)
  )
  .addStringOption((option) => option.setName("reason").setDescription("Reason for the timeout").setRequired(false))
  .addStringOption((option) =>
    option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
