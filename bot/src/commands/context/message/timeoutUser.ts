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
    .setName("Timeout User")
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async (client, interaction) => {
    if (!interaction.isMessageContextMenuCommand() || !interaction.guild) return;

    const targetMessage = interaction.targetMessage;
    const targetUser = targetMessage.author;

    // Don't allow timing out bots or the user themselves
    if (targetUser.bot) {
      await interaction.reply({
        content: "❌ You cannot timeout bots using this command.",
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: "❌ You cannot timeout yourself.",
        ephemeral: true,
      });
      return;
    }

    // Check if user is moderatable
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "❌ This user is not in the server.",
        ephemeral: true,
      });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        content: "❌ I cannot timeout this user. They may have higher permissions than me.",
        ephemeral: true,
      });
      return;
    }

    // Create evidence link
    const messageLink = `https://discord.com/channels/${interaction.guild.id}/${targetMessage.channel.id}/${targetMessage.id}`;

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
        .setCustomId(`timeout_quick_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Quick Timeout (10m)")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("⚡"),
      new ButtonBuilder()
        .setCustomId(`timeout_custom_${targetUser.id}_${targetMessage.id}`)
        .setLabel("Custom Timeout")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("⚙️"),
      new ButtonBuilder()
        .setCustomId("timeout_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("❌")
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
          if (buttonInteraction.customId === "timeout_cancel") {
            await buttonInteraction.update({
              content: "❌ Timeout cancelled.",
              embeds: [],
              components: [],
            });
            return;
          }

          if (buttonInteraction.customId.startsWith("timeout_quick_")) {
            const [, , userId] = buttonInteraction.customId.split("_");

            await buttonInteraction.deferUpdate();

            // Quick timeout with default reason and 10 minutes duration
            const truncatedContent =
              targetMessage.content.length > 100
                ? targetMessage.content.substring(0, 100) + "..."
                : targetMessage.content;
            const reason = truncatedContent
              ? `Inappropriate message: "${truncatedContent}"`
              : "Inappropriate behavior (via context menu)";

            try {
              if (!interaction.guild) return;
              const case_ = await client.moderationManager.timeout(
                interaction.guild,
                userId,
                interaction.user.id,
                10 * 60, // 10 minutes in seconds
                reason,
                [messageLink] // Evidence
              );

              await buttonInteraction.editReply({
                content: `✅ **${targetUser.tag}** has been timed out for 10 minutes.\n📋 **Case #${case_.caseNumber}** created.`,
                embeds: [],
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

          if (buttonInteraction.customId.startsWith("timeout_custom_")) {
            const [, , userId, messageId] = buttonInteraction.customId.split("_");

            // Show modal for custom timeout details
            const modal = new ModalBuilder()
              .setCustomId(`timeout_modal_${userId}_${messageId}`)
              .setTitle("Custom Timeout Details");

            const truncatedContent =
              targetMessage.content.length > 100
                ? targetMessage.content.substring(0, 100) + "..."
                : targetMessage.content;

            const reasonInput = new TextInputBuilder()
              .setCustomId("timeout_reason")
              .setLabel("Reason for timeout")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("Enter the reason for this timeout...")
              .setValue(truncatedContent ? `Inappropriate message: "${truncatedContent}"` : "")
              .setRequired(true)
              .setMaxLength(1000);

            const durationInput = new TextInputBuilder()
              .setCustomId("timeout_duration")
              .setLabel("Duration")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("e.g., 10m, 1h, 2d (max: 28d)")
              .setValue("10m")
              .setRequired(true)
              .setMaxLength(10);

            const evidenceInput = new TextInputBuilder()
              .setCustomId("timeout_evidence")
              .setLabel("Additional Evidence (optional)")
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder("Additional evidence links, comma-separated...")
              .setValue(messageLink)
              .setRequired(false)
              .setMaxLength(1000);

            const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
            const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
            const evidenceRow = new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput);

            modal.addComponents(reasonRow, durationRow, evidenceRow);

            await buttonInteraction.showModal(modal);
          }
        } catch (error) {
          console.error("Error handling timeout context menu button:", error);
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
          if (modalInteraction.customId.startsWith("timeout_modal_")) {
            const [, , userId] = modalInteraction.customId.split("_");

            await modalInteraction.deferReply({ ephemeral: true });

            let reason = modalInteraction.fields.getTextInputValue("timeout_reason");
            const durationStr = modalInteraction.fields.getTextInputValue("timeout_duration");
            const evidenceStr = modalInteraction.fields.getTextInputValue("timeout_evidence");

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

            // Parse duration
            const duration = parseDuration(durationStr);
            if (duration === null) {
              await modalInteraction.editReply({
                content: "❌ Invalid duration format. Use format like: 10m, 1h, 2d (max: 28d)",
              });
              return;
            }

            // Parse evidence
            const evidence = evidenceStr
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            try {
              if (!interaction.guild) return;
              const case_ = await client.moderationManager.timeout(
                interaction.guild,
                userId,
                interaction.user.id,
                duration,
                reason,
                evidence.length > 0 ? evidence : undefined
              );

              const durationText = formatDuration(duration);

              await modalInteraction.editReply({
                content: `✅ **${targetUser.tag}** has been timed out for ${durationText}.\n📋 **Case #${case_.caseNumber}** created.`,
              });

              // Update the original interaction
              await interaction.editReply({
                content: `✅ **${targetUser.tag}** has been timed out for ${durationText}.\n📋 **Case #${case_.caseNumber}** created.`,
                embeds: [],
                components: [],
              });
            } catch (error) {
              await modalInteraction.editReply({
                content: `❌ Failed to timeout **${targetUser.tag}**: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            }
          }
        } catch (error) {
          console.error("Error handling timeout modal:", error);
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

function parseDuration(durationStr: string): number | null {
  const regex = /^(\d+)([smhdw])$/;
  const match = regex.exec(durationStr);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
    w: 60 * 60 * 24 * 7,
  };

  const duration = value * multipliers[unit as keyof typeof multipliers];

  // Discord timeout limit is 28 days
  const maxDuration = 28 * 24 * 60 * 60; // 28 days in seconds
  if (duration > maxDuration) return null;

  return duration;
}

function formatDuration(seconds: number): string {
  const units = [
    { name: "week", seconds: 604800 },
    { name: "day", seconds: 86400 },
    { name: "hour", seconds: 3600 },
    { name: "minute", seconds: 60 },
  ];

  for (const unit of units) {
    const count = Math.floor(seconds / unit.seconds);
    if (count > 0) {
      return `${count} ${unit.name}${count !== 1 ? "s" : ""}`;
    }
  }

  return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}
