import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Kick Command - Kicks a user from the server
 */
export class KickCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "kick",
      description: "Kick a user from the server",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.KickMembers],
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
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Check if user is in the server (required for kicks)
      const member = await this.getTargetMember(true);
      if (!member) {
        throw new Error(`User ${targetUser.username} is not in this server.`);
      }

      // Validate moderation permissions against the member
      this.validateModerationTarget(member);

      // Expand alias with automatic variable substitution
      const reason = await this.expandReasonAlias(reasonInput, targetUser);

      // Parse evidence automatically
      const evidence = parseEvidence(evidenceStr ?? undefined);

      // Execute the kick using existing moderation manager
      const case_ = await this.client.moderationManager.kick(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        evidence.all.length > 0 ? evidence.all : undefined,
        !silent
      );

      // Use the new ResponseBuilder for consistent formatting
      return this.createModerationResponse(
        "kicked",
        targetUser,
        reason,
        undefined, // No duration for kicks
        case_.caseNumber,
        evidence
      );
    } catch (error) {
      return this.createModerationError("kick", targetUser, error instanceof Error ? error.message : "Unknown error");
    }
  }
}

// Export the command instance
export default new KickCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a user from the server")
  .setDefaultMemberPermissions(0) // Hide from all regular users
  .addUserOption((option) => option.setName("user").setDescription("The user to kick").setRequired(true))
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for the kick (or alias name)").setRequired(false)
  )
  .addStringOption((option) =>
    option.setName("evidence").setDescription("Evidence links (comma-separated)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
