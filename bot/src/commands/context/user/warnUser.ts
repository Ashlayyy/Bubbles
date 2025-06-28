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
  type ModalSubmitInteraction,
  type User,
} from "discord.js";

import { PermissionLevel } from "../../../structures/PermissionTypes.js";
import { parseEvidence, type CommandConfig, type CommandResponse } from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Warn User Context Menu Command - Warn a user from the user context menu
 */
class WarnUserCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Warn User",
      description: "Warn a user",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [],
        isConfigurable: true,
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isUserContextMenu()) {
      throw new Error("This command only works as a user context menu");
    }

    const interaction = this.interaction as import("discord.js").UserContextMenuCommandInteraction;
    const targetUser = interaction.targetUser;

    // Validate the target user
    if (targetUser.bot) {
      return this.createModerationError("warn", targetUser, "You cannot warn bots using this command.");
    }

    if (targetUser.id === this.user.id) {
      return this.createModerationError("warn", targetUser, "You cannot warn yourself.");
    }

    // Check if user is in the server
    const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
    if (member) {
      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "warn",
          targetUser,
          error instanceof Error ? error.message : "Cannot warn this user"
        );
      }
    }

    return this.showWarnConfirmation(targetUser);
  }

  private showWarnConfirmation(targetUser: User): CommandResponse {
    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle("⚠️ Warn User")
      .setDescription(`Are you sure you want to warn **${targetUser.tag}**?`)
      .addFields(
        {
          name: "👤 Target User",
          value: `${targetUser} (${targetUser.tag})`,
          inline: true,
        },
        {
          name: "📅 Account Created",
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
          inline: true,
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .setTimestamp()
      .setFooter({ text: `Requested by ${this.user.tag}` });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`warn_quick_${targetUser.id}`)
        .setLabel("Quick Warn")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`warn_custom_${targetUser.id}`)
        .setLabel("Custom Warn")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("warn_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
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
          if (buttonInteraction.customId === "warn_cancel") {
            await buttonInteraction.update({
              content: "❌ Warning cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("warn_quick_")) {
            await this.handleQuickWarn(buttonInteraction, targetUser);
          }

          if (buttonInteraction.customId.startsWith("warn_custom_")) {
            await this.handleCustomWarn(buttonInteraction, targetUser);
          }
        } catch (error) {
          console.error("Error handling warn context menu button:", error);
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

  private async handleQuickWarn(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = "Warned via user context menu (Quick Warn)";

    try {
      const case_ = await this.client.moderationManager.warn(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        [] // No evidence for user context menu
      );

      await buttonInteraction.editReply({
        content: `✅ **${targetUser.tag}** has been warned.\n📋 **Case #${case_.caseNumber}** created.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to warn **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleCustomWarn(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    // Create and show modal for custom warn details
    const modal = new ModalBuilder().setCustomId(`warn_modal_${targetUser.id}`).setTitle("Custom Warning Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("warn_reason")
      .setLabel("Reason for warning")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this warning...")
      .setRequired(true)
      .setMaxLength(1000);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("warn_evidence")
      .setLabel("Evidence (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Evidence links, comma-separated...")
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission using awaitModalSubmit
    try {
      const modalInteraction = await buttonInteraction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("warn_modal_"),
      });

      await this.processWarnModal(modalInteraction, targetUser);
    } catch (error) {
      // Modal submission timed out or failed
      console.error("Modal submission failed:", error);
    }
  }

  private async processWarnModal(modalInteraction: ModalSubmitInteraction, targetUser: User): Promise<void> {
    const reason = modalInteraction.fields.getTextInputValue("warn_reason");
    const evidenceStr = modalInteraction.fields.getTextInputValue("warn_evidence");

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const case_ = await this.client.moderationManager.warn(
        this.guild,
        targetUser.id,
        modalInteraction.user.id,
        reason,
        evidence.all
      );

      await modalInteraction.editReply({
        content: `✅ **${targetUser.tag}** has been warned.\n📋 **Case #${case_.caseNumber}** created.`,
      });

      // Update the original interaction
      await this.interaction.editReply({
        content: `✅ **${targetUser.tag}** has been warned.\n📋 **Case #${case_.caseNumber}** created.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await modalInteraction.editReply({
        content: `❌ Failed to warn **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
}

// Export the command instance
export default new WarnUserCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Warn User")
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(0);
