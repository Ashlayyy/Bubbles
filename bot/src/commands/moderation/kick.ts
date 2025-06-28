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

    const targetUser = this.getUserOption("user", true);
    const reasonInput = this.getStringOption("reason") ?? "No reason provided";
    const evidenceStr = this.getStringOption("evidence");
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Check if user is in the server (required for kicks)
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return this.createModerationError(
          "kick",
          targetUser,
          `❌ **${targetUser.username}** is not a member of this server.\n\n` +
            `**User ID:** \`${targetUser.id}\`\n\n` +
            `💡 **Tips:**\n` +
            `• You can only kick active server members\n` +
            `• Use \`/ban\` to punish users who have left\n` +
            `• Use \`/note\` to add notes about former members`
        );
      }

      // Validate moderation target (hierarchy, self-moderation, etc.)
      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "kick",
          targetUser,
          `${error instanceof Error ? error.message : "Unknown validation error"}\n\n` +
            `💡 **Tips:**\n` +
            `• Check your role hierarchy\n` +
            `• Ensure you have kick permissions\n` +
            `• Verify the bot's role position`
        );
      }

      // Expand alias with automatic variable substitution
      const reason = await expandAlias(reasonInput, {
        guild: this.guild,
        user: targetUser,
        moderator: this.user,
      });

      // Parse evidence automatically
      const evidence = parseEvidence(evidenceStr ?? undefined);

      // Execute the kick using moderation manager
      const case_ = await this.client.moderationManager.kick(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        evidence.all.length > 0 ? evidence.all : undefined,
        !silent
      );

      // Success response with better formatting
      return new ResponseBuilder()
        .success("Kick Applied")
        .content(
          `👢 **${targetUser.username}** has been kicked from the server.\n\n` +
            `📋 **Case #${String(case_.caseNumber)}** created\n` +
            (reason !== "No reason provided" ? `📝 **Reason:** ${reason}\n` : "") +
            (evidence.all.length > 0 ? `📎 **Evidence:** ${evidence.all.length} item(s) attached\n` : "") +
            (!silent ? `📨 User was notified via DM` : `🔕 Silent kick (user not notified)`) +
            `\n\n💡 **Note:** User can rejoin with a new invite link.`
        )
        .ephemeral()
        .build();
    } catch (error) {
      return this.createModerationError(
        "kick",
        targetUser,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if the user is still in the server\n` +
          `• Verify you have kick permissions\n` +
          `• Ensure proper role hierarchy\n` +
          `• Check if the bot has kick permissions\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
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
