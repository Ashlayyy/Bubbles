import { PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, parseEvidence, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModCaseEmbed } from "../_shared/ModCaseEmbed.js";

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

    const targetUser = this.getUserOption("user", true);
    const reasonInput = this.getStringOption("reason", true);
    const evidenceStr = this.getStringOption("evidence");
    const points = this.getIntegerOption("points") ?? 1;
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Check if user is in the server
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return this.createModerationError(
          "warn",
          targetUser,
          `❌ **${targetUser.username}** is not a member of this server.\n\n` +
            `**User ID:** \`${targetUser.id}\`\n\n` +
            `💡 **Tip:** You can only warn active server members. Use \`/note\` to add notes about users who have left.`
        );
      }

      // Validate moderation target (hierarchy, self-moderation, etc.)
      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "warn",
          targetUser,
          `${error instanceof Error ? error.message : "Unknown validation error"}\n\n` +
            `💡 **Tip:** Make sure you have appropriate permissions and role hierarchy.`
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

      const invocation = {
        interactionId: this.interaction.id,
        commandName: this.interaction.commandName,
        interactionLatency: Date.now() - this.interaction.createdTimestamp,
      };

      // Execute the warning using moderation manager
      const case_ = await this.client.moderationManager.warn(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        evidence.all.length > 0 ? evidence.all : undefined,
        points,
        !silent,
        invocation
      );

      // Get user's total points for display
      const totalPoints = await this.client.moderationManager.getInfractionPoints(this.guild.id, targetUser.id);

      const embed = await buildModCaseEmbed(
        this.client,
        (k, o) => this.t(k, o),
        {
          action: "WARN",
          title: `⚠️ ${await this.t("moderation:common.types.WARN")}`,
          target: {
            id: targetUser.id,
            username: targetUser.username,
            avatarURL: targetUser.displayAvatarURL({ size: 128 }),
          },
          moderator: {
            id: this.user.id,
            username: this.user.username,
            avatarURL: this.user.displayAvatarURL({ size: 128 }),
          },
          reason,
          caseNumber: case_.caseNumber,
          notified: !silent,
          timestamp: new Date(),
          thumbnailUser: "target",
        },
        this.getThemeOverrides()
      );

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      return this.createModerationError(
        "warn",
        targetUser,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if the user is still in the server\n` +
          `• Verify you have moderation permissions\n` +
          `• Ensure proper role hierarchy\n\n` +
          `📖 **Need help?** Contact an administrator.`
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
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false))
  .addStringOption((opt) =>
    opt
      .setName("style")
      .setDescription("Embed style")
      .addChoices(
        { name: "Compact", value: "compact" },
        { name: "Standard", value: "standard" },
        { name: "Detailed", value: "detailed" }
      )
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("mentions")
      .setDescription("How to show users in embeds")
      .addChoices(
        { name: "Mention", value: "mention" },
        { name: "Username", value: "username" },
        { name: "ID", value: "id" },
        { name: "Tag", value: "tag" }
      )
      .setRequired(false)
  );
