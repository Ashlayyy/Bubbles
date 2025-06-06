import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { reactionRoleBuilder, type BuilderData } from "../../commands/admin/reactionroles.js";
import { createReactionRole, createReactionRoleMessage } from "../../database/ReactionRoles.js";
import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

// Helper function to show configuration interface
const showConfigurationInterface = async (
  builderId: string,
  builderData: BuilderData,
  interaction: ButtonInteraction,
  client: Client,
  useFollowUp = false
) => {
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

  const messageOptions = {
    embeds: [configEmbed],
    components: [configButtons, actionButtons],
  };

  if (useFollowUp) {
    await interaction.followUp({
      ...messageOptions,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.update(messageOptions);
  }
};

export default new ClientEvent("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  logger.verbose("ButtonInteraction created!", { interaction });

  const client = await Client.get();
  const customId = interaction.customId;

  // Handle template selection
  if (customId.startsWith("template-")) {
    const parts = customId.split("-");
    const templateId = parts[1];
    const builderId = parts.slice(2).join("-");

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over with `/reaction-roles create`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Apply template data
    const templates = [
      {
        id: "gaming-roles",
        title: "Game Notifications",
        description: "React to get pinged when we're playing your favorite games!",
        color: "#7289DA",
      },
      {
        id: "server-notifications",
        title: "Notification Preferences",
        description: "Choose what server notifications you want to receive",
        color: "#43B581",
      },
    ];

    const selectedTemplate = templates.find((t) => t.id === templateId);
    if (selectedTemplate) {
      builderData.title = selectedTemplate.title;
      builderData.description = selectedTemplate.description;
      builderData.embedColor = selectedTemplate.color;
      builderData.templateUsed = templateId;
    }

    builderData.currentStep = "configuration";
    builderData.lastActivity = Date.now();

    await showConfigurationInterface(builderId, builderData, interaction, client);
    return;
  }

  // Handle configuration buttons
  if (customId.startsWith("config-")) {
    const parts = customId.split("-");
    const configType = parts[1];
    const builderId = parts.slice(2).join("-");

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    builderData.lastActivity = Date.now();

    // Show appropriate input method selection
    const methodEmbed = client.genEmbed({
      title: `📝 How would you like to set the ${configType}?`,
      fields: [
        { name: "💬 Chat Message", value: "Type it in the next message", inline: true },
        { name: "📋 Quick Modal", value: "Pop-up form (fastest)", inline: true },
      ],
    });

    const methodButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`input-chat-${configType}-${builderId}`)
        .setLabel("Chat Message")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💬"),
      new ButtonBuilder()
        .setCustomId(`input-modal-${configType}-${builderId}`)
        .setLabel("Quick Modal")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📋"),
      new ButtonBuilder()
        .setCustomId(`cancel-config-${builderId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    await interaction.reply({
      embeds: [methodEmbed],
      components: [methodButtons],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Handle input method selection
  if (customId.startsWith("input-")) {
    const parts = customId.split("-");
    const inputMethod = parts[1]; // chat or modal
    const configType = parts[2]; // title, description, color
    const builderId = parts.slice(3).join("-");

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (inputMethod === "modal") {
      // Show modal for the specific field
      const modal = new ModalBuilder()
        .setCustomId(`config-modal-${configType}-${builderId}`)
        .setTitle(`Set ${configType.charAt(0).toUpperCase() + configType.slice(1)}`);

      const input = new TextInputBuilder()
        .setCustomId(configType)
        .setLabel(configType.charAt(0).toUpperCase() + configType.slice(1))
        .setStyle(configType === "description" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setMaxLength(configType === "description" ? 2048 : configType === "color" ? 7 : 256)
        .setRequired(configType !== "description")
        .setPlaceholder(configType === "color" ? "#5865F2" : `Enter ${configType} here...`);

      if (configType === "title" && builderData.title) input.setValue(builderData.title);
      if (configType === "description" && builderData.description) input.setValue(builderData.description);
      if (configType === "color") input.setValue(builderData.embedColor);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    } else if (inputMethod === "chat") {
      // Set up message collector for single line format
      await interaction.reply({
        content: `💬 **Please type your ${configType} in THIS channel** using this format:\nExample: For title: \`My Awesome Title\`\n\n⏰ You have 60 seconds to type your message.`,
        flags: MessageFlags.Ephemeral,
      });

      const channel = interaction.channel;
      if (!channel || channel.isDMBased()) {
        await interaction.followUp({
          content: "❌ Message collection not supported in this channel type.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const filter = (msg: Message) => {
        const isCorrectUser = msg.author.id === interaction.user.id;
        logger.verbose(
          `Message filter check: user ${msg.author.id} === ${interaction.user.id} = ${isCorrectUser}, channel: ${msg.channel.id}`
        );
        return isCorrectUser && !msg.author.bot;
      };

      logger.verbose(`Setting up message awaiter for user ${interaction.user.id} in channel ${channel.id}`);

      try {
        const collected = await channel.awaitMessages({
          filter,
          max: 1,
          time: 60000,
          errors: ["time"],
        });

        const message = collected.first();
        if (!message) {
          await interaction.followUp({
            content: "❌ No message was collected.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        logger.verbose(`Collected message: "${message.content}" from ${message.author.id}`);

        let value: string = message.content.trim();

        // Validate color input
        if (configType === "color") {
          const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          if (!colorRegex.test(value)) {
            value = "#5865F2"; // Default color
          }
        }

        // Update builder data
        if (configType === "title") builderData.title = value;
        else if (configType === "description") builderData.description = value;
        else if (configType === "color") builderData.embedColor = value;

        builderData.lastActivity = Date.now();

        // Delete the user's message
        try {
          await message.delete();
        } catch (_error) {
          // Ignore deletion errors
        }

        // Send success message
        await interaction.followUp({
          content: `✅ Updated ${configType}: ${value}`,
          flags: MessageFlags.Ephemeral,
        });

        // Show updated configuration
        await showConfigurationInterface(builderId, builderData, interaction, client, true);
      } catch (error) {
        logger.verbose(`Message awaiter ended with error or timeout: ${error}`);
        await interaction.followUp({
          content:
            "⏰ Time expired! No message was received.\n\n💡 **Tip:** Make sure you're typing in the same channel where you used the command.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }
  }

  if (customId.startsWith("add-reaction-")) {
    const builderId = customId.replace("add-reaction-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    builderData.lastActivity = Date.now();

    // Show input method selection for adding reactions
    const methodEmbed = client.genEmbed({
      title: "➕ How would you like to add the reaction?",
      description: "Choose your preferred method to add a reaction role.",
      fields: [
        {
          name: "💬 Single Line Format",
          value: "Type: `:emoji_name: - roleId1, roleId2`\nExample: `:tada: - 123456789, 987654321`",
          inline: false,
        },
        {
          name: "📋 Separate Fields",
          value: "Fill out emoji and roles in separate fields",
          inline: false,
        },
      ],
    });

    const methodButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`input-chat-reaction-${builderId}`)
        .setLabel("Single Line")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("💬"),
      new ButtonBuilder()
        .setCustomId(`input-modal-reaction-${builderId}`)
        .setLabel("Separate Fields")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📋"),
      new ButtonBuilder()
        .setCustomId(`cancel-add-reaction-${builderId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    await interaction.reply({
      embeds: [methodEmbed],
      components: [methodButtons],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith("remove-reaction-")) {
    const builderId = customId.replace("remove-reaction-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData || builderData.reactions.length === 0) {
      await interaction.reply({
        content: "❌ No reactions to remove.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create select menu for removing reactions
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`remove-reaction-select-${builderId}`)
      .setPlaceholder("Select a reaction to remove")
      .addOptions(
        builderData.reactions.map((reaction, index) => ({
          label: `${reaction.emoji} (${reaction.roleIds.length} roles)`,
          description: `Reaction ${index + 1}`,
          value: index.toString(),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: "Select a reaction to remove:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith("preview-")) {
    const builderId = customId.replace("preview-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create preview embed
    const previewEmbed = new EmbedBuilder()
      .setTitle(builderData.title)
      .setColor(parseInt(builderData.embedColor.replace("#", ""), 16));

    if (builderData.description) {
      previewEmbed.setDescription(builderData.description);
    }

    if (builderData.reactions.length > 0) {
      const reactionText = builderData.reactions
        .map((reaction) => `${reaction.emoji} - ${reaction.roleIds.length.toString()} role(s)`)
        .join("\n");

      previewEmbed.addFields({
        name: "React to get roles:",
        value: reactionText,
        inline: false,
      });
    } else {
      previewEmbed.addFields({
        name: "React to get roles:",
        value: "*No reactions configured yet*",
        inline: false,
      });
    }

    await interaction.reply({
      content: "📋 **Preview of your reaction role message:**",
      embeds: [previewEmbed],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith("send-")) {
    const builderId = customId.replace("send-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData || builderData.reactions.length === 0) {
      await interaction.reply({
        content: "❌ Please add at least one reaction before sending.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Create the final embed
      const finalEmbed = new EmbedBuilder()
        .setTitle(builderData.title)
        .setColor(parseInt(builderData.embedColor.replace("#", ""), 16));

      if (builderData.description) {
        finalEmbed.setDescription(builderData.description);
      }

      const reactionText = builderData.reactions
        .map((reaction) => `${reaction.emoji} - ${reaction.roleIds.length.toString()} role(s)`)
        .join("\n");

      finalEmbed.addFields({
        name: "React to get roles:",
        value: reactionText,
        inline: false,
      });

      finalEmbed.setFooter({ text: "React to add • Unreact to remove" });

      // Send the message
      const channel = interaction.channel;
      if (!channel?.isTextBased() || channel.isDMBased()) {
        await interaction.reply({
          content: "❌ Cannot send message in this channel type.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const sentMessage = await channel.send({ embeds: [finalEmbed] });

      // Add reactions to the message
      for (const reaction of builderData.reactions) {
        try {
          await sentMessage.react(reaction.emoji);
        } catch (error) {
          logger.error(`Failed to add reaction ${reaction.emoji}:`, error);
        }
      }

      // Save to database
      await createReactionRoleMessage({
        guildId: builderData.guildId,
        channelId: builderData.channelId,
        messageId: sentMessage.id,
        title: builderData.title,
        description: builderData.description,
        embedColor: builderData.embedColor,
        createdBy: builderData.userId,
      });

      // Save reaction roles
      for (const reaction of builderData.reactions) {
        await createReactionRole({
          guildId: builderData.guildId,
          channelId: builderData.channelId,
          messageId: sentMessage.id,
          emoji: reaction.emoji,
          roleIds: reaction.roleIds,
          createdBy: builderData.userId,
        });
      }

      // Clean up builder data
      reactionRoleBuilder.delete(builderId);

      await interaction.reply({
        content: `✅ Reaction role message sent successfully! [Jump to message](${sentMessage.url})`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error("Failed to create reaction role message:", error);
      await interaction.reply({
        content: "❌ Failed to create the reaction role message. Please try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Handle reaction input methods
  if (customId.startsWith("input-chat-reaction-") || customId.startsWith("input-modal-reaction-")) {
    const parts = customId.split("-");
    const inputMethod = parts[1]; // chat or modal
    // parts[2] is "reaction"
    const builderId = parts.slice(3).join("-");

    const builderData = reactionRoleBuilder.get(builderId);
    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (inputMethod === "modal") {
      // Show modal with separate fields for emoji and roles
      const modal = new ModalBuilder().setCustomId(`add-reaction-modal-${builderId}`).setTitle("Add Reaction Role");

      const emojiInput = new TextInputBuilder()
        .setCustomId("emoji")
        .setLabel("Custom Emoji (:name: format only)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true)
        .setPlaceholder(":custom_emoji:");

      const rolesInput = new TextInputBuilder()
        .setCustomId("roles")
        .setLabel("Role IDs (comma/space separated)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true)
        .setPlaceholder("123456789012345678, 987654321098765432");

      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput);
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(rolesInput);

      modal.addComponents(firstRow, secondRow);

      await interaction.showModal(modal);
      return;
    } else if (inputMethod === "chat") {
      // Set up message collector for single line format
      await interaction.reply({
        content: `💬 **Please type your reaction in THIS channel** using this format:\n\`\`:emoji_name: - roleId1, roleId2\`\`\n\n**Example:** \`:tada: - 123456789, 987654321\`\n\n⏰ You have 60 seconds to type your message.`,
        flags: MessageFlags.Ephemeral,
      });

      const channel = interaction.channel;
      if (!channel || channel.isDMBased()) {
        await interaction.followUp({
          content: "❌ Message collection not supported in this channel type.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const filter = (msg: Message) => {
        const isCorrectUser = msg.author.id === interaction.user.id;
        logger.verbose(
          `Message filter check: user ${msg.author.id} === ${interaction.user.id} = ${isCorrectUser}, channel: ${msg.channel.id}`
        );
        return isCorrectUser && !msg.author.bot;
      };

      logger.verbose(`Setting up message awaiter for user ${interaction.user.id} in channel ${channel.id}`);

      try {
        const collected = await channel.awaitMessages({
          filter,
          max: 1,
          time: 60000,
          errors: ["time"],
        });

        const message = collected.first();
        if (!message) {
          await interaction.followUp({
            content: "❌ No message was collected.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        logger.verbose(`Collected message: "${message.content}" from ${message.author.id}`);

        const input = message.content.trim();

        // Parse format: :emoji: - roleId1, roleId2
        const formatRegex = /^(:[\w_]+:)\s*-\s*(.+)$/;
        const match = formatRegex.exec(input);

        if (!match) {
          try {
            await message.delete();
          } catch (_error) {
            // Ignore deletion errors
          }

          await interaction.followUp({
            content:
              "❌ Invalid format! Please use: `:emoji_name: - roleId1, roleId2`\n\nExample: `:tada: - 123456789, 987654321`",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const emoji = match[1];
        const roleIds = match[2]
          .split(/[,\s]+/)
          .map((id) => id.trim())
          .filter((id) => id.length > 0);

        if (roleIds.length === 0) {
          try {
            await message.delete();
          } catch (_error) {
            // Ignore deletion errors
          }

          await interaction.followUp({
            content: "❌ No valid role IDs found! Please provide at least one role ID.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Add the reaction to builder data
        builderData.reactions.push({
          emoji,
          roleIds,
          roleValidations: [],
        });

        builderData.lastActivity = Date.now();

        // Delete the user's message
        try {
          await message.delete();
        } catch (_error) {
          // Ignore deletion errors
        }

        // Send success message
        await interaction.followUp({
          content: `✅ Added reaction: ${emoji} → ${roleIds.length.toString()} role(s)`,
          flags: MessageFlags.Ephemeral,
        });

        // Show updated configuration
        await showConfigurationInterface(builderId, builderData, interaction, client, true);
      } catch (error) {
        logger.verbose(`Message awaiter ended with error or timeout: ${error}`);
        await interaction.followUp({
          content:
            "⏰ Time expired! No message was received.\n\n💡 **Tip:** Make sure you're typing in the same channel where you used the command, and use the exact format: `:emoji_name: - roleId1, roleId2`",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }
  }

  // Handle cancel add reaction
  if (customId.startsWith("cancel-add-reaction-")) {
    const builderId = customId.replace("cancel-add-reaction-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.update({
      content: "❌ Cancelled adding reaction.",
      embeds: [],
      components: [],
    });

    // Show configuration interface after a short delay
    setTimeout(() => {
      void (async () => {
        await showConfigurationInterface(builderId, builderData, interaction, client);
      })();
    }, 1000);
    return;
  }

  // Handle cancel builder
  if (customId.startsWith("cancel-builder-")) {
    const builderId = customId.replace("cancel-builder-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Clean up the session
    reactionRoleBuilder.delete(builderId);

    await interaction.update({
      content: "❌ Cancelled building reaction role message. Session has been ended.",
      embeds: [],
      components: [],
    });
    return;
  }

  // Handle cancel config
  if (customId.startsWith("cancel-config-")) {
    const builderId = customId.replace("cancel-config-", "");
    const builderData = reactionRoleBuilder.get(builderId);

    if (!builderData) {
      await interaction.reply({
        content: "❌ Builder session expired. Please start over.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.update({
      content: "❌ Cancelled configuration.",
      embeds: [],
      components: [],
    });

    // Show configuration interface after a short delay
    setTimeout(() => {
      void (async () => {
        await showConfigurationInterface(builderId, builderData, interaction, client);
      })();
    }, 1000);
    return;
  }
});
