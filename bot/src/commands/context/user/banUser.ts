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
import {
  formatDuration,
  parseDuration,
  parseEvidence,
  type CommandConfig,
  type CommandResponse,
} from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Ban User Context Menu Command - Ban a user from the user context menu
 */
class BanUserCommand extends ModerationCommand {
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
    if (!this.isUserContextMenu()) {
      throw new Error("This command only works as a user context menu");
    }

    const interaction = this.interaction as import("discord.js").UserContextMenuCommandInteraction;
    const targetUser = interaction.targetUser;

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

    return this.showBanConfirmation(targetUser);
  }

  private showBanConfirmation(targetUser: User): CommandResponse {
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
        .setCustomId(`ban_quick_${targetUser.id}`)
        .setLabel("Quick Ban")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`ban_custom_${targetUser.id}`)
        .setLabel("Custom Ban")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("ban_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
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
          if (buttonInteraction.customId === "ban_cancel") {
            await buttonInteraction.update({
              content: "❌ Ban cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("ban_quick_")) {
            await this.handleQuickBan(buttonInteraction, targetUser);
          }

          if (buttonInteraction.customId.startsWith("ban_custom_")) {
            await this.handleCustomBan(buttonInteraction, targetUser);
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
          // Ignore errors on cleanup
        });
    });
  }

  private async handleQuickBan(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    await buttonInteraction.deferUpdate();

    const reason = "Banned via user context menu (Quick Ban)";

    try {
      const case_ = await this.client.moderationManager.ban(
        this.guild,
        targetUser.id,
        this.user.id,
        reason,
        undefined, // No duration (permanent)
        [] // No evidence for user context menu
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

  private async handleCustomBan(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    // Create and show modal for custom ban details
    const modal = new ModalBuilder().setCustomId(`ban_modal_${targetUser.id}`).setTitle("Custom Ban Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("ban_reason")
      .setLabel("Reason for ban")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this ban...")
      .setRequired(true)
      .setMaxLength(1000);

    const durationInput = new TextInputBuilder()
      .setCustomId("ban_duration")
      .setLabel("Duration (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., 7d, 30d, permanent")
      .setValue("permanent")
      .setRequired(false)
      .setMaxLength(20);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("ban_evidence")
      .setLabel("Evidence (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Evidence links, comma-separated...")
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission using awaitModalSubmit
    try {
      const modalInteraction = await buttonInteraction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("ban_modal_"),
      });

      await this.processBanModal(modalInteraction, targetUser);
    } catch (error) {
      // Modal submission timed out or failed
      console.error("Modal submission failed:", error);
    }
  }

  private async processBanModal(modalInteraction: ModalSubmitInteraction, targetUser: User): Promise<void> {
    const reason = modalInteraction.fields.getTextInputValue("ban_reason");
    const durationStr = modalInteraction.fields.getTextInputValue("ban_duration");
    const evidenceStr = modalInteraction.fields.getTextInputValue("ban_evidence");

    // Parse duration
    let duration: number | undefined;
    if (durationStr && durationStr.toLowerCase() !== "permanent") {
      const parsedDuration = parseDuration(durationStr);
      if (!parsedDuration) {
        await modalInteraction.reply({
          content: "❌ Invalid duration format. Use formats like: 7d, 30d, or leave empty for permanent",
          ephemeral: true,
        });
        return;
      }
      duration = parsedDuration;
    }

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const case_ = await this.client.moderationManager.ban(
        this.guild,
        targetUser.id,
        modalInteraction.user.id,
        reason,
        duration,
        evidence.all
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
  }
}

// Export the command instance
export default new BanUserCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Ban User")
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers);
