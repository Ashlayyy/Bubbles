import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";

import logger from "../../../logger.js";
import { ComplimentWheelService } from "../../../services/complimentWheelService.js";
import type Client from "../../../structures/Client.js";
import {
  BUTTON_STYLES,
  WIZARD_COLORS,
  WIZARD_EMOJIS,
  createButtonRow,
  createChannelSelect,
  createChannelSelectRow,
  createHelpButton,
  createTestButton,
} from "./WizardComponents.js";

// Export only the wizard function - no standalone command
export { startComplimentenWizard };

interface ComplimentWizardState {
  messageId: string;
  channelId: string;
  complimentChannelId: string;
  emoji: string;
  pinnedRoleId: string;
  embed: {
    title: string;
    description: string;
    color: number;
  };
}

async function startComplimentenWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  // Load current settings
  let currentConfig: any = null;
  try {
    const wheelService = ComplimentWheelService.getInstance(client);
    currentConfig = await wheelService.getWheelConfig(interaction.guild.id);
  } catch (error) {
    logger.error("Error loading compliment wheel config:", error);
    // Continue with default values
  }

  const wizardEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.PRIMARY)
    .setTitle(`${WIZARD_EMOJIS.REACTION_ROLES} Compliment Wheel Setup Wizard`)
    .setDescription(
      "Welcome to the **Compliment Wheel Setup Wizard**!\n\n" +
        "Configure the compliment wheel system to randomly select users for daily compliments.\n\n" +
        "• **Message Channel** – Where users react to join the wheel\n" +
        "• **Compliment Channel** – Where daily compliments are posted\n" +
        "• **Pinned Role** – Role to mention in the daily message\n" +
        "• **Custom Embed** – Title, description, color\n" +
        "• **Emoji** – Reaction emoji to monitor\n" +
        "• **Test System** – Verify everything is working correctly"
    )
    .addFields(
      {
        name: "Current Settings",
        value: currentConfig
          ? `• Status: ✅ Active\n• Message Channel: <#${currentConfig.channelId}>\n• Compliment Channel: <#${currentConfig.complimentChannelId}>\n• Emoji: ${currentConfig.emoji}`
          : "• Status: ❌ Not configured",
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select the message channel (where users react)\n" +
          "2. Select the compliment channel (where daily posts go)\n" +
          "3. Select the role to mention\n" +
          "4. Configure the embed (title, description, color)\n" +
          "5. Configure the message ID and emoji\n" +
          "6. Test the system",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menus
  const messageChannelSelect = createChannelSelect("compliment_message_channel_select", "Select message channel", 1, 1);
  const complimentChannelSelect = createChannelSelect("compliment_channel_select", "Select compliment channel", 1, 1);
  const pinnedRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId("compliment_pinned_role_select")
    .setPlaceholder("Select role to mention (optional)")
    .setMinValues(0)
    .setMaxValues(1);

  const embedEditButton = new ButtonBuilder()
    .setCustomId("compliment_embed_edit")
    .setLabel("Edit Embed")
    .setStyle(BUTTON_STYLES.PRIMARY);

  const setupButton = new ButtonBuilder()
    .setCustomId("compliment_setup_config")
    .setLabel("Configure Message & Emoji")
    .setStyle(BUTTON_STYLES.PRIMARY);

  const testButton = createTestButton("compliment_test", "Test System");
  const helpButton = createHelpButton("compliment_help", "Help & Info");

  const components = [
    createChannelSelectRow(messageChannelSelect),
    createChannelSelectRow(complimentChannelSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(pinnedRoleSelect),
    createButtonRow(embedEditButton, setupButton, testButton, helpButton),
  ];

  // Check interaction state before replying
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ embeds: [wizardEmbed], components: components, ephemeral: true });
  } else if (interaction.deferred) {
    await interaction.editReply({ embeds: [wizardEmbed], components: components });
  } else {
    // If already replied, send a follow-up
    await interaction.followUp({ embeds: [wizardEmbed], components: components, ephemeral: true });
  }

  logger.debug("Creating message component collector for compliment wizard");
  const collector = interaction.channel?.createMessageComponentCollector({
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  if (!collector) {
    logger.error("Failed to create collector - channel is null");
    return;
  }

  logger.debug("Collector created successfully");

  // Store wizard state
  const wizardState: ComplimentWizardState = {
    messageId: "",
    channelId: "",
    complimentChannelId: "",
    emoji: "",
    pinnedRoleId: "",
    embed: {
      title: "🎉 Persoon van de dag!",
      description:
        "<@USER_ID> is de persoon van de dag!\n*Geef zoveel complimenten als je wilt, zolang ze maar over <@USER_ID> gaan!*",
      color: WIZARD_COLORS.PRIMARY,
    },
  };

  collector?.on("collect", (interactionComponent: any) => {
    logger.debug(
      `Collector received interaction: ${interactionComponent.customId} (type: ${interactionComponent.constructor.name})`
    );
    void (async () => {
      try {
        if (interactionComponent.isChannelSelectMenu()) {
          const menu = interactionComponent;
          if (menu.customId === "compliment_message_channel_select") {
            const selectedChannelId = menu.values[0];
            if (!selectedChannelId) {
              await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
              return;
            }
            wizardState.channelId = selectedChannelId;
            await menu.reply({ content: `✅ Message channel set to <#${selectedChannelId}>`, ephemeral: true });
          } else if (menu.customId === "compliment_channel_select") {
            const selectedChannelId = menu.values[0];
            if (!selectedChannelId) {
              await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
              return;
            }
            wizardState.complimentChannelId = selectedChannelId;
            await menu.reply({ content: `✅ Compliment channel set to <#${selectedChannelId}>`, ephemeral: true });
          }
        } else if (
          interactionComponent.isRoleSelectMenu &&
          interactionComponent.customId === "compliment_pinned_role_select"
        ) {
          const menu = interactionComponent as RoleSelectMenuInteraction;
          wizardState.pinnedRoleId = menu.values[0] || "";
          await menu.reply({
            content: wizardState.pinnedRoleId
              ? `✅ Pinned role set to <@&${wizardState.pinnedRoleId}>`
              : "❌ No role selected.",
            ephemeral: true,
          });
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "compliment_embed_edit": {
              await showEmbedEditModal(btn, wizardState);
              // Wait for modal submission
              const modalSubmitted = await btn
                .awaitModalSubmit({
                  time: 60000,
                  filter: (i) => i.customId === "compliment_embed_modal" && i.user.id === interaction.user.id,
                })
                .catch(() => null);

              if (modalSubmitted) {
                logger.debug("Modal submitted via awaitModalSubmit, processing...");
                await handleEmbedEditModalSubmit(modalSubmitted, wizardState);
              } else {
                logger.debug("Modal submission timed out or was cancelled");
              }
              break;
            }
            case "compliment_setup_config":
              await showConfigModal(btn);
              break;
            case "compliment_test":
              await handleTestCompliment(client, btn, wizardState);
              break;
            case "compliment_help":
              await showComplimentHelp(btn);
              break;
            default:
              await btn.reply({
                content: "❌ Unknown button interaction. Please try again.",
                ephemeral: true,
              });
              break;
          }
        } else if (interactionComponent.isModalSubmit()) {
          const modal = interactionComponent;
          logger.debug(
            `Compliment wizard received modal: ${modal.customId} (this should not happen with awaitModalSubmit)`
          );
          // Modals should be handled by awaitModalSubmit, not the collector
          // This is just a fallback in case something goes wrong
        }
      } catch (error) {
        logger.error("Compliment wizard error:", error);
        if (!interactionComponent.replied && !interactionComponent.deferred) {
          await interactionComponent.reply({ content: "❌ An error occurred.", ephemeral: true });
        } else if (interactionComponent.deferred) {
          await interactionComponent.editReply({ content: "❌ An error occurred." });
        } else if (interactionComponent.replied) {
          await interactionComponent.followUp({ content: "❌ An error occurred.", ephemeral: true });
        }
      }
    })();
  });
}

