import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import logger from "../../../logger.js";
import type Client from "../../../structures/Client.js";

// Export only the wizard function - no standalone command
export { startAppealsWizard };

async function startAppealsWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  // Get appeal settings through ModerationManager
  const appealSettings = await client.moderationManager.getAppealsSettings(interaction.guild.id);

  const wizardEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("⚖️ Appeals System Setup Wizard")
    .setDescription(
      "Welcome to the **Appeals System Setup Wizard**!\n\n" +
        "This wizard will help you configure the appeals system for your server.\n\n" +
        "• **Appeals Channel** – Where users can submit appeals for bans/mutes\n" +
        "• **Enable/Disable** – Turn the appeals system on or off\n" +
        "• **Custom Messages** – Set personalized appeal messages\n" +
        "• **Auto-Response** – Configure automatic responses to appeals"
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Appeals Channel: ${"appealChannelId" in appealSettings && appealSettings.appealChannelId ? `<#${appealSettings.appealChannelId}>` : "Not set"}` +
          `\n• Appeals Enabled: ${appealSettings.discordBotEnabled ? "✅ Yes" : "❌ No"}` +
          `\n• Web Form: ${appealSettings.webFormEnabled ? "✅ Yes" : "❌ No"}` +
          `\n• Cooldown: ${appealSettings.appealCooldown / 3600} hours` +
          `\n• Max Appeals: ${appealSettings.maxAppealsPerUser} per user`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select an appeals channel (dropdown below)\n" +
          "2. Enable or disable the appeals system\n" +
          "3. Configure custom messages\n" +
          "4. Set up auto-response settings",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Appeals channel select menu
  const appealsChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("appeals_channel_select")
    .setPlaceholder("Select appeals channel")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const enableAppealsButton = new ButtonBuilder()
    .setCustomId(appealSettings.discordBotEnabled ? "appeals_disable" : "appeals_enable")
    .setLabel(appealSettings.discordBotEnabled ? "Disable Appeals" : "Enable Appeals")
    .setStyle(appealSettings.discordBotEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const webFormButton = new ButtonBuilder()
    .setCustomId(appealSettings.webFormEnabled ? "appeals_web_disable" : "appeals_web_enable")
    .setLabel(appealSettings.webFormEnabled ? "Disable Web Form" : "Enable Web Form")
    .setStyle(appealSettings.webFormEnabled ? ButtonStyle.Danger : ButtonStyle.Secondary);

  const testButton = new ButtonBuilder()
    .setCustomId("appeals_test")
    .setLabel("Test Appeals")
    .setStyle(ButtonStyle.Primary);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(appealsChannelSelect),
    new ActionRowBuilder<ButtonBuilder>().addComponents(enableAppealsButton, webFormButton, testButton),
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

  const collector = interaction.channel?.createMessageComponentCollector({
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (interactionComponent) => {
    void (async () => {
      try {
        if (interactionComponent.isChannelSelectMenu() && interactionComponent.customId === "appeals_channel_select") {
          const selectedChannelId = interactionComponent.values[0];
          if (!selectedChannelId) {
            await interactionComponent.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyAppealsChannel(client, interactionComponent, selectedChannelId);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "appeals_enable":
              await applyAppealsEnabled(client, btn, true);
              break;
            case "appeals_disable":
              await applyAppealsEnabled(client, btn, false);
              break;
            case "appeals_web_enable":
              await applyWebFormEnabled(client, btn, true);
              break;
            case "appeals_web_disable":
              await applyWebFormEnabled(client, btn, false);
              break;
            case "appeals_test":
              await handleTestAppeals(client, btn);
              break;
            default:
              await btn.reply({
                content: "❌ Unknown button interaction. Please try again.",
                ephemeral: true,
              });
              break;
          }
        }
      } catch (error) {
        logger.error("Appeals wizard error:", error);
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

  collector?.on("end", () => {
    // Disable components after timeout
    const disabledComponents = [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        ChannelSelectMenuBuilder.from(appealsChannelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonBuilder.from(enableAppealsButton).setDisabled(true),
        ButtonBuilder.from(webFormButton).setDisabled(true),
        ButtonBuilder.from(testButton).setDisabled(true)
      ),
    ];

    void interaction.editReply({ components: disabledComponents }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function applyAppealsChannel(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      appealChannelId: channelId,
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Appeals Channel Set")
      .setDescription(`Appeals will now be sent to <#${channelId}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "APPEALS_SYSTEM",
            setting: "appealChannelId",
            value: channelId,
            action: "SET_APPEALS_CHANNEL",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of appeals channel update:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error setting appeals channel:", error);
    await interaction.reply({
      content: "❌ Failed to set appeals channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyAppealsEnabled(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      enabled: enabled,
    });

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`✅ Appeals System ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`The appeals system is now ${enabled ? "enabled" : "disabled"}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "APPEALS_SYSTEM",
            setting: "discordBotEnabled",
            value: enabled,
            action: "TOGGLE_APPEALS",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of appeals toggle:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error toggling appeals system:", error);
    await interaction.reply({
      content: "❌ Failed to toggle appeals system. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyWebFormEnabled(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      webFormUrl: enabled ? "https://appeals.example.com" : undefined,
    });

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`✅ Web Form ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`Web form appeals are now ${enabled ? "enabled" : "disabled"}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "APPEALS_SYSTEM",
            setting: "webFormEnabled",
            value: enabled,
            action: "TOGGLE_WEB_FORM",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of web form toggle:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error toggling web form:", error);
    await interaction.reply({
      content: "❌ Failed to toggle web form. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleTestAppeals(client: Client, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    const appealSettings = await client.moderationManager.getAppealsSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🧪 Test Appeals")
      .setDescription("Test appeal has been sent to the configured channel.")
      .addFields(
        {
          name: "Appeals Channel",
          value:
            "appealChannelId" in appealSettings && appealSettings.appealChannelId
              ? `<#${appealSettings.appealChannelId}>`
              : "Not set",
          inline: true,
        },
        { name: "Appeals Enabled", value: appealSettings.discordBotEnabled ? "✅ Yes" : "❌ No", inline: true },
        { name: "Web Form", value: appealSettings.webFormEnabled ? "✅ Yes" : "❌ No", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Send test appeal to channel if configured
    if ("appealChannelId" in appealSettings && appealSettings.appealChannelId && appealSettings.discordBotEnabled) {
      const appealsChannel = interaction.guild.channels.cache.get(appealSettings.appealChannelId);
      if (appealsChannel?.isTextBased()) {
        await appealsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle("⚖️ Test Appeal")
              .setDescription(`This is a test appeal from ${interaction.user}`)
              .addFields(
                { name: "User", value: interaction.user.toString(), inline: true },
                { name: "Type", value: "Test Appeal", inline: true },
                { name: "Status", value: "Pending Review", inline: true }
              )
              .setTimestamp(),
          ],
        });
      }
    }
  } catch (error) {
    logger.error("Error testing appeals:", error);
    await interaction.reply({
      content: "❌ Failed to send test appeal. Please try again.",
      ephemeral: true,
    });
  }
}
