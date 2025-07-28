import { EmbedBuilder, ModalSubmitInteraction, type Interaction } from "discord.js";
import { createReactionRole, createReactionRoleMessage } from "../../database/ReactionRoles.js";
import { handleTicketModalSubmit } from "../../functions/discord/ticketManager.js";
import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

function getDbEmoji(emoji: string): string {
  const customEmojiRegex = /<a?:(\w+):(\d+)>/;
  const match = customEmojiRegex.exec(emoji);
  if (match) {
    const name = match[1];
    const id = match[2];
    return `${id}:${name}`;
  }
  return emoji;
}

async function handleReactionRoleCreate(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue("title");
  const description = interaction.fields.getTextInputValue("description");
  const rolesRaw = interaction.fields.getTextInputValue("roles");
  const channelId = interaction.fields.getTextInputValue("channel");
  const color = interaction.fields.getTextInputValue("color");

  const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.editReply("Invalid channel ID provided or channel is not a text-based guild channel.");
    return;
  }

  const rolePairs: { emoji: string; roleId: string }[] = [];
  const errors: string[] = [];

  const lines = rolesRaw.split("\n").filter((line) => line.trim() !== "");

  for (const line of lines) {
    const emojiMatch = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)/u.exec(line);
    const roleMatch = /<@&(\d+)>/u.exec(line);

    if (!emojiMatch || !roleMatch) {
      errors.push(`Invalid format: \`${line}\`. Each line must contain one emoji and one role mention.`);
      continue;
    }

    const emoji = emojiMatch[0];
    const roleId = roleMatch[1];
    const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);
    if (!role) {
      errors.push(`Could not find role in line: \`${line}\``);
      continue;
    }

    rolePairs.push({ emoji, roleId });
  }

  if (errors.length > 0) {
    await interaction.editReply({
      content: "Errors found while parsing roles:",
      embeds: [new EmbedBuilder().setColor("Red").setDescription(errors.join("\n"))],
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || null)
    .setColor(color && /^#[0-9A-F]{6}$/i.test(color) ? (color as `#${string}`) : "Blurple");

  try {
    const message = await channel.send({ embeds: [embed] });

    await createReactionRoleMessage({
      guildId: interaction.guildId,
      channelId: channel.id,
      messageId: message.id,
      title: title,
      description: description,
      embedColor: color,
      createdBy: interaction.user.id,
    });

    for (const pair of rolePairs) {
      const emojiForDb = getDbEmoji(pair.emoji);

      await message.react(pair.emoji);
      await createReactionRole({
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: message.id,
        emoji: emojiForDb,
        roleIds: [pair.roleId],
        createdBy: interaction.user.id,
      });
    }

    await interaction.editReply({
      content: `✅ Reaction role message created successfully!`,
      embeds: [new EmbedBuilder().setDescription(`[Jump to message](${message.url})`).setColor("Green")],
    });
  } catch (e) {
    logger.error("Failed to create reaction role message:", e);
    await interaction.editReply(
      "An error occurred while creating the reaction role message. The bot may be missing permissions (View Channel, Send Messages, Add Reactions)."
    );
  }
}

async function handleAddReactionRole(interaction: ModalSubmitInteraction, messageId: string) {
  if (!interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });

  const emoji = interaction.fields.getTextInputValue("emoji");
  const roleIdentifier = interaction.fields.getTextInputValue("role");

  const role = interaction.guild?.roles.cache.find((r) => r.name === roleIdentifier || r.id === roleIdentifier);
  if (!role) {
    await interaction.editReply(`Could not find a role with the name or ID: \`${roleIdentifier}\``);
    return;
  }

  const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
  if (!message) {
    await interaction.editReply("Could not find the target message. It may have been deleted.");
    return;
  }

  try {
    const emojiForDb = getDbEmoji(emoji);
    await message.react(emoji);
    await createReactionRole({
      guildId: interaction.guildId,
      channelId: message.channelId,
      messageId: message.id,
      emoji: emojiForDb,
      roleIds: [role.id],
      createdBy: interaction.user.id,
    });

    await interaction.editReply(`Successfully added reaction role: ${emoji} will now grant the @${role.name} role.`);
  } catch (e) {
    logger.error("Failed to add reaction role via context menu:", e);
    await interaction.editReply(
      "Failed to add reaction role. The emoji may be invalid or the bot may be missing permissions."
    );
  }
}

async function handleBanModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace("ban_modal_", "");
    const reason = interaction.fields.getTextInputValue("ban_reason");
    const durationStr = interaction.fields.getTextInputValue("ban_duration");
    const evidenceStr = interaction.fields.getTextInputValue("ban_evidence");

    // Import required functions
    const { parseDuration, formatDuration, parseEvidence } = await import("../../commands/_core/index.js");

    // Parse duration
    let duration: number | undefined;
    let durationText: string | undefined = undefined;
    if (durationStr && durationStr.toLowerCase() !== "permanent") {
      const parsedDuration = parseDuration(durationStr);
      if (!parsedDuration) {
        await interaction.editReply({
          content: "❌ Invalid duration format. Use formats like: 7d, 30d, or leave empty for permanent",
        });
        return;
      }
      duration = parsedDuration;
      durationText = formatDuration(duration);
    }

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    // Get the moderation manager and perform the ban
    const client = interaction.client as import("../../structures/Client.js").default;
    const case_ = await client.moderationManager.ban(
      interaction.guild,
      userId,
      interaction.user.id,
      reason,
      duration,
      evidence.all
    );

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔨 User Banned")
      .setDescription(`**${durationText || "Permanent"}** ban applied to <@${userId}>`)
      .addFields(
        { name: "Case", value: `#${case_.caseNumber}`, inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error handling ban modal:", error);
    await interaction.editReply({
      content: `❌ Failed to ban user: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleKickModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace("kick_modal_", "");
    const reason = interaction.fields.getTextInputValue("kick_reason");
    const evidenceStr = interaction.fields.getTextInputValue("kick_evidence");

    // Import required functions
    const { parseEvidence } = await import("../../commands/_core/index.js");

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    // Get the moderation manager and perform the kick
    const client = interaction.client as import("../../structures/Client.js").default;
    const case_ = await client.moderationManager.kick(
      interaction.guild,
      userId,
      interaction.user.id,
      reason,
      evidence.all
    );

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("👢 User Kicked")
      .setDescription(`<@${userId}> has been kicked from the server`)
      .addFields(
        { name: "Case", value: `#${case_.caseNumber}`, inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error handling kick modal:", error);
    await interaction.editReply({
      content: `❌ Failed to kick user: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleTimeoutModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace("timeout_modal_", "");
    const reason = interaction.fields.getTextInputValue("timeout_reason");
    const durationStr = interaction.fields.getTextInputValue("timeout_duration");

    // Import required functions
    const { parseDuration, formatDuration } = await import("../../commands/_core/index.js");

    const durationSeconds = parseDuration(durationStr);
    if (!durationSeconds) {
      await interaction.editReply({
        content: "❌ Invalid duration format. Use formats like: 10m, 1h, 2d",
      });
      return;
    }

    if (durationSeconds > 28 * 24 * 60 * 60) {
      await interaction.editReply({
        content: "❌ Maximum timeout duration is 28 days.",
      });
      return;
    }

    // Get the moderation manager and perform the timeout
    const client = interaction.client as import("../../structures/Client.js").default;
    const case_ = await client.moderationManager.timeout(
      interaction.guild,
      userId,
      interaction.user.id,
      durationSeconds,
      reason,
      [] // No evidence for user context menu
    );

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("⏰ User Timed Out")
      .setDescription(`<@${userId}> has been timed out for **${formatDuration(durationSeconds)}**`)
      .addFields(
        { name: "Case", value: `#${case_.caseNumber}`, inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error handling timeout modal:", error);
    await interaction.editReply({
      content: `❌ Failed to timeout user: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleWarnModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace("warn_modal_", "");
    const reason = interaction.fields.getTextInputValue("warn_reason");
    const evidenceStr = interaction.fields.getTextInputValue("warn_evidence");

    // Import required functions
    const { parseEvidence } = await import("../../commands/_core/index.js");

    // Parse evidence
    const evidence = evidenceStr ? parseEvidence(evidenceStr) : { all: [] };

    // Get the moderation manager and perform the warn
    const client = interaction.client as import("../../structures/Client.js").default;
    const case_ = await client.moderationManager.warn(
      interaction.guild,
      userId,
      interaction.user.id,
      reason,
      evidence.all
    );

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("⚠️ User Warned")
      .setDescription(`<@${userId}> has been warned`)
      .addFields(
        { name: "Case", value: `#${case_.caseNumber}`, inline: true },
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error handling warn modal:", error);
    await interaction.editReply({
      content: `❌ Failed to warn user: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handlePurgeModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.customId.replace("purge_modal_", "");
    const countStr = interaction.fields.getTextInputValue("purge_count");
    const reason = interaction.fields.getTextInputValue("purge_reason");

    const count = parseInt(countStr);
    if (isNaN(count) || count < 1 || count > 100) {
      await interaction.editReply({
        content: "❌ Invalid count. Please enter a number between 1 and 100.",
      });
      return;
    }

    // Fetch messages and delete them
    const messages = await interaction.channel?.messages.fetch({ limit: count });
    if (!messages) {
      await interaction.editReply({
        content: "❌ Could not fetch messages from this channel.",
      });
      return;
    }

    const userMessages = messages.filter((msg) => msg.author.id === userId);
    if (userMessages.size === 0) {
      await interaction.editReply({
        content: "❌ No messages found from this user in the recent message history.",
      });
      return;
    }

    // Delete messages
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.editReply({
        content: "❌ Cannot delete messages in this channel type.",
      });
      return;
    }
    const deletedMessages = await channel.bulkDelete(userMessages, true);
    const deletedCount = deletedMessages?.size || 0;

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Messages Purged")
      .setDescription(`Deleted **${deletedCount}** messages from <@${userId}>`)
      .addFields(
        { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error handling purge modal:", error);
    await interaction.editReply({
      content: `❌ Failed to purge messages: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleReportModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  try {
    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.customId.replace("report_modal_", "");
    const reason = interaction.fields.getTextInputValue("report_reason");
    const context = interaction.fields.getTextInputValue("report_context");

    const fullReason = context ? `${reason}\n\nAdditional context: ${context}` : reason;

    // Get guild config for report channel
    const { getGuildConfig } = await import("../../database/GuildConfig.js");
    const config = await getGuildConfig(interaction.guild.id);

    if (!config.reportChannelId) {
      await interaction.editReply({
        content: "❌ Report system not configured. Please contact an administrator.",
      });
      return;
    }

    // Get the reported message
    const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.editReply({
        content: "❌ Could not find the reported message. It may have been deleted.",
      });
      return;
    }

    // Build report embed
    const reportEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🚨 Message Reported")
      .setDescription(`A message has been reported by <@${interaction.user.id}>`)
      .addFields(
        { name: "Reported Message", value: `[Jump to message](${message.url})`, inline: true },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "Author", value: `<@${message.author.id}>`, inline: true },
        { name: "Reason", value: fullReason, inline: false }
      )
      .setTimestamp();

    // Send report to report channel
    const reportChannel = await interaction.guild.channels.fetch(config.reportChannelId).catch(() => null);
    if (reportChannel && reportChannel.isTextBased()) {
      await reportChannel.send({ embeds: [reportEmbed] });
    }

    // Confirm to user
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Report Submitted")
      .setDescription("Your report has been submitted to the moderation team.")
      .addFields(
        { name: "Reported Message", value: `[Jump to message](${message.url})`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed] });
  } catch (error) {
    logger.error("Error handling report modal:", error);
    await interaction.editReply({
      content: `❌ Failed to submit report: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isModalSubmit()) return;

  // Log all modal submissions for debugging
  logger.debug(
    `Modal submitted: ${interaction.customId} by ${interaction.user.tag} in ${interaction.guild?.name || "DM"}`
  );

  // Handle ticket modals
  if (interaction.customId.startsWith("ticket_create_") || interaction.customId.startsWith("ticket_close_reason_")) {
    await handleTicketModalSubmit(interaction);
    return;
  }

  // Handle reaction role modals
  if (interaction.customId === "reaction-role-create-modal") {
    await handleReactionRoleCreate(interaction);
    return;
  }

  if (interaction.customId.startsWith("add-reaction-role-modal-")) {
    const messageId = interaction.customId.replace("add-reaction-role-modal-", "");
    await handleAddReactionRole(interaction, messageId);
    return;
  }

  // Handle reaction role builder modals (fallback)
  // These are handled by awaitModalSubmit in the reaction role builder, so we don't need to handle them here
  // Removing this to prevent conflicts with the reaction role builder
  if (
    interaction.customId === "rr_title_modal" ||
    interaction.customId === "rr_desc_modal" ||
    interaction.customId === "custom_color_modal"
  ) {
    logger.debug(
      `Reaction role builder modal ${interaction.customId} already handled by awaitModalSubmit, skipping global handler`
    );
    return;
  }

  // Handle compliment wheel modals (fallback)
  if (interaction.customId === "compliment_embed_modal" || interaction.customId === "compliment_config_modal") {
    logger.debug(`Compliment wheel modal submitted: ${interaction.customId}, handled by setup wizard`);
    // Don't return here - let the collector handle it first, this is just a fallback
    // The collector should handle it, but if it doesn't, this will catch it
    return;
  }

  // Handle moderation context menu modals (fallback for orphaned modals)
  if (interaction.customId.startsWith("ban_modal_")) {
    await handleBanModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("kick_modal_")) {
    await handleKickModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("timeout_modal_")) {
    await handleTimeoutModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("warn_modal_")) {
    await handleWarnModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("purge_modal_")) {
    await handlePurgeModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("report_modal_")) {
    await handleReportModal(interaction);
    return;
  }

  // Log unknown modal customIds for debugging
  logger.warn(`Unknown modal customId: ${interaction.customId} from user ${interaction.user.tag}`);
});
