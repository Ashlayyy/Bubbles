import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";

import { PermissionLevel } from "../../../structures/PermissionTypes.js";
import { BaseCommand } from "../../_core/BaseCommand.js";
import type { CommandConfig, CommandResponse } from "../../_core/index.js";

/**
 * Report Message Context Menu Command - Report inappropriate messages
 */
class ReportMessageCommand extends BaseCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Report Message",
      description: "Report an inappropriate message to moderators",
      category: "general",
      permissions: {
        level: PermissionLevel.PUBLIC,
        discordPermissions: [],
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected execute(): CommandResponse {
    if (!this.isMessageContextMenu()) {
      throw new Error("This command only supports message context menu format");
    }

    const interaction = this.interaction as import("discord.js").MessageContextMenuCommandInteraction;
    const targetMessage = interaction.targetMessage;

    // Don't allow reporting bot messages or your own messages
    if (targetMessage.author.bot) {
      return {
        content: "❌ You cannot report bot messages.",
        ephemeral: true,
      };
    }

    if (targetMessage.author.id === this.user.id) {
      return {
        content: "❌ You cannot report your own messages.",
        ephemeral: true,
      };
    }

    // Check if message is recent enough to report
    const messageAge = Date.now() - targetMessage.createdTimestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (messageAge > maxAge) {
      return {
        content: "❌ You can only report messages that are less than 7 days old.",
        ephemeral: true,
      };
    }

    return this.showReportConfirmation(targetMessage);
  }

  private showReportConfirmation(targetMessage: Message): CommandResponse {
    const messageLink = `https://discord.com/channels/${this.guild.id}/${targetMessage.channel.id}/${targetMessage.id}`;
    const truncatedContent = this.getTruncatedContent(targetMessage);

    const embed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle("🚨 Report Message")
      .setDescription("Are you sure you want to report this message to the moderation team?")
      .addFields(
        {
          name: "👤 Message Author",
          value: `${targetMessage.author} (${targetMessage.author.tag})`,
          inline: true,
        },
        {
          name: "📅 Message Date",
          value: `<t:${Math.floor(targetMessage.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: "📝 Message Content",
          value: targetMessage.content || "*No text content*",
          inline: false,
        },
        {
          name: "🔗 Message Link",
          value: `[Jump to Message](${messageLink})`,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Report submitted by ${this.user.tag}` });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`report_confirm_${targetMessage.id}`)
        .setLabel("Submit Report")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🚨"),
      new ButtonBuilder()
        .setCustomId(`report_detailed_${targetMessage.id}`)
        .setLabel("Detailed Report")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📝"),
      new ButtonBuilder().setCustomId("report_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
    );

    // Set up interaction handlers
    this.setupInteractionHandlers(targetMessage, messageLink, truncatedContent);

    return {
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    };
  }

  private getTruncatedContent(message: Message): string {
    const content = message.content || "";
    return content.length > 100 ? content.substring(0, 100) + "..." : content;
  }

  private setupInteractionHandlers(targetMessage: Message, messageLink: string, truncatedContent: string): void {
    // Handle button interactions
    const collector = this.interaction.channel?.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === this.user.id,
    });

    collector?.on("collect", (buttonInteraction: ButtonInteraction) => {
      void (async () => {
        try {
          if (buttonInteraction.customId === "report_cancel") {
            await buttonInteraction.update({
              content: "❌ Report cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("report_confirm_")) {
            await this.handleQuickReport(buttonInteraction, targetMessage, messageLink, truncatedContent);
          }

          if (buttonInteraction.customId.startsWith("report_detailed_")) {
            await this.handleDetailedReport(buttonInteraction, targetMessage, messageLink, truncatedContent);
          }
        } catch (error) {
          console.error(
            "Error handling report button interaction:",
            error instanceof Error ? error.message : String(error)
          );
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

  private async handleQuickReport(
    buttonInteraction: ButtonInteraction,
    targetMessage: Message,
    messageLink: string,
    truncatedContent: string
  ): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = truncatedContent
      ? `Quick report - Message content: "${truncatedContent}"`
      : "Quick report - Inappropriate behavior";

    try {
      this.submitReport(targetMessage, reason, messageLink);

      await buttonInteraction.editReply({
        content:
          "✅ Your report has been submitted to the moderation team. Thank you for helping keep the server safe!",
        embeds: [],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to submit report: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleDetailedReport(
    buttonInteraction: ButtonInteraction,
    targetMessage: Message,
    messageLink: string,
    truncatedContent: string
  ): Promise<void> {
    // Create and show modal for detailed report
    const modal = new ModalBuilder().setCustomId(`report_modal_${targetMessage.id}`).setTitle("Detailed Report");

    const reasonInput = new TextInputBuilder()
      .setCustomId("report_reason")
      .setLabel("Reason for report")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Please describe why you're reporting this message...")
      .setRequired(true)
      .setMaxLength(1000);

    const contextInput = new TextInputBuilder()
      .setCustomId("report_context")
      .setLabel("Additional context (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Any additional information that might help moderators...")
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(contextInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission using awaitModalSubmit
    try {
      const modalInteraction = await buttonInteraction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("report_modal_"),
      });

      await this.processReportModal(modalInteraction, targetMessage, messageLink);
    } catch (error) {
      // Modal submission timed out or failed
      console.error("Modal submission failed:", error instanceof Error ? error.message : String(error));
    }
  }

  private async processReportModal(
    modalInteraction: ModalSubmitInteraction,
    targetMessage: Message,
    messageLink: string
  ): Promise<void> {
    const reason = modalInteraction.fields.getTextInputValue("report_reason");
    const context = modalInteraction.fields.getTextInputValue("report_context");

    const fullReason = context ? `${reason}\n\nAdditional context: ${context}` : reason;

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      this.submitReport(targetMessage, fullReason, messageLink);

      await modalInteraction.editReply({
        content:
          "✅ Your detailed report has been submitted to the moderation team. Thank you for the detailed information!",
      });

      // Update the original interaction
      await this.interaction.editReply({
        content: "✅ Your report has been submitted successfully.",
        embeds: [],
        components: [],
      });
    } catch (error) {
      await modalInteraction.editReply({
        content: `❌ Failed to submit report: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private submitReport(targetMessage: Message, reason: string, messageLink: string): void {
    // For now, log to console. In a production bot, you'd want to:
    // 1. Send to a moderation channel
    // 2. Create a case in the database
    // 3. Notify online moderators
    // 4. Maybe queue for review in your moderation system

    const reportData = {
      reportedBy: {
        id: this.user.id,
        tag: this.user.tag,
      },
      reportedUser: {
        id: targetMessage.author.id,
        tag: targetMessage.author.tag,
      },
      message: {
        id: targetMessage.id,
        content: targetMessage.content,
        channel: targetMessage.channel.id,
        timestamp: targetMessage.createdTimestamp,
        link: messageLink,
      },
      reason,
      timestamp: Date.now(),
      guild: this.guild.id,
    };

    console.log("Message Report Submitted:", JSON.stringify(reportData, null, 2));

    // TODO: Implement actual report submission logic
    // Example implementations:
    // - Send to moderation log channel
    // - Create database entry
    // - Send notification to online moderators
    // - Add to moderation queue

    // Placeholder for actual implementation
    throw new Error("Report submission not yet implemented - this is a demo");
  }
}

// Export the command instance
export default new ReportMessageCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Report Message")
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(0); // Everyone can report