async function showEmbedEditModal(interaction: ButtonInteraction, wizardState: ComplimentWizardState) {
  const modal = new ModalBuilder().setCustomId("compliment_embed_modal").setTitle("Edit Compliment Embed");
  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Embed Title")
    .setStyle(TextInputStyle.Short)
    .setValue(wizardState.embed.title)
    .setMaxLength(256)
    .setRequired(true);
  const descInput = new TextInputBuilder()
    .setCustomId("embed_desc")
    .setLabel("Embed Description")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(wizardState.embed.description)
    .setMaxLength(2048)
    .setRequired(true);
  const colorInput = new TextInputBuilder()
    .setCustomId("embed_color")
    .setLabel("Embed Color (hex, e.g. #00bfff)")
    .setStyle(TextInputStyle.Short)
    .setValue(`#${wizardState.embed.color.toString(16).padStart(6, "0")}`)
    .setMaxLength(7)
    .setRequired(true);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput)
  );
  await interaction.showModal(modal);
}

async function handleEmbedEditModalSubmit(modal: ModalSubmitInteraction, wizardState: ComplimentWizardState) {
  logger.debug("handleEmbedEditModalSubmit called");
  try {
    logger.debug("Extracting modal fields");
    const newTitle = modal.fields.getTextInputValue("embed_title");
    const newDescription = modal.fields.getTextInputValue("embed_desc");
    const colorStr = modal.fields.getTextInputValue("embed_color").replace("#", "");
    const newColor = parseInt(colorStr, 16) || WIZARD_COLORS.PRIMARY;

    logger.debug("Modal field values:", {
      title: newTitle,
      description: newDescription.substring(0, 50) + "...",
      colorStr,
      newColor: `#${newColor.toString(16).padStart(6, "0")}`,
    });

    // Validate color
    if (isNaN(newColor) || newColor < 0 || newColor > 0xffffff) {
      await modal.reply({
        content: "❌ Invalid color format. Please use a valid hex color (e.g., #00bfff).",
        ephemeral: true,
      });
      return;
    }

    // Update wizard state
    wizardState.embed.title = newTitle;
    wizardState.embed.description = newDescription;
    wizardState.embed.color = newColor;

    // Log the changes
    logger.info(`Compliment wheel embed updated by ${modal.user.tag} in guild ${modal.guild?.name}:`, {
      title: newTitle,
      description: newDescription.substring(0, 100) + (newDescription.length > 100 ? "..." : ""),
      color: `#${newColor.toString(16).padStart(6, "0")}`,
    });

    // Show preview and confirmation
    const previewEmbed = new EmbedBuilder()
      .setTitle(newTitle)
      .setDescription(newDescription)
      .setColor(newColor)
      .setFooter({ text: "Preview - Embed settings updated successfully!" });

    logger.debug("About to send modal reply");
    await modal.reply({
      embeds: [previewEmbed],
      ephemeral: true,
      content: "✅ Embed settings have been updated successfully!",
    });
    logger.debug("Modal reply sent successfully");
  } catch (error) {
    logger.error("Error handling embed edit modal:", error);
    await modal.reply({
      content: "❌ Failed to update embed settings. Please try again.",
      ephemeral: true,
    });
  }
  logger.debug("handleEmbedEditModalSubmit completed");
}

