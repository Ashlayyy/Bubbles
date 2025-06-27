import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, formatDuration, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

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
    let reason = this.getStringOption("reason") ?? "No reason provided";
    const evidence =
      this.getStringOption("evidence")
        ?.split(",")
        .map((s) => s.trim()) ?? [];
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Expand alias if provided
      if (reason !== "No reason provided") {
        reason = await expandAlias(reason, {
          guild: this.guild,
          user: targetUser,
          moderator: this.user,
        });
      }

      // Parse duration using shared utility
      const duration = parseDuration(durationStr);
      if (duration === null) {
        return {
          content: "❌ Invalid duration format. Use format like: 1d, 3h, 30m",
          ephemeral: true,
        };
      }

      // Discord timeout limit is 28 days
      const maxDuration = 28 * 24 * 60 * 60; // 28 days in seconds
      if (duration > maxDuration) {
        return {
          content: "❌ Timeout duration cannot exceed 28 days.",
          ephemeral: true,
        };
      }

      // Check if user is in the server
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return {
          content: `❌ **${targetUser.tag}** is not in this server.`,
          ephemeral: true,
        };
      }

      // Execute the timeout
      const case_ = await this.client.moderationManager.timeout(
        this.guild,
        targetUser.id,
        this.user.id,
        duration,
        reason,
        evidence.length > 0 ? evidence : undefined,
        !silent
      );

      // Use shared formatting utility
      return {
        content: `🔇 **${targetUser.tag}** has been timed out for ${formatDuration(duration)}.\n📋 **Case #${case_.caseNumber}** created.`,
        ephemeral: true,
      };
    } catch (error) {
      return {
        content: `❌ Failed to timeout **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
    }
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
