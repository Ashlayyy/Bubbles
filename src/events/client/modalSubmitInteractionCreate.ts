import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";

import { reactionRoleBuilder } from "../../commands/admin/reactionroles.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  logger.verbose("ModalSubmitInteraction created!", { interaction });

  const client = await Client.get();

  // Handle configuration modals for the new system
  if (interaction.customId.startsWith("config-modal-")) {
    const parts = interaction.customId.split("-");
    const configType = parts[2]; // title, description, color
    const builderId = parts.slice(3).join("-");

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over with `/reaction-roles create`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get the input value
    const inputValue = interaction.fields.getTextInputValue(configType);

    // Validate and update based on config type
    if (configType === "title") {
      builderData.title = inputValue;
    } else if (configType === "description") {
      builderData.description = inputValue || undefined;
    } else if (configType === "color") {
      // Validate hex color
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      builderData.embedColor = colorRegex.test(inputValue) ? inputValue : "#5865F2";
    }

    builderData.lastActivity = Date.now();

    // Show updated configuration interface
    const configEmbed = client.genEmbed({
      title: "🛠️ Reaction Role Builder",
      description: "Configure your reaction role message using the options below.",
      fields: [
        { name: "📝 Title", value: builderData.title || "*Not set*", inline: true },
        { name: "📄 Description", value: builderData.description ?? "*Not set*", inline: true },
        { name: "🎨 Color", value: builderData.embedColor, inline: true },
        {
          name: "⚡ Reactions",
          value:
            builderData.reactions.length > 0
              ? builderData.reactions
                  .map((r, i) => `${(i + 1).toString()}. ${r.emoji} → ${r.roleIds.length.toString()} role(s)`)
                  .join("\n")
              : "*No reactions added*",
          inline: false,
        },
      ],
      color: parseInt(builderData.embedColor.replace("#", ""), 16),
      footer: {
        text: `Session expires in ${Math.floor((600000 - (Date.now() - builderData.createdAt)) / 60000).toString()} minutes`,
      },
    });

    const configButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`config-title-${builderId}`)
        .setLabel("Set Title")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId(`config-description-${builderId}`)
        .setLabel("Set Description")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📄"),
      new ButtonBuilder()
        .setCustomId(`config-color-${builderId}`)
        .setLabel("Set Color")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎨")
    );

    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`add-reaction-${builderId}`)
        .setLabel("Add Reaction")
        .setStyle(ButtonStyle.Success)
        .setEmoji("➕"),
      new ButtonBuilder()
        .setCustomId(`remove-reaction-${builderId}`)
        .setLabel("Remove Reaction")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("➖")
        .setDisabled(builderData.reactions.length === 0),
      new ButtonBuilder()
        .setCustomId(`preview-${builderId}`)
        .setLabel("Preview")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("👁️"),
      new ButtonBuilder()
        .setCustomId(`send-${builderId}`)
        .setLabel("Send Message")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📤")
        .setDisabled(builderData.reactions.length === 0)
    );

    await interaction.reply({
      content: `✅ Updated ${configType}!`,
      embeds: [configEmbed],
      components: [configButtons, actionButtons],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.customId === "reaction-role-create-modal") {
    const title = interaction.fields.getTextInputValue("title");
    const description = interaction.fields.getTextInputValue("description") || undefined;
    const colorInput = interaction.fields.getTextInputValue("color") || "#5865F2";

    // Validate hex color
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const embedColor = colorRegex.test(colorInput) ? colorInput : "#5865F2";

    // Check if we have required guild/channel info
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({
        content: "❌ This command can only be used in a server channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Store the data temporarily
    const builderId = `${interaction.user.id}-${Date.now()}`;
    reactionRoleBuilder.set(builderId, {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      title,
      description,
      embedColor,
      reactions: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      validationWarnings: [],
      currentStep: "configuration",
    });

    // Create the builder interface
    const embed = new EmbedBuilder()
      .setTitle("🛠️ Reaction Role Builder")
      .setDescription("Use the buttons below to configure your reaction role message.")
      .addFields(
        { name: "Title", value: title, inline: true },
        { name: "Description", value: description ?? "*None*", inline: true },
        { name: "Color", value: embedColor, inline: true },
        { name: "Reactions", value: "*None added yet*", inline: false }
      )
      .setColor(parseInt(embedColor.replace("#", ""), 16));

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`add-reaction-${builderId}`)
        .setLabel("Add Reaction")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("➕"),
      new ButtonBuilder()
        .setCustomId(`remove-reaction-${builderId}`)
        .setLabel("Remove Reaction")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("➖")
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`preview-${builderId}`)
        .setLabel("Preview")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("👁️"),
      new ButtonBuilder()
        .setCustomId(`send-${builderId}`)
        .setLabel("Send Message")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📤")
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`cancel-builder-${builderId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      flags: MessageFlags.Ephemeral,
    });

    // Auto-cleanup after 15 minutes
    setTimeout(
      () => {
        reactionRoleBuilder.delete(builderId);
      },
      15 * 60 * 1000
    );

    return;
  }

  if (interaction.customId.startsWith("add-reaction-modal-")) {
    const builderId = interaction.customId.replace("add-reaction-modal-", "");
    if (!builderId || !reactionRoleBuilder.has(builderId)) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const emoji = interaction.fields.getTextInputValue("emoji").trim();
    const roleIds = interaction.fields
      .getTextInputValue("roles")
      .split(/[,\s]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Validate Unicode emoji format
    const emojiRegex = /^\p{Emoji}$/u;
    if (!emojiRegex.test(emoji)) {
      await interaction.reply({
        content: "❌ Invalid emoji! Please use a single Discord Unicode emoji like 🎉, ✅, 🎮, etc.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (roleIds.length === 0) {
      await interaction.reply({
        content: "❌ No valid role IDs found! Please provide at least one role ID.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    builderData.reactions.push({
      emoji,
      roleIds,
      roleValidations: [], // Add empty array for role validations
    });

    builderData.lastActivity = Date.now();
    logger.verbose(`Added reaction via modal: ${emoji} -> ${roleIds.length} roles for builder ${builderId}`);
    logger.info(`MODAL REACTION ADDED - Builder ${builderId} now has ${builderData.reactions.length} reactions`);

    // Send success message with updated configuration interface
    const successEmbed = client.genEmbed({
      title: "✅ Reaction Added Successfully!",
      description: `Added reaction: ${emoji} → ${roleIds.length.toString()} role(s)`,
      color: 0x43b581, // Green color for success
    });

    const configEmbed = client.genEmbed({
      title: "🛠️ Reaction Role Builder",
      description: "Configure your reaction role message using the options below.",
      fields: [
        { name: "📝 Title", value: builderData.title || "*Not set*", inline: true },
        { name: "📄 Description", value: builderData.description ?? "*Not set*", inline: true },
        { name: "🎨 Color", value: builderData.embedColor, inline: true },
        {
          name: "⚡ Reactions",
          value:
            builderData.reactions.length > 0
              ? builderData.reactions
                  .map((r, i: number) => `${(i + 1).toString()}. ${r.emoji} → ${r.roleIds.length.toString()} role(s)`)
                  .join("\n")
              : "*No reactions added*",
          inline: false,
        },
      ],
      color: parseInt(builderData.embedColor.replace("#", ""), 16),
      footer: {
        text: `Session expires in ${Math.floor((600000 - (Date.now() - builderData.createdAt)) / 60000).toString()} minutes`,
      },
    });

    const configButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`config-title-${builderId}`)
        .setLabel("Set Title")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📝"),
      new ButtonBuilder()
        .setCustomId(`config-description-${builderId}`)
        .setLabel("Set Description")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📄"),
      new ButtonBuilder()
        .setCustomId(`config-color-${builderId}`)
        .setLabel("Set Color")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎨")
    );

    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`add-reaction-${builderId}`)
        .setLabel("Add Reaction")
        .setStyle(ButtonStyle.Success)
        .setEmoji("➕"),
      new ButtonBuilder()
        .setCustomId(`remove-reaction-${builderId}`)
        .setLabel("Remove Reaction")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("➖")
        .setDisabled(builderData.reactions.length === 0),
      new ButtonBuilder()
        .setCustomId(`preview-${builderId}`)
        .setLabel("Preview")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("👁️"),
      new ButtonBuilder()
        .setCustomId(`send-${builderId}`)
        .setLabel("Send Message")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📤")
        .setDisabled(builderData.reactions.length === 0),
      new ButtonBuilder()
        .setCustomId(`cancel-builder-${builderId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    await interaction.reply({
      embeds: [successEmbed, configEmbed],
      components: [configButtons, actionButtons],
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // Log unhandled modal submissions
  logger.error(new ReferenceError(`Could not match customId of modal to one of this bot's: ${interaction.customId}!`));
});