async function showConfigModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId("compliment_config_modal").setTitle("Compliment Wheel Configuration");

  const messageIdInput = new TextInputBuilder()
    .setCustomId("message_id")
    .setLabel("Message ID")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter the ID of the message users should react to")
    .setRequired(true)
    .setMaxLength(20);

  const emojiInput = new TextInputBuilder()
    .setCustomId("emoji")
    .setLabel("Emoji")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter the emoji users should react with (e.g., ❤️, 👍, 🎉)")
    .setRequired(true)
    .setMaxLength(10);

  const customMessageInput = new TextInputBuilder()
    .setCustomId("custom_message")
    .setLabel("Custom Message (Optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Custom message for daily compliments. Use <@USER_ID> to mention the winner.")
    .setRequired(false)
    .setMaxLength(1000);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageIdInput);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emojiInput);
  const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(customMessageInput);

  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

  await interaction.showModal(modal);
}

async function handleConfigModalSubmit(
  client: Client,
  interaction: ModalSubmitInteraction,
  wizardState: ComplimentWizardState
): Promise<void> {
  const messageId = interaction.fields.getTextInputValue("message_id");
  const emoji = interaction.fields.getTextInputValue("emoji");

  wizardState.messageId = messageId;
  wizardState.emoji = emoji;

  try {
    // Validate the message exists
    const channel = await interaction.guild?.channels.fetch(wizardState.channelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        content: "❌ Invalid message channel. Please select a text channel.",
        ephemeral: true,
      });
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await interaction.reply({
        content:
          "❌ Message not found. Please make sure the message ID is correct and the message is in the specified channel.",
        ephemeral: true,
      });
      return;
    }

    // Test if the bot can use this emoji
    try {
      await message.react(emoji);
    } catch (emojiError) {
      await interaction.reply({
        content: `❌ Invalid emoji or the bot cannot use this emoji. Please make sure the emoji is valid and the bot has permission to use it in this channel.`,
        ephemeral: true,
      });
      return;
    }

    // Setup the wheel
    const wheelService = ComplimentWheelService.getInstance(client);

    // Fetch all users who already reacted with the emoji (excluding bots and users not in the guild)
    const reaction = message.reactions.cache.get(emoji);
    if (reaction) {
      const users = await reaction.users.fetch();
      for (const [userId, user] of users) {
        if (user.bot) continue;
        // Check if user is still a member of the guild
        try {
          await interaction.guild!.members.fetch(userId);
        } catch {
          continue; // Not a member
        }
        await wheelService.addParticipant(interaction.guild!.id, userId, user.username);
      }
    }

    // Setup the wheel
    await wheelService.setupWheel({
      guildId: interaction.guild!.id,
      messageId,
      channelId: wizardState.channelId,
      complimentChannelId: wizardState.complimentChannelId,
      emoji,
      customMessage: JSON.stringify(wizardState.embed),
      pinnedRoleId: wizardState.pinnedRoleId,
    });

    const successEmbed = new EmbedBuilder()
      .setTitle("🎉 Compliment Wheel Setup Complete!")
      .setColor(WIZARD_COLORS.SUCCESS)
      .setDescription("The compliment wheel has been successfully configured!")
      .addFields(
        {
          name: "📝 Message ID",
          value: messageId,
          inline: true,
        },
        {
          name: "📢 Compliment Channel",
          value: `<#${wizardState.complimentChannelId}>`,
          inline: true,
        },
        {
          name: "😊 Emoji",
          value: emoji,
          inline: true,
        },
        {
          name: "@ Pinned Role",
          value: wizardState.pinnedRoleId ? `<@&${wizardState.pinnedRoleId}>` : "None",
          inline: true,
        },
        {
          name: "🎯 How it works",
          value:
            "• Users react with the specified emoji to join the wheel\n• Every day at 00:00, a random person is chosen\n• The winner gets a compliment in the designated channel\n• Once everyone has been drawn, the wheel resets automatically",
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    logger.error("Error setting up compliment wheel:", error);
    await interaction.reply({
      content: "❌ Failed to set up the compliment wheel. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleTestCompliment(
  client: Client,
  interaction: ButtonInteraction,
  wizardState: ComplimentWizardState
): Promise<void> {
  try {
    const wheelService = ComplimentWheelService.getInstance(client);

    // Check if wheel exists
    const config = await wheelService.getWheelConfig(interaction.guild!.id);
    if (!config) {
      await interaction.reply({
        content: "❌ No compliment wheel is set up for this server. Please configure it first.",
        ephemeral: true,
      });
      return;
    }

    // Perform an instant test round
    const result = await wheelService.performTestRound(interaction.guild!.id);

    if (!result) {
      await interaction.reply({
        content: "❌ No users have reacted to the message yet. Please wait for users to react with the emoji.",
        ephemeral: true,
      });
      return;
    }

    const testEmbed = new EmbedBuilder()
      .setTitle("🧪 Compliment Wheel Test Complete!")
      .setColor(WIZARD_COLORS.INFO)
      .setDescription("A test round of the compliment wheel has been completed!")
      .addFields(
        {
          name: "🎉 Winner",
          value: `<@${result.winnerId}>`,
          inline: true,
        },
        {
          name: "📊 Participants",
          value: `${result.participantCount} users`,
          inline: true,
        },
        {
          name: "📢 Sent to",
          value: `<#${config.complimentChannelId}>`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [testEmbed], ephemeral: true });
  } catch (error) {
    logger.error("Error testing compliment wheel:", error);
    await interaction.reply({
      content: "❌ Failed to test the compliment wheel. Please try again.",
      ephemeral: true,
    });
  }
}

async function showComplimentHelp(interaction: ButtonInteraction): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.INFO)
    .setTitle("❓ Compliment Wheel Help")
    .setDescription("Learn how the compliment wheel system works!")
    .addFields(
      {
        name: "🎯 What is it?",
        value:
          "The compliment wheel is a daily system that randomly selects a user from your server to receive compliments from other members.",
        inline: false,
      },
      {
        name: "🔄 How it works",
        value:
          "1. Users react to a specific message with the chosen emoji\n" +
          "2. Every day at 00:00, a random person is selected\n" +
          "3. A message is posted in the compliment channel\n" +
          "4. Once everyone has been drawn, the wheel resets",
        inline: false,
      },
      {
        name: "⚙️ Setup Requirements",
        value:
          "• A message for users to react to\n" +
          "• A channel for daily compliment posts\n" +
          "• An emoji for users to react with\n" +
          "• Bot permissions in both channels",
        inline: false,
      },
      {
        name: "💡 Tips",
        value:
          "• Choose a popular emoji that users will naturally react with\n" +
          "• Place the message in a visible channel\n" +
          "• Use the test function to verify everything works\n" +
          "• Customize the message to match your server's tone",
        inline: false,
      }
    )
    .setFooter({ text: "Need more help? Contact a server administrator." })
    .setTimestamp();

  await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}
