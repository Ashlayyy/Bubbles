import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import {
  expandAlias,
  parseDuration,
  parseEvidence,
  ResponseBuilder,
  type CommandConfig,
  type CommandResponse,
} from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Ban Command - Bans a user from the server
 */
export class BanCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "ban",
      description: "Ban a user from the server",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.BanMembers],
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
    const reasonInput = this.getStringOption("reason", true);
    const durationStr = this.getStringOption("duration");
    const evidenceStr = this.getStringOption("evidence");
    const deleteDays = this.getIntegerOption("delete-days") ?? 1;
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Parse duration if provided with detailed validation
      let duration: number | undefined;
      if (durationStr) {
        const parsedDuration = parseDuration(durationStr);
        if (parsedDuration === null) {
          return this.createModerationError(
            "ban",
            targetUser,
            `❌ Invalid duration format: **${durationStr}**\n\n` +
              `**Correct format examples:**\n` +
              `• \`30m\` - 30 minutes\n` +
              `• \`2h\` - 2 hours\n` +
              `• \`1d\` - 1 day\n` +
              `• \`7d\` - 7 days\n` +
              `• \`30d\` - 30 days\n\n` +
              `**Allowed units:** s(econds), m(inutes), h(ours), d(ays), w(eeks), mo(nths), y(ears)\n\n` +
              `💡 **Tip:** Leave duration blank for permanent ban.`
          );
        }
        duration = parsedDuration;
      }

      // Check if user is in the server (for validation, but not required for bans)
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);

      if (member) {
        // Validate moderation target (hierarchy, self-moderation, etc.)
        try {
          this.validateModerationTarget(member);
        } catch (error) {
          return this.createModerationError(
            "ban",
            targetUser,
            `${error instanceof Error ? error.message : "Unknown validation error"}\n\n` +
              `💡 **Tip:** Make sure you have appropriate permissions and role hierarchy.`
          );
        }
      }

      // Expand alias with automatic variable substitution
      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: targetUser,
        moderator: this.user,
      });

      // Parse evidence automatically
      const evidence = parseEvidence(evidenceStr ?? undefined);

      // Execute the ban using moderation manager
      const case_ = await this.client.moderationManager.ban(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        duration,
        evidence.all.length > 0 ? evidence.all : undefined,
        !silent
      );

      // Success response with better formatting
      const durationText = duration ? ` for **${this.formatDuration(duration)}**` : "";
      const memberStatus = member ? "Member" : "User (not in server)";

      return new ResponseBuilder()
        .success("Ban Applied")
        .content(
          `🔨 **${targetUser.username}** has been banned${durationText}.\n\n` +
            `📋 **Case #${String(case_.caseNumber)}** created\n` +
            `👤 **Target:** ${memberStatus}\n` +
            (reason !== "No reason provided" ? `📝 **Reason:** ${reason}\n` : "") +
            (evidence.all.length > 0 ? `📎 **Evidence:** ${evidence.all.length} item(s) attached\n` : "") +
            (deleteDays > 0 ? `🗑️ **Messages deleted:** Last ${deleteDays} day(s)\n` : "") +
            (!silent ? `📨 User was notified via DM` : `🔕 Silent ban (user not notified)`)
        )
        .ephemeral()
        .build();
    } catch (error) {
      return this.createModerationError(
        "ban",
        targetUser,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if you have ban permissions\n` +
          `• Verify role hierarchy\n` +
          `• Ensure the bot has necessary permissions\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
    }
  }

  private formatDuration(seconds: number): string {
    const units = [
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
export default new BanCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addUserOption((option) => option.setName("user").setDescription("The user to ban").setRequired(true))
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the ban (or alias name)").setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("duration").setDescription("Duration for temporary ban (e.g., 1d, 3h, 30m)").setRequired(false)
  )
  .addStringOption((option) =>
    option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("delete-days")
      .setDescription("Days of messages to delete (0-7, default: 1)")
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
