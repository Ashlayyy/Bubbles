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

export default new ClientEvent("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId.startsWith("ticket_create_")) {
    await handleTicketModalSubmit(interaction);
    return;
  }

  if (interaction.customId === "reaction-role-create-modal") {
    await handleReactionRoleCreate(interaction);
  } else if (interaction.customId.startsWith("add-reaction-role-modal-")) {
    const messageId = interaction.customId.replace("add-reaction-role-modal-", "");
    await handleAddReactionRole(interaction, messageId);
  }
});
