import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

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
      // Expand alias if provided
      if (reason !== "No reason provided") {
        reason = await expandAlias(reason, {
          guild: this.guild,
          user: targetUser,
          moderator: this.user,
        });
      }

      // Check if user is in the server
      const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return {
          content: `❌ **${targetUser.tag}** is not in this server.`,
          ephemeral: true,
        };
      }

      // Check if user is actually timed out
      if (!member.isCommunicationDisabled()) {
        return {
          content: `❌ **${targetUser.tag}** is not currently timed out.`,
          ephemeral: true,
        };
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

      return {
        content: `🔊 **${targetUser.tag}** timeout has been removed.\n📋 **Case #${case_.caseNumber}** created.`,
        ephemeral: true,
      };
    } catch (error) {
      return {
        content: `❌ Failed to remove timeout from **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
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
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
