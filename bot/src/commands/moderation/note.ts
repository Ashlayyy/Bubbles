import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, type CommandConfig, type CommandResponse } from "../_core/index.js";
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

      const noteType = isInternal ? "internal" : "public";
      const notificationStatus = silent ? " (silent)" : "";

      return {
        content: `📝 Added ${noteType} note about **${targetUser.tag}**.\n📋 **Case #${case_.caseNumber}** created${notificationStatus}.`,
        ephemeral: true,
      };
    } catch (error) {
      return {
        content: `❌ Failed to add note about **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        ephemeral: true,
      };
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
