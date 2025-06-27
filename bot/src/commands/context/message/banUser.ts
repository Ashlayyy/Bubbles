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
import {
  formatDuration,
  parseDuration,
  parseEvidence,
  type CommandConfig,
  type CommandResponse,
} from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Ban User Context Menu Command - Ban a user from a message context menu
 */
export class BanUserContextCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Ban User",
      description: "Ban a user from the server",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: [PermissionsBitField.Flags.BanMembers],
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
      return this.createModerationError("ban", targetUser, "You cannot ban bots using this command.");
    }

    if (targetUser.id === this.user.id) {
      return this.createModerationError("ban", targetUser, "You cannot ban yourself.");
    }

    // Check if user is bannable
    const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
    if (member) {
      try {
        this.validateModerationTarget(member);
      } catch (error) {
        return this.createModerationError(
          "ban",
          targetUser,
          error instanceof Error ? error.message : "Cannot ban this user"
        );
      }

      if (!member.bannable) {
        return this.createModerationError(
          "ban",
          targetUser,
          "I cannot ban this user. They may have higher permissions than me."
        );
      }
    }

    // Create evidence link and content preview
    const messageLink = `https://discord.com/channels/${this.guild.id}/${targetMessage.channel.id}/${targetMessage.id}`;
    const truncatedContent =
      targetMessage.content.length > 100 ? targetMessage.content.substring(0, 100) + "..." : targetMessage.content;

    return this.showBanConfirmation(targetUser, targetMessage, messageLink, truncatedContent);
  }

  private showBanConfirmation(
    targetUser: import("discord.js").User,
    targetMessage: import("discord.js").Message,
    messageLink: string,
    truncatedContent: string
  ): CommandResponse {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔨 Ban User")
      .setDescription(`Are you sure you want to ban **${targetUser.tag}**?`)
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
        .setCustomId(`ban_quick_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Quick Ban")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`ban_custom_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Custom Ban")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("ban_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
    );

    // Set up interaction handlers (this is a simplified approach)
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
          if (buttonInteraction.customId === "ban_cancel") {
            await buttonInteraction.update({
              content: "❌ Ban cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("ban_quick_")) {
            await this.handleQuickBan(buttonInteraction, targetUser, truncatedContent, messageLink);
          }

          if (buttonInteraction.customId.startsWith("ban_custom_")) {
            await this.handleCustomBan(buttonInteraction, targetUser, targetMessage, messageLink, truncatedContent);
          }
        } catch (error) {
          console.error("Error handling ban context menu button:", error);
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

  private async handleQuickBan(
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
      const case_ = await this.client.moderationManager.ban(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        undefined, // No duration (permanent)
        [messageLink] // Evidence
      );

      await buttonInteraction.editReply({
        content: `✅ **${targetUser.tag}** has been banned permanently.\n📋 **Case #${case_.caseNumber}** created.`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to ban **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleCustomBan(
    buttonInteraction: ButtonInteraction,
    targetUser: import("discord.js").User,
    targetMessage: import("discord.js").Message,
    messageLink: string,
    truncatedContent: string
  ): Promise<void> {
    // Create and show modal for custom ban details
    const modal = new ModalBuilder()
      .setCustomId(`ban_modal_${targetUser.id}_${targetMessage.id}`)
      .setTitle("Custom Ban Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("ban_reason")
      .setLabel("Reason for ban")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this ban...")
      .setValue(truncatedContent ? `Inappropriate message: "${truncatedContent}"` : "")
      .setRequired(true)
      .setMaxLength(1000);

    const durationInput = new TextInputBuilder()
      .setCustomId("ban_duration")
      .setLabel("Duration (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., 7d, 3h, 30m (leave empty for permanent)")
      .setRequired(false)
      .setMaxLength(10);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("ban_evidence")
      .setLabel("Additional Evidence (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Additional evidence links, comma-separated...")
      .setValue(messageLink)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
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
        if (!modalInteraction.customId.startsWith("ban_modal_")) return;

        await modalInteraction.deferReply({ ephemeral: true });

        try {
          const reasonInput = modalInteraction.fields.getTextInputValue("ban_reason");
          const durationStr = modalInteraction.fields.getTextInputValue("ban_duration");
          const evidenceStr = modalInteraction.fields.getTextInputValue("ban_evidence");

          // Expand reason alias
          const reason = await this.expandReasonAlias(reasonInput, targetUser);

          // Parse duration
          let duration: number | undefined;
          if (durationStr) {
            const parsedDuration = parseDuration(durationStr);
            if (parsedDuration === null) {
              await modalInteraction.editReply({
                content: "❌ Invalid duration format. Use format like: 1d, 3h, 30m",
              });
              return;
            }
            duration = parsedDuration;
          }

          // Parse evidence
          const evidence = parseEvidence(evidenceStr);

          const case_ = await this.client.moderationManager.ban(
            this.guild,
            targetUser.id,
            this.user.id,
            reason,
            duration,
            evidence.all.length > 0 ? evidence.all : [messageLink]
          );

          const durationText = duration ? ` for ${formatDuration(duration)}` : " permanently";

          await modalInteraction.editReply({
            content: `✅ **${targetUser.tag}** has been banned${durationText}.\n📋 **Case #${case_.caseNumber}** created.`,
          });

          // Update the original interaction
          await this.interaction.editReply({
            content: `✅ **${targetUser.tag}** has been banned${durationText}.\n📋 **Case #${case_.caseNumber}** created.`,
            embeds: [],
            components: [],
          });
        } catch (error) {
          await modalInteraction.editReply({
            content: `❌ Failed to ban **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      })();
    });
  }
}

// Export the command instance
export default new BanUserContextCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Ban User")
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(0);
