import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModCaseEmbed } from "../_shared/ModCaseEmbed.js";

/**
 * Untimeout Command - Remove timeout from a user
 */
export class UntimeoutCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "untimeout",
      description: "Remove timeout from a user",
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
    let reason = this.getStringOption("reason") ?? "No reason provided";
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Check if user is in the server
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return this.createModerationError(
          "untimeout",
          targetUser,
          `❌ **${targetUser.username}** is not a member of this server.\n\n` +
            `**User ID:** \`${targetUser.id}\`\n\n` +
            `💡 **Tip:** You can only remove timeouts from active server members.`
        );
      }

      // Check if user is actually timed out
      if (!member.isCommunicationDisabled()) {
        return this.createModerationError(
          "untimeout",
          targetUser,
          `❌ **${targetUser.username}** is not currently timed out.\n\n` +
            `💡 **Tips:**\n` +
            `• Check if the timeout has already expired\n` +
            `• Use \`/lookup user:${targetUser.username}\` to see their current status\n` +
            `• Timeouts automatically expire after their duration`
        );
      }

      // Validate moderation permissions
      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "untimeout",
          targetUser,
          `${error instanceof Error ? error.message : "Unknown validation error"}\n\n` +
            `💡 **Tip:** Make sure you have appropriate permissions and role hierarchy.`
        );
      }

      // Expand alias if provided
      if (reason !== "No reason provided") {
        reason = await expandAlias(reason, {
          guild: this.guild,
          user: targetUser,
          moderator: this.user,
        });
      }

      // Execute the untimeout using the moderation system
      const case_ = await this.client.moderationManager.moderate(this.guild, {
        type: "UNTIMEOUT",
        userId: targetUser.id,
        moderatorId: this.user.id,
        reason,
        severity: "LOW",
        points: 0, // No points for removing timeouts
        notifyUser: !silent,
      });

      const embed = await buildModCaseEmbed(
        this.client,
        (k, o) => this.t(k, o),
        {
          action: "UNTIMEOUT",
          title: `🔊 ${await this.t("moderation:common.types.UNTIMEOUT")}`,
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
        "untimeout",
        targetUser,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if the user is still in the server\n` +
          `• Verify you have timeout permissions\n` +
          `• Ensure proper role hierarchy\n` +
          `• Confirm the user is actually timed out\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
    }
  }
}

// Export the command instance
export default new UntimeoutCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("untimeout")
  .setDescription("Remove timeout from a user")
  .addUserOption((option) => option.setName("user").setDescription("The user to remove timeout from").setRequired(true))
  .addStringOption((option) =>
    option.setName("reason").setDescription("Reason for removing timeout").setRequired(false)
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
