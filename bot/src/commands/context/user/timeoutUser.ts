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
import type { CommandConfig, CommandResponse } from "../../_core/index.js";
import { formatDuration, parseDuration } from "../../_core/index.js";
import { ModerationCommand } from "../../_core/specialized/ModerationCommand.js";

/**
 * Timeout User Context Menu Command
 */
class TimeoutUserCommand extends ModerationCommand {
  constructor() {
    const config: CommandConfig = {
      name: "Timeout User",
      description: "Timeout a user via user context menu",
      category: "moderation",
      permissions: {
        level: PermissionLevel.MODERATOR,
        discordPermissions: ["ModerateMembers"],
      },
      ephemeral: true,
      guildOnly: true,
    };

    super(config);
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isUserContextMenu()) {
      throw new Error("This command only supports user context menu format");
    }

    const interaction = this.interaction as import("discord.js").UserContextMenuCommandInteraction;
    const targetUser = interaction.targetUser;

    // Don't allow timing out bots or the user themselves
    if (targetUser.bot) {
      return this.createModerationError("timeout", targetUser, "You cannot timeout bots using this command.");
    }

    if (targetUser.id === this.user.id) {
      return this.createModerationError("timeout", targetUser, "You cannot timeout yourself.");
    }

    // Check if user is moderatable
    const member = await this.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return this.createModerationError("timeout", targetUser, "This user is not in the server.");
    }

    try {
      this.validateModerationTarget(member);
    } catch (error) {
      return this.createModerationError(
        "timeout",
        targetUser,
        error instanceof Error ? error.message : "Cannot timeout this user"
      );
    }

    if (!member.moderatable) {
      return this.createModerationError(
        "timeout",
        targetUser,
        "I cannot timeout this user. They may have higher permissions than me."
      );
    }

    return this.showTimeoutConfirmation(targetUser);
  }

  private showTimeoutConfirmation(targetUser: User): CommandResponse {
    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle("⏱️ Timeout User")
      .setDescription(`Are you sure you want to timeout **${targetUser.tag}**?`)
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
        .setCustomId(`timeout_quick_${targetUser.id}`)
        .setLabel("Quick Timeout (10m)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`timeout_custom_${targetUser.id}`)
        .setLabel("Custom Timeout")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder()
        .setCustomId("timeout_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("❌")
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
          if (buttonInteraction.customId === "timeout_cancel") {
            await buttonInteraction.update({
              content: "❌ Timeout cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("timeout_quick_")) {
            await this.handleQuickTimeout(buttonInteraction, targetUser);
          }

          if (buttonInteraction.customId.startsWith("timeout_custom_")) {
            await this.handleCustomTimeout(buttonInteraction, targetUser);
          }
        } catch (error) {
          console.error("Error handling timeout button interaction:", error);
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

  private buildModerationEmbed(
    duration: string,
    caseNumber: number,
    targetUser: User,
    moderator: User,
    reason?: string
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`✅ Timeout (${duration}) | Case #${caseNumber}`)
      .addFields(
        { name: "Target", value: `<@${targetUser.id}> | ${targetUser.tag}`, inline: true },
        { name: "Moderator", value: `<@${moderator.id}> | ${moderator.tag}`, inline: true }
      )
      .setTimestamp();
    if (reason) {
      embed.addFields({ name: "Reason", value: reason, inline: false });
    }
    return embed;
  }

  private async handleQuickTimeout(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    await buttonInteraction.deferUpdate();

    // Quick timeout with default reason and 10 minutes duration
    const reason = "Timed out via user context menu (Quick Timeout)";
    const durationSeconds = 10 * 60;

    try {
      const case_ = await this.client.moderationManager.timeout(
        this.guild,
        targetUser.id,
        this.user.id,
        durationSeconds,
        reason,
        [] // No evidence for user context menu
      );

      await buttonInteraction.editReply({
        embeds: [this.buildModerationEmbed("10m", case_.caseNumber, targetUser, this.user, reason)],
        components: [],
      });
    } catch (error) {
      await buttonInteraction.editReply({
        content: `❌ Failed to timeout **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
        embeds: [],
        components: [],
      });
    }
  }

  private async handleCustomTimeout(buttonInteraction: ButtonInteraction, targetUser: User): Promise<void> {
    // Create and show modal for custom timeout details
    const modal = new ModalBuilder().setCustomId(`timeout_modal_${targetUser.id}`).setTitle("Custom Timeout Details");

    const reasonInput = new TextInputBuilder()
      .setCustomId("timeout_reason")
      .setLabel("Reason for timeout")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter the reason for this timeout...")
      .setRequired(true)
      .setMaxLength(1000);

    const durationInput = new TextInputBuilder()
      .setCustomId("timeout_duration")
      .setLabel("Duration")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g., 10m, 1h, 2d")
      .setValue("10m")
      .setRequired(true)
      .setMaxLength(20);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput)
    );

    await buttonInteraction.showModal(modal);

    // Handle modal submission using awaitModalSubmit
    try {
      const modalInteraction = await buttonInteraction.awaitModalSubmit({
        time: 300000, // 5 minutes
        filter: (i) => i.user.id === this.user.id && i.customId.startsWith("timeout_modal_"),
      });

      await this.processTimeoutModal(modalInteraction, targetUser);
    } catch (error) {
      // Modal submission timed out or failed - no need to handle as user will see original message
      console.error("Modal submission failed:", error);
    }
  }

  private async processTimeoutModal(modalInteraction: ModalSubmitInteraction, targetUser: User): Promise<void> {
    const reason = modalInteraction.fields.getTextInputValue("timeout_reason");
    const durationStr = modalInteraction.fields.getTextInputValue("timeout_duration");

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
      await modalInteraction.reply({
        content: "❌ Invalid duration format. Use formats like: 10m, 1h, 2d",
        ephemeral: true,
      });
      return;
    }

    if (durationSeconds > 28 * 24 * 60 * 60) {
      // 28 days max
      await modalInteraction.reply({
        content: "❌ Maximum timeout duration is 28 days.",
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const case_ = await this.client.moderationManager.timeout(
        this.guild,
        targetUser.id,
        modalInteraction.user.id,
        durationSeconds,
        reason,
        [] // No evidence for user context menu
      );

      await modalInteraction.editReply({
        embeds: [
          this.buildModerationEmbed(
            formatDuration(durationSeconds),
            case_.caseNumber,
            targetUser,
            modalInteraction.user,
            reason
          ),
        ],
      });
    } catch (error) {
      await modalInteraction.editReply({
        content: `❌ Failed to timeout **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
}

// Export the command instance
export default new TimeoutUserCommand();

// Export the Discord command builder for registration
export const builder = new ContextMenuCommandBuilder()
  .setName("Timeout User")
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers);
