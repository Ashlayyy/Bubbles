import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
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
        "• **Configure Roles** – Set up admin and support roles for ticket access.\n" +
        "• **Access Control** – Choose between role-only or role + permission access.\n" +
        "• **Toggle Threads** – Decide whether each ticket is a thread or its own channel.\n" +
        "• **Create Panel** – Post the ticket creation panel in the configured channel."
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Channel: ${config.ticketChannelId ? `<#${config.ticketChannelId}>` : "Not set"}` +
          `\n• Threads: ${config.useTicketThreads ? "Enabled" : "Disabled"}` +
          `\n• Admin Role: ${config.ticketAccessRoleId ? `<@&${config.ticketAccessRoleId}>` : "Not set"}` +
          `\n• Support Role: ${config.ticketOnCallRoleId ? `<@&${config.ticketOnCallRoleId}>` : "Not set"}` +
          `\n• Access Type: ${config.ticketAccessType === "role" ? "Role Only" : config.ticketAccessType === "permission" ? "Role + Permission" : "Permission Only"}`,
        inline: false,
      },
      {
        name: "Role Configuration",
        value:
          "**Admin Role:** Only users with this role can access admin tickets\n" +
          "**Support Role:** This role gets added to all non-admin tickets for support access",
        inline: false,
      },
      {
        name: "Access Control",
        value:
          "**Role Only:** Only users with the admin/support roles can access tickets\n" +
          "**Role + Permission:** Users with roles OR users with ManageMessages permission can access tickets",
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select a channel (dropdown below).\n" +
          "2. Configure admin and support roles.\n" +
          "3. Choose access control type.\n" +
          "4. Toggle threads if desired.\n" +
          "5. Press **Create Panel** when ready.",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu
  const channelSelect = createChannelSelect("ticket_channel_select", "Select ticket channel", 1, 1);

  // Role select menus
  const adminRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId("ticket_admin_role_select")
    .setPlaceholder("Select admin role (for admin tickets)")
    .setMaxValues(1);

  const supportRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId("ticket_support_role_select")
    .setPlaceholder("Select support role (for all tickets)")
    .setMaxValues(1);

  const threadButton = createToggleButton(
    config.useTicketThreads,
    config.useTicketThreads ? "ticket_disable_threads" : "ticket_enable_threads",
    "Threads"
  );

  const panelButton = new ButtonBuilder()
    .setCustomId("ticket_create_panel")
    .setLabel("Create Panel")
    .setStyle(BUTTON_STYLES.SUCCESS);

  const components = [
    createChannelSelectRow(channelSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(adminRoleSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(supportRoleSelect),
    createButtonRow(threadButton, panelButton),
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
        if (interactionComponent.isChannelSelectMenu() && interactionComponent.customId === "ticket_channel_select") {
          const menu = interactionComponent;
          const selectedChannelId = menu.values[0];
          if (!selectedChannelId) {
            await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyTicketChannel(client, menu, selectedChannelId);
        } else if (interactionComponent.isRoleSelectMenu()) {
          const menu = interactionComponent;
          const selectedRoleId = menu.values[0];
          if (!selectedRoleId) {
            await menu.reply({ content: "❌ No role selected.", ephemeral: true });
            return;
          }

          if (menu.customId === "ticket_admin_role_select") {
            await applyAdminRole(client, menu, selectedRoleId);
          } else if (menu.customId === "ticket_support_role_select") {
            await applySupportRole(client, menu, selectedRoleId);
          }
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
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        RoleSelectMenuBuilder.from(adminRoleSelect).setDisabled(true),
        RoleSelectMenuBuilder.from(supportRoleSelect).setDisabled(true)
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
          type: "GUILD_CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            setting: "ticketChannelId",
            value: channel.id,
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify queue service of ticket channel update:", error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Ticket Channel Updated!")
      .setDescription(`Ticket channel has been set to <#${channel.id}>`)
      .setTimestamp();

    await interaction.update({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Failed to update ticket channel:", error);
    await interaction.reply({ content: "❌ Failed to update ticket channel. Please try again.", ephemeral: true });
  }
}

async function applyAdminRole(client: Client, interaction: RoleSelectMenuInteraction, roleId: string): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: "❌ Selected role not found.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, {
      ticketAccessRoleId: role.id,
      ticketAccessType: "role",
    });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "GUILD_CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            setting: "ticketAccessRoleId",
            value: role.id,
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify queue service of admin role update:", error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Admin Role Updated!")
      .setDescription(
        `Admin role has been set to <@&${role.id}>\n\n**Note:** Only users with this role can access admin tickets.`
      )
      .setTimestamp();

    await interaction.update({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Failed to update admin role:", error);
    await interaction.reply({ content: "❌ Failed to update admin role. Please try again.", ephemeral: true });
  }
}

async function applySupportRole(client: Client, interaction: RoleSelectMenuInteraction, roleId: string): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: "❌ Selected role not found.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { ticketOnCallRoleId: role.id });

    // Notify queue service if available
    const customClient = client;
    if (customClient.queueService) {
      try {
        await customClient.queueService.processRequest({
          type: "GUILD_CONFIG_UPDATE",
          data: {
            guildId: interaction.guild.id,
            setting: "ticketOnCallRoleId",
            value: role.id,
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify queue service of support role update:", error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Support Role Updated!")
      .setDescription(
        `Support role has been set to <@&${role.id}>\n\n**Note:** This role will be added to all non-admin tickets for support access.`
      )
      .setTimestamp();

    await interaction.update({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Failed to update support role:", error);
    await interaction.reply({ content: "❌ Failed to update support role. Please try again.", ephemeral: true });
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
