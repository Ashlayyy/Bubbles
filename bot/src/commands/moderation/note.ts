import { SlashCommandBuilder } from "discord.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { expandAlias, type CommandConfig, type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";
import { buildModCaseEmbed } from "../_shared/ModCaseEmbed.js";

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

      const invocation = {
        interactionId: this.interaction.id,
        commandName: this.interaction.commandName,
        interactionLatency: Date.now() - this.interaction.createdTimestamp,
      };

      // Execute the note using the moderation system
      const case_ = await this.client.moderationManager.note(
        this.guild,
        targetUser.id,
        this.user.id,
        content,
        invocation
      );

      const embed = await buildModCaseEmbed(
        this.client,
        (k, o) => this.t(k, o),
        {
          action: "NOTE",
          title: `📝 ${await this.t("moderation:common.types.NOTE")}`,
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
          reason: content,
          caseNumber: case_.caseNumber,
          timestamp: new Date(),
          thumbnailUser: "target",
        },
        this.getThemeOverrides()
      );

      return { embeds: [embed], ephemeral: true };
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
