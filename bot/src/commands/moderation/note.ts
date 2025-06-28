import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, ResponseBuilder, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Note Command - Add a note about a user
 */
export class NoteCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "note",
      description: "Add a note about a user",
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
    let content = this.getStringOption("content", true);
    const isInternal = this.getBooleanOption("internal") ?? false;
    const silent = this.getBooleanOption("silent") ?? false;

    try {
      // Validate content length
      if (content.length > 2000) {
        return this.createModerationError(
          "note",
          targetUser,
          `❌ Note content is too long: **${content.length}/2000** characters\n\n` +
            `💡 **Tip:** Keep notes concise and focused. Split longer notes into multiple entries if needed.`
        );
      }

      // Expand alias if provided
      content = await expandAlias(content, {
        guild: this.guild,
        user: targetUser,
        moderator: this.user,
      });

      // Execute the note using the moderation system
      const case_ = await this.client.moderationManager.note(
        this.guild,
        targetUser.id,
        this.user.id,
        content,
        isInternal,
        !silent
      );

      // Success response with better formatting
      const noteType = isInternal ? "internal" : "public";
      const noteIcon = isInternal ? "🔒" : "📝";

      return new ResponseBuilder()
        .success("Note Added")
        .content(
          `${noteIcon} Added **${noteType}** note about **${targetUser.username}**.\n\n` +
            `📋 **Case #${String(case_.caseNumber)}** created\n` +
            `📄 **Content:** ${content.length > 100 ? `${content.substring(0, 100)}...` : content}\n` +
            `🔐 **Visibility:** ${isInternal ? "Staff only" : "Viewable by user"}\n` +
            (!silent ? `📨 User was notified` : `🔕 Silent note (user not notified)`)
        )
        .ephemeral()
        .build();
    } catch (error) {
      return this.createModerationError(
        "note",
        targetUser,
        `${error instanceof Error ? error.message : "Unknown error"}\n\n` +
          `💡 **Common solutions:**\n` +
          `• Check if the note content is appropriate\n` +
          `• Verify you have moderation permissions\n` +
          `• Try shortening the note content\n\n` +
          `📖 **Need help?** Contact an administrator.`
      );
    }
  }
}

// Export the command instance
export default new NoteCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("note")
  .setDescription("Add a note about a user")
  .addUserOption((option) => option.setName("user").setDescription("The user to add a note about").setRequired(true))
  .addStringOption((option) => option.setName("content").setDescription("The note content").setRequired(true))
  .addBooleanOption((option) =>
    option.setName("internal").setDescription("Make this note internal (staff-only, default: false)").setRequired(false)
  )
  .addBooleanOption((option) => option.setName("silent").setDescription("Don't notify the user").setRequired(false));
