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
} from "discord.js";

import { PermissionLevel } from "../../../structures/PermissionTypes.js";
import { parseEvidence, type CommandConfig, type CommandResponse } from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Kick User Context Menu Command - Kick a user from a message context menu
 */
export class KickUserContextCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Kick User",
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
    if (!this.isMessageContextMenu()) {
      throw new Error("This command only works as a message context menu");
    }

    const interaction = this.interaction as import("discord.js").MessageContextMenuCommandInteraction;
    const targetMessage = interaction.targetMessage;
    const targetUser = targetMessage.author;

    // Validate the target user
    if (targetUser.bot) {
      return this.createModerationError("kick", targetUser, "You cannot kick bots using this command.");
    }

    if (targetUser.id === this.user.id) {
      return this.createModerationError("kick", targetUser, "You cannot kick yourself.");
    }

    // Check if user is kickable
    const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return this.createModerationError("kick", targetUser, "This user is not in the server.");
    }

    try {
      this.validateModerationTarget(member);
    } catch (error) {
      return this.createModerationError(
        "kick",
        targetUser,
        error instanceof Error ? error.message : "Cannot kick this user"
      );
    }

    if (!member.kickable) {
      return this.createModerationError(
        "kick",
        targetUser,
        "I cannot kick this user. They may have higher permissions than me."
      );
    }

    // Create evidence link and content preview
    const messageLink = `https://discord.com/channels/${this.guild.id}/${targetMessage.channel.id}/${targetMessage.id}`;
    const truncatedContent =
      targetMessage.content.length > 100 ? targetMessage.content.substring(0, 100) + "..." : targetMessage.content;

    return this.showKickConfirmation(targetUser, targetMessage, messageLink, truncatedContent);
  }

  private showKickConfirmation(
    targetUser: import("discord.js").User,
    targetMessage: import("discord.js").Message,
    messageLink: string,
    truncatedContent: string
  ): CommandResponse {
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("👢 Kick User")
      .setDescription(`Are you sure you want to kick **${targetUser.tag}**?`)
      .addFields(
        {
          name: "👤 Target User",
          value: `${targetUser} (${targetUser.tag})`,
          inline: true,
        },
        {
          name: "📝 Message Content",
          value: targetMessage.content || "*No text content*",
          inline: false,
        },
        {
          name: "🔗 Evidence",
          value: `[Jump to Message](${messageLink})`,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${this.user.tag}` });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`kick_quick_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Quick Kick")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`kick_custom_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Custom Kick")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("kick_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
    );

    // Set up interaction handlers
    this.setupInteractionHandlers(targetUser, targetMessage, messageLink, truncatedContent);

    return {
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    };
  }

  private setupInteractionHandlers(
    targetUser: import("discord.js").User,
    targetMessage: import("discord.js").Message,
    messageLink: string,
    truncatedContent: string
  ): void {
    // Handle button interactions
    const collector = this.interaction.channel?.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === this.user.id,
    });

    collector?.on("collect", (buttonInteraction: ButtonInteraction) => {
      void (async () => {
        try {
          if (buttonInteraction.customId === "kick_cancel") {
            await buttonInteraction.update({
              content: "❌ Kick cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("kick_quick_")) {
            await this.handleQuickKick(buttonInteraction, targetUser, truncatedContent, messageLink);
          }

          if (buttonInteraction.customId.startsWith("kick_custom_")) {
            await this.handleCustomKick(buttonInteraction, targetUser, targetMessage, messageLink, truncatedContent);
          }
        } catch (error) {
          console.error("Error handling kick context menu button:", error);
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
          // Do nothing
        });
    });
  }

  private async handleQuickKick(
    buttonInteraction: ButtonInteraction,
    targetUser: import("discord.js").User,
    truncatedContent: string,
    messageLink: string
  ): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = truncatedContent
      ? `Inappropriate message: "${truncatedContent}"`
      : "Inappropriate behavior (via context menu)";

    try {
      const case_ = await this.client.moderationManager.kick(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        [messageLink] // Evidence
      );

      await buttonInteraction.editReply({
        content: `✅ **${targetUser.tag}** has been kicked.\n📋 **Case #${case_.caseNumber}** created.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to kick **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleCustomKick(
    buttonInteraction: ButtonInteraction,
    targetUser: import("discord.js").User,
    targetMessage: import("discord.js").Message,
    messageLink: string,
    truncatedContent: string
  ): Promise<void> {
    // Create and show modal for custom kick details
    const modal = new ModalBuilder()
      .setCustomId(`kick_modal_${targetUser.id}_${targetMessage.id}`)
      .setTitle("Custom Kick Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("kick_reason")
      .setLabel("Reason for kick")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this kick...")
      .setValue(truncatedContent ? `Inappropriate message: "${truncatedContent}"` : "")
      .setRequired(true)
      .setMaxLength(1000);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("kick_evidence")
      .setLabel("Additional Evidence (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Additional evidence links, comma-separated...")
      .setValue(messageLink)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission
    this.setupModalHandler(targetUser, messageLink);
  }

  private setupModalHandler(targetUser: import("discord.js").User, messageLink: string): void {
    // Note: In a production implementation, you'd want a more robust way to handle this
    // This is a simplified approach for the conversion
    const modalCollector = this.interaction.channel?.createMessageComponentCollector({
      time: 300000,
      filter: (i) => i.user.id === this.user.id && i.isModalSubmit(),
    });

    modalCollector?.on("collect", (modalInteraction: ModalSubmitInteraction) => {
      void (async () => {
        if (!modalInteraction.customId.startsWith("kick_modal_")) return;

        await modalInteraction.deferReply({ ephemeral: true });

        try {
          const reasonInput = modalInteraction.fields.getTextInputValue("kick_reason");
          const evidenceStr = modalInteraction.fields.getTextInputValue("kick_evidence");

          // Expand reason alias
          const reason = await this.expandReasonAlias(reasonInput, targetUser);

          // Parse evidence
          const evidence = parseEvidence(evidenceStr);

          const case_ = await this.client.moderationManager.kick(
            this.guild,
            targetUser.id,
            this.user.id,
            reason,
            evidence.all.length > 0 ? evidence.all : [messageLink]
          );

          await modalInteraction.editReply({
            content: `✅ **${targetUser.tag}** has been kicked.\n📋 **Case #${case_.caseNumber}** created.`,
          });

          // Update the original interaction
          await this.interaction.editReply({
            content: `✅ **${targetUser.tag}** has been kicked.\n📋 **Case #${case_.caseNumber}** created.`,
            embeds: [],
            components: [],
          });
        } catch (error) {
          await modalInteraction.editReply({
            content: `❌ Failed to kick **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      })();
    });
  }
}

// Export the command instance
export default new KickUserContextCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Kick User")
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(0);
