import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import { getGuildConfig, updateGuildConfig } from "../../../database/GuildConfig.js";
import logger from "../../../logger.js";
import type Client from "../../../structures/Client.js";
import {
  BUTTON_STYLES,
  WIZARD_COLORS,
  WIZARD_EMOJIS,
  createButtonRow,
  createChannelSelect,
  createChannelSelectRow,
  createToggleButton,
} from "./WizardComponents.js";

export async function startTicketWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const wizardEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.PRIMARY)
    .setTitle(`${WIZARD_EMOJIS.TICKETS} Ticket Setup Wizard`)
    .setDescription(
      "Welcome to the **Ticket System Setup Wizard**!\n\n" +
        "Follow the steps below to configure tickets for your server.\n\n" +
        "• **Select Ticket Channel** – Where users press the create-ticket button.\n" +
        "• **Toggle Threads** – Decide whether each ticket is a thread or its own channel.\n" +
        "• **Create Panel** – Post the " +
        "ticket creation panel in the configured channel."
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Channel: ${config.ticketChannelId ? `<#${config.ticketChannelId}>` : "Not set"}` +
          `\n• Threads: ${config.useTicketThreads ? "Enabled" : "Disabled"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select a channel (dropdown below).\n" +
          "2. Toggle threads if desired.\n" +
          "3. Press **Create Panel** when ready.",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu
  const channelSelect = createChannelSelect("ticket_channel_select", "Select ticket channel", 1, 1);

  const threadButton = createToggleButton(
    config.useTicketThreads,
    config.useTicketThreads ? "ticket_disable_threads" : "ticket_enable_threads",
    "Threads"
  );

  const panelButton = new ButtonBuilder()
    .setCustomId("ticket_create_panel")
    .setLabel("Create Panel")
    .setStyle(BUTTON_STYLES.SUCCESS);

  const components = [createChannelSelectRow(channelSelect), createButtonRow(threadButton, panelButton)];

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
        if (interactionComponent.isChannelSelectMenu() && interactionComponent.customId === "ticket_channel_select") {
          const menu = interactionComponent;
          const selectedChannelId = menu.values[0];
          if (!selectedChannelId) {
            await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyTicketChannel(client, menu, selectedChannelId);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "ticket_enable_threads":
              await applyTicketThreads(client, btn, true);
              break;
            case "ticket_disable_threads":
              await applyTicketThreads(client, btn, false);
              break;
            case "ticket_create_panel":
              await handlePanelCreation(client, btn);
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
        logger.error("Ticket wizard error:", error);
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
        ChannelSelectMenuBuilder.from(channelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonBuilder.from(threadButton).setDisabled(true),
        ButtonBuilder.from(panelButton).setDisabled(true)
      ),
    ];

    void interaction.editReply({ components: disabledComponents }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function applyTicketChannel(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: "❌ Please select a text channel.", ephemeral: true });
    return;
  }

  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({ content: "❌ Bot user not found in guild.", ephemeral: true });
    return;
  }

  const perms = channel.permissionsFor(botMember);
  if (!perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    await interaction.reply({
      content: `❌ I need **View Channel**, **Send Messages**, and **Embed Links** in <#${channel.id}> to work properly.`,
      ephemeral: true,
    });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { ticketChannelId: channel.id });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "TICKET_SYSTEM",
            setting: "channelId",
            value: channel.id,
            action: "UPDATE_TICKET_CHANNEL",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of ticket channel update:", queueError);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Ticket Channel Set")
      .setDescription(`Ticket channel has been set to <#${channelId}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error updating ticket channel:", error);
    await interaction.reply({
      content: "❌ Failed to update ticket channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyTicketThreads(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { useTicketThreads: enabled });

    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "TICKET_SYSTEM",
            setting: "useThreads",
            value: enabled,
            action: "UPDATE_TICKET_THREADS",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of ticket threads update:", queueError);
      }
    }

    await interaction.reply({
      content: `✅ Tickets will now use ${enabled ? "threads" : "separate channels"}.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error updating ticket threads setting:", error);
    await interaction.reply({
      content: "❌ Failed to update ticket threads setting. Please try again.",
      ephemeral: true,
    });
  }
}

async function handlePanelCreation(client: Client, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  if (!config.ticketChannelId) {
    await interaction.reply({
      content: "❌ Please select a ticket channel first before creating a panel.",
      ephemeral: true,
    });
    return;
  }

  try {
    const channel = interaction.guild.channels.cache.get(config.ticketChannelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        content: "❌ The configured ticket channel is no longer available.",
        ephemeral: true,
      });
      return;
    }

    const panelEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🎫 Create a Ticket")
      .setDescription("Need help? Click the button below to create a ticket and our staff will assist you.")
      .addFields({
        name: "📋 What to include",
        value: "• Your issue or question\n• Any relevant details\n• Screenshots if applicable",
        inline: false,
      })
      .setFooter({ text: "We'll respond as soon as possible" })
      .setTimestamp();

    const createButton = new ButtonBuilder()
      .setCustomId("create_ticket")
      .setLabel("Create Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton);

    await channel.send({
      embeds: [panelEmbed],
      components: [row],
    });

    await interaction.reply({
      content: `✅ Ticket panel created in <#${config.ticketChannelId}>!`,
      ephemeral: true,
    });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            section: "TICKET_SYSTEM",
            setting: "panelCreated",
            value: true,
            action: "CREATE_TICKET_PANEL",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of ticket panel creation:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error creating ticket panel:", error);
    await interaction.reply({
      content: "❌ Failed to create ticket panel. Please try again.",
      ephemeral: true,
    });
  }
}
