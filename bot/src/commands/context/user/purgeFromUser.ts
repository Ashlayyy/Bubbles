import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type User,
} from "discord.js";

import { PermissionLevel } from "../../../structures/PermissionTypes.js";
import { type CommandConfig, type CommandResponse } from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Purge From User Context Menu Command - Purge messages from a specific user
 */
class PurgeFromUserCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Purge From User",
      description: "Purge messages from a specific user",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.ManageMessages],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected execute(): CommandResponse {
    if (!this.isUserContextMenu()) {
      throw new Error("This command only works as a user context menu");
    }

    const interaction = this.interaction as import("discord.js").UserContextMenuCommandInteraction;
    const targetUser = interaction.targetUser;

    // Validate the target user
    if (targetUser.id === this.user.id) {
      return this.createModerationError("purge", targetUser, "You cannot purge your own messages using this command.");
    }

    // Check if we're in a text channel
    if (!this.interaction.channel?.isTextBased()) {
      return this.createModerationError("purge", targetUser, "This command can only be used in text channels.");
    }

    return this.showPurgeConfirmation(targetUser);
  }

  private showPurgeConfirmation(targetUser: User): CommandResponse {
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle("🗑️ Purge Messages from User")
      .setDescription(`Are you sure you want to purge messages from **${targetUser.tag}**?`)
      .addFields(
        {
          name: "👤 Target User",
          value: `${targetUser} (${targetUser.tag})`,
          inline: true,
        },
        {
          name: "📍 Channel",
          value: `${this.interaction.channel}`,
          inline: true,
        },
        {
          name: "⚠️ Warning",
          value: "This will delete messages from this user in the current channel. This action cannot be undone!",
          inline: false,
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .setTimestamp()
      .setFooter({ text: `Requested by ${this.user.tag}` });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`purge_quick_${targetUser.id}`)
        .setLabel("Quick Purge (50 messages)")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`purge_custom_${targetUser.id}`)
        .setLabel("Custom Purge")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("purge_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
    );

    // Set up interaction handlers
    this.setupInteractionHandlers(targetUser);

    return {
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    };
  }

  private setupInteractionHandlers(targetUser: User): void {
    // Handle button interactions
    const collector = this.interaction.channel?.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === this.user.id,
    });

    collector?.on("collect", (buttonInteraction: ButtonInteraction) => {
      void (async () => {
        try {
          if (buttonInteraction.customId === "purge_cancel") {
            await buttonInteraction.update({
              content: "❌ Purge cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("purge_quick_")) {
            await this.handleQuickPurge(buttonInteraction, targetUser);
          }

          if (buttonInteraction.customId.startsWith("purge_custom_")) {
            await this.handleCustomPurge(buttonInteraction, targetUser);
          }
        } catch (error) {
          console.error("Error handling purge context menu button:", error);
          if (!buttonInteraction.replied && !buttonInteraction.deferred) {
            await buttonInteraction.reply({
              content: "❌ An error occurred. Please try again.",
              ephemeral: true,
            });
          }
        }
      })();
    });

    collector?.on("end", () => {
      // Disable buttons after timeout
      void this.interaction
        .editReply({
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("expired")
                .setLabel("Expired")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            ),
          ],
        })
        .catch(() => {
          // Ignore errors on cleanup
        });
    });
  }

  private async handleQuickPurge(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = `Purged messages from ${targetUser.tag} via user context menu`;

    try {
      const deletedCount = await this.purgeUserMessages(targetUser.id, 50, reason);

      await buttonInteraction.editReply({
        content: `✅ Successfully purged **${deletedCount}** message${deletedCount !== 1 ? "s" : ""} from **${targetUser.tag}**.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to purge messages from **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleCustomPurge(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    // Create and show modal for custom purge details
    const modal = new ModalBuilder().setCustomId(`purge_modal_${targetUser.id}`).setTitle("Custom Purge Details");

    const countInput = new TextInputBuilder()
      .setCustomId("purge_count")
      .setLabel("Number of messages to search")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter number (1-100)")
      .setValue("50")
      .setRequired(true)
      .setMaxLength(3);

    const reasonInput = new TextInputBuilder()
      .setCustomId("purge_reason")
      .setLabel("Reason (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this purge...")
      .setValue(`Purged messages from ${targetUser.tag}`)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(countInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission using awaitModalSubmit
    try {
      const modalInteraction = await buttonInteraction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("purge_modal_"),
      });

      await this.processPurgeModal(modalInteraction, targetUser);
    } catch (error) {
      // Modal submission timed out or failed
      console.error("Modal submission failed:", error);
    }
  }

  private async processPurgeModal(modalInteraction: ModalSubmitInteraction, targetUser: User): Promise<void> {
    const countStr = modalInteraction.fields.getTextInputValue("purge_count");
    const reason =
      modalInteraction.fields.getTextInputValue("purge_reason") || `Purged messages from ${targetUser.tag}`;

    const count = parseInt(countStr);
    if (isNaN(count) || count < 1 || count > 100) {
      await modalInteraction.reply({
        content: "❌ Invalid count. Please enter a number between 1 and 100.",
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const deletedCount = await this.purgeUserMessages(targetUser.id, count, reason);

      await modalInteraction.editReply({
        content: `✅ Successfully purged **${deletedCount}** message${deletedCount !== 1 ? "s" : ""} from **${targetUser.tag}**.`,
      });

      // Update the original interaction
      await this.interaction.editReply({
        content: `✅ Successfully purged **${deletedCount}** message${deletedCount !== 1 ? "s" : ""} from **${targetUser.tag}**.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await modalInteraction.editReply({
        content: `❌ Failed to purge messages from **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private async purgeUserMessages(userId: string, searchCount: number, reason: string): Promise<number> {
    const channel = this.interaction.channel;
    if (!channel?.isTextBased()) {
      throw new Error("This command can only be used in text channels");
    }

    // Fetch messages and filter by user
    const messages = await channel.messages.fetch({ limit: searchCount });
    const userMessages = messages.filter((msg) => msg.author.id === userId && msg.deletable);

    // Delete messages in bulk (Discord allows bulk delete for messages < 14 days old)
    const now = Date.now();
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const recentMessages = userMessages.filter((msg) => msg.createdTimestamp > twoWeeksAgo);
    const oldMessages = userMessages.filter((msg) => msg.createdTimestamp <= twoWeeksAgo);

    let deletedCount = 0;

    // Bulk delete recent messages (only for guild text channels)
    if (recentMessages.size > 0 && !channel.isThread() && "bulkDelete" in channel) {
      try {
        await (channel as import("discord.js").TextChannel).bulkDelete(recentMessages, true);
        deletedCount += recentMessages.size;
      } catch (error) {
        console.error("Error bulk deleting messages:", error instanceof Error ? error.message : String(error));
        // Fall back to individual deletion
        for (const message of recentMessages.values()) {
          try {
            await message.delete();
            deletedCount++;
          } catch (delError) {
            console.error("Error deleting message:", delError instanceof Error ? delError.message : String(delError));
          }
        }
      }
    } else {
      // Individual delete for non-guild channels or when bulk delete fails
      for (const message of recentMessages.values()) {
        try {
          await message.delete();
          deletedCount++;
        } catch (error) {
          console.error("Error deleting message:", error instanceof Error ? error.message : String(error));
        }
      }
    }

    // Individual delete for old messages
    for (const message of oldMessages.values()) {
      try {
        await message.delete();
        deletedCount++;
      } catch (error) {
        console.error("Error deleting old message:", error instanceof Error ? error.message : String(error));
      }
    }

    // Log the action
    if (deletedCount > 0) {
      // TODO: Add to audit log if available
      console.log(`Purged ${deletedCount} messages from user ${userId} in channel ${channel.id}. Reason: ${reason}`);
    }

    return deletedCount;
  }
}

// Export the command instance
export default new PurgeFromUserCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Purge From User")
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages);
