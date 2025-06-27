import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import {
  expandAlias,
  parseEvidence,
  ResponseBuilder,
  type CommandConfig,
  type CommandResponse,
} from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Warn Command - Warns a user with configurable points
 */
export class WarnCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "warn",
      description: "Warn a user",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.ModerateMembers],
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

    // Get command options using typed methods
    const targetUser = this.getUserOption("user", true);
    const reasonInput = this.getStringOption("reason", true);
    const evidenceStr = this.getStringOption("evidence");
    const points = this.getIntegerOption("points") ?? 1;
    const silent = this.getBooleanOption("silent") ?? false;

    // Expand alias with automatic variable substitution
    const reason = await expandAlias(reasonInput, {
      guild: this.guild,
      user: targetUser,
      moderator: this.user,
    });

    // Parse evidence automatically
    const evidence = parseEvidence(evidenceStr ?? undefined);

    try {
      // Check if user is in the server
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        throw new Error(`**${targetUser.username}** is not in this server.`);
      }

      // Execute the warning using existing moderation manager
      const case_ = await this.client.moderationManager.warn(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        evidence.all.length > 0 ? evidence.all : undefined,
        points,
        !silent
      );

      // Get user's total points for display
      const totalPoints = await this.client.moderationManager.getInfractionPoints(this.guild.id, targetUser.id);

      // Use the new ResponseBuilder for consistent formatting
      return new ResponseBuilder()
        .success("Warning Applied")
        .content(
          `**${targetUser.username}** has been warned (${points} point${points !== 1 ? "s" : ""}).\n📋 **Case #${case_.caseNumber}** created.\n🔢 **Total Points:** ${totalPoints}`
        )
        .ephemeral()
        .build();
    } catch (error) {
      throw new Error(
        `Failed to warn **${targetUser.username}**: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

// Export the command instance
export default new WarnCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Warn a user")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addUserOption((option) => option.setName("user").setDescription("The user to warn").setRequired(true))
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the warning (or alias name)").setRequired(true)
  )
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
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
