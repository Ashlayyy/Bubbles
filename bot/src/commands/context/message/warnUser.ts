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

import { prisma } from "../../../database/index.js";
import Command from "../../../structures/Command.js";
import { PermissionLevel } from "../../../structures/PermissionTypes.js";

export default new Command(
  new ContextMenuCommandBuilder()
    .setName("Warn User")
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async (client, interaction) => {
    if (!interaction.isMessageContextMenuCommand() || !interaction.guild) return;

    const targetMessage = interaction.targetMessage;
    const targetUser = targetMessage.author;

    // Don't allow warning bots or the user themselves
    if (targetUser.bot) {
      await interaction.reply({
        content: "❌ You cannot warn bots using this command.",
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: "❌ You cannot warn yourself.",
        ephemeral: true,
      });
      return;
    }

    // Create evidence link
    const messageLink = `https://discord.com/channels/${interaction.guild.id}/${targetMessage.channel.id}/${targetMessage.id}`;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("⚠️ Warn User")
      .setDescription(`Are you sure you want to warn **${targetUser.tag}**?`)
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
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`warn_quick_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Quick Warn")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`warn_custom_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Custom Warn")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder().setCustomId("warn_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("❌")
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });

    // Handle button interactions
    const collector = interaction.channel?.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === interaction.user.id,
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
            const [, , userId] = buttonInteraction.customId.split("_");

            await buttonInteraction.deferUpdate();

            // Quick warn with default reason
            const truncatedContent =
              targetMessage.content.length > 100
                ? targetMessage.content.substring(0, 100) + "..."
                : targetMessage.content;
            const reason = truncatedContent
              ? `Inappropriate message: "${truncatedContent}"`
              : "Inappropriate behavior (via context menu)";

            try {
              if (!interaction.guild) return;
              const case_ = await client.moderationManager.warn(
                interaction.guild,
                userId,
                interaction.user.id,
                reason,
                [messageLink] // Evidence
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

          if (buttonInteraction.customId.startsWith("warn_custom_")) {
            const [, , userId, messageId] = buttonInteraction.customId.split("_");

            // Show modal for custom warn details
            const modal = new ModalBuilder()
              .setCustomId(`warn_modal_${userId}_${messageId}`)
              .setTitle("Custom Warning Details");

            const truncatedContent =
              targetMessage.content.length > 100
                ? targetMessage.content.substring(0, 100) + "..."
                : targetMessage.content;

            const reasonInput = new TextInputBuilder()
              .setCustomId("warn_reason")
              .setLabel("Reason for warning")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("Enter the reason for this warning...")
              .setValue(truncatedContent ? `Inappropriate message: "${truncatedContent}"` : "")
              .setRequired(true)
              .setMaxLength(1000);

            const pointsInput = new TextInputBuilder()
              .setCustomId("warn_points")
              .setLabel("Warning Points (optional)")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("Default: 1 point")
              .setRequired(false)
              .setMaxLength(2);

            const evidenceInput = new TextInputBuilder()
              .setCustomId("warn_evidence")
              .setLabel("Additional Evidence (optional)")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("Additional evidence links, comma-separated...")
              .setValue(messageLink)
              .setRequired(false)
              .setMaxLength(1000);

            const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
            const pointsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(pointsInput);
            const evidenceRow = new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput);

            modal.addComponents(reasonRow, pointsRow, evidenceRow);

            await buttonInteraction.showModal(modal);
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

    // Handle modal submissions
    const modalCollector = interaction.channel?.createMessageComponentCollector({
      time: 300000, // 5 minutes
      filter: (i) => i.user.id === interaction.user.id && i.isModalSubmit(),
    });

    modalCollector?.on("collect", (modalInteraction: ModalSubmitInteraction) => {
      void (async () => {
        try {
          if (modalInteraction.customId.startsWith("warn_modal_")) {
            const [, , userId] = modalInteraction.customId.split("_");

            await modalInteraction.deferReply({ ephemeral: true });

            let reason = modalInteraction.fields.getTextInputValue("warn_reason");
            const pointsStr = modalInteraction.fields.getTextInputValue("warn_points");
            const evidenceStr = modalInteraction.fields.getTextInputValue("warn_evidence");

            // Check if reason is an alias and expand it
            if (reason && reason !== "No reason provided" && interaction.guild) {
              const aliasName = reason.toUpperCase();
              const alias = await prisma.alias.findUnique({
                where: { guildId_name: { guildId: interaction.guild.id, name: aliasName } },
              });

              if (alias) {
                // Expand alias content with variables
                reason = alias.content;
                reason = reason.replace(/\{user\}/g, `<@${targetUser.id}>`);
                reason = reason.replace(/\{server\}/g, interaction.guild.name);
                reason = reason.replace(/\{moderator\}/g, `<@${interaction.user.id}>`);

                // Update usage count
                await prisma.alias.update({
                  where: { id: alias.id },
                  data: { usageCount: { increment: 1 } },
                });
              }
            }

            // Parse points
            let points = 1; // Default
            if (pointsStr) {
              const parsedPoints = parseInt(pointsStr);
              if (!isNaN(parsedPoints) && parsedPoints > 0 && parsedPoints <= 10) {
                points = parsedPoints;
              }
            }

            // Parse evidence
            const evidence = evidenceStr
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            try {
              if (!interaction.guild) return;
              const case_ = await client.moderationManager.warn(
                interaction.guild,
                userId,
                interaction.user.id,
                reason,
                evidence.length > 0 ? evidence : undefined,
                points
              );

              await modalInteraction.editReply({
                content: `✅ **${targetUser.tag}** has been warned (${points} point${points !== 1 ? "s" : ""}).\n📋 **Case #${case_.caseNumber}** created.`,
              });

              // Update the original interaction
              await interaction.editReply({
                content: `✅ **${targetUser.tag}** has been warned (${points} point${points !== 1 ? "s" : ""}).\n📋 **Case #${case_.caseNumber}** created.`,
                embeds: [],
                components: [],
              });
            } catch (error) {
              await modalInteraction.editReply({
                content: `❌ Failed to warn **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            }
          }
        } catch (error) {
          console.error("Error handling warn modal:", error);
          if (!modalInteraction.replied && !modalInteraction.deferred) {
            await modalInteraction.reply({
              content: "❌ An error occurred. Please try again.",
              ephemeral: true,
            });
          }
        }
      })();
    });

    collector?.on("end", () => {
      // Disable buttons after timeout
      const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttons.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
      );

      void interaction.editReply({ components: [disabledButtons] }).catch(() => {
        // Ignore errors if message was deleted
      });
    });
  },
  {
    ephemeral: true,
    enabledOnDev: true,
    permissions: {
      level: PermissionLevel.MODERATOR,
      discordPermissions: [PermissionsBitField.Flags.ModerateMembers],
      isConfigurable: true,
    },
  }
);
