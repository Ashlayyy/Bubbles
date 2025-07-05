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
import { parseEvidence, type CommandConfig, type CommandResponse } from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Kick User Context Menu Command - Kick a user from the user context menu
 */
class KickUserCommand extends ModerationCommand {
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
    if (!this.isUserContextMenu()) {
      throw new Error("This command only works as a user context menu");
    }

    const interaction = this.interaction as import("discord.js").UserContextMenuCommandInteraction;
    const targetUser = interaction.targetUser;

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

    return this.showKickConfirmation(targetUser);
  }

  private showKickConfirmation(targetUser: User): CommandResponse {
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
        .setCustomId(`kick_quick_${targetUser.id}`)
        .setLabel("Quick Kick")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`kick_custom_${targetUser.id}`)
        .setLabel("Custom Kick")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("kick_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
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
          if (buttonInteraction.customId === "kick_cancel") {
            await buttonInteraction.update({
              content: "❌ Kick cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("kick_quick_")) {
            await this.handleQuickKick(buttonInteraction, targetUser);
          }

          if (buttonInteraction.customId.startsWith("kick_custom_")) {
            await this.handleCustomKick(buttonInteraction, targetUser);
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
          // Ignore errors on cleanup
        });
    });
  }

  private async handleQuickKick(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = "Kicked via user context menu (Quick Kick)";

    try {
      const case_ = await this.client.moderationManager.kick(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        [] // No evidence for user context menu
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

  private async handleCustomKick(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    // Create and show modal for custom kick details
    const modal = new ModalBuilder().setCustomId(`kick_modal_${targetUser.id}`).setTitle("Custom Kick Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("kick_reason")
      .setLabel("Reason for kick")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this kick...")
      .setRequired(true)
      .setMaxLength(1000);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("kick_evidence")
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
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("kick_modal_"),
      });

      await this.processKickModal(modalInteraction, targetUser);
    } catch (error) {
      // Modal submission timed out or failed
      console.error("Modal submission failed:", error);
    }
  }

  private async processKickModal(modalInteraction: ModalSubmitInteraction, targetUser: User): Promise<void> {
    const reason = modalInteraction.fields.getTextInputValue("kick_reason");
    const evidenceStr = modalInteraction.fields.getTextInputValue("kick_evidence");

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const case_ = await this.client.moderationManager.kick(
        this.guild,
        targetUser.id,
        modalInteraction.user.id,
        reason,
        evidence.all
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
  }
}

// Export the command instance
export default new KickUserCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Kick User")
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers);
