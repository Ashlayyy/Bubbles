import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";

import { getGuildConfig, updateGuildConfig } from "../../../database/GuildConfig.js";
import logger from "../../../logger.js";
import type Client from "../../../structures/Client.js";

// Export only the wizard function - no standalone command
export { startWelcomeWizard };

async function startWelcomeWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const allTextChannels = interaction.guild.channels.cache.filter(
    (ch) => ch.type === ChannelType.GuildText && ch.viewable
  );
  const allRoles = interaction.guild.roles.cache.filter((role) => role.editable && !role.managed);

  let limitWarning = "";
  if (allTextChannels.size > 25) {
    limitWarning +=
      "\n⚠️ Only the first 25 text channels are shown due to Discord's dropdown limit. Use the channel ID manually if needed.";
  }
  if (allRoles.size > 25) {
    limitWarning +=
      "\n⚠️ Only the first 25 roles are shown due to Discord's dropdown limit. Use the role ID manually if needed.";
  }

  const wizardEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("👋 Welcome System Setup Wizard")
    .setDescription(
      "Welcome to the **Welcome System Setup Wizard**!\n\n" +
        "This wizard will help you configure welcome and goodbye messages for your server.\n\n" +
        "• **Welcome Channel** – Where new member welcome messages are sent\n" +
        "• **Goodbye Channel** – Where leaving member goodbye messages are sent\n" +
        "• **Auto-Roles** – Roles automatically assigned to new members\n" +
        "• **Custom Messages** – Personalized welcome/goodbye messages" +
        limitWarning
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Welcome Channel: ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set"}` +
          `\n• Goodbye Channel: ${config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : "Not set"}` +
          `\n• Welcome Enabled: ${config.welcomeEnabled ? "✅ Yes" : "❌ No"}` +
          `\n• Goodbye Enabled: ${config.goodbyeEnabled ? "✅ Yes" : "❌ No"}` +
          `\n• Auto-Roles: ${config.moderatorRoleIds.length > 0 ? config.moderatorRoleIds.map((id) => `<@&${id}>`).join(", ") : "None"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select welcome and goodbye channels (dropdowns below)\n" +
          "2. Choose auto-roles if desired\n" +
          "3. Configure custom messages\n" +
          "4. Test your setup",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Welcome channel select menu
  const welcomeChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("welcome_channel_select")
    .setPlaceholder("Select welcome channel")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  // Goodbye channel select menu
  const goodbyeChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("goodbye_channel_select")
    .setPlaceholder("Select goodbye channel (optional)")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  // Auto-role select menu
  const autoRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId("welcome_auto_role_select")
    .setPlaceholder("Select auto-roles (optional)")
    .setMinValues(0)
    .setMaxValues(5);

  const enableWelcomeButton = new ButtonBuilder()
    .setCustomId(config.welcomeEnabled ? "welcome_disable" : "welcome_enable")
    .setLabel(config.welcomeEnabled ? "Disable Welcome" : "Enable Welcome")
    .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const enableGoodbyeButton = new ButtonBuilder()
    .setCustomId(config.goodbyeEnabled ? "goodbye_disable" : "goodbye_enable")
    .setLabel(config.goodbyeEnabled ? "Disable Goodbye" : "Enable Goodbye")
    .setStyle(config.goodbyeEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const testButton = new ButtonBuilder()
    .setCustomId("welcome_test")
    .setLabel("Test Messages")
    .setStyle(ButtonStyle.Primary);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(welcomeChannelSelect),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(goodbyeChannelSelect),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(autoRoleSelect),
    new ActionRowBuilder<ButtonBuilder>().addComponents(enableWelcomeButton, enableGoodbyeButton, testButton),
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
        if (interactionComponent.isChannelSelectMenu()) {
          const menu = interactionComponent;
          if (menu.customId === "welcome_channel_select") {
            const selectedChannelId = menu.values[0];
            if (!selectedChannelId) {
              await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
              return;
            }
            await applyWelcomeChannel(client, menu, selectedChannelId);
          } else if (menu.customId === "goodbye_channel_select") {
            const selectedChannelId = menu.values[0] ?? null;
            await applyGoodbyeChannel(client, menu, selectedChannelId);
          }
        } else if (
          interactionComponent.isRoleSelectMenu() &&
          interactionComponent.customId === "welcome_auto_role_select"
        ) {
          const selectedRoleIds = interactionComponent.values;
          await applyAutoRoles(client, interactionComponent, selectedRoleIds);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "welcome_enable":
              await applyWelcomeEnabled(client, btn, true);
              break;
            case "welcome_disable":
              await applyWelcomeEnabled(client, btn, false);
              break;
            case "goodbye_enable":
              await applyGoodbyeEnabled(client, btn, true);
              break;
            case "goodbye_disable":
              await applyGoodbyeEnabled(client, btn, false);
              break;
            case "welcome_test":
              await handleTestMessages(client, btn);
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
        logger.error("Welcome wizard error:", error);
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
        ChannelSelectMenuBuilder.from(welcomeChannelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        ChannelSelectMenuBuilder.from(goodbyeChannelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        RoleSelectMenuBuilder.from(autoRoleSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonBuilder.from(enableWelcomeButton).setDisabled(true),
        ButtonBuilder.from(enableGoodbyeButton).setDisabled(true),
        ButtonBuilder.from(testButton).setDisabled(true)
      ),
    ];

    void interaction.editReply({ components: disabledComponents }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function applyWelcomeChannel(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { welcomeChannelId: channelId });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Welcome Channel Set")
      .setDescription(`Welcome messages will now be sent to <#${channelId}>`)
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
            section: "WELCOME_SYSTEM",
            setting: "welcomeChannelId",
            value: channelId,
            action: "SET_WELCOME_CHANNEL",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of welcome channel update:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error setting welcome channel:", error);
    await interaction.reply({
      content: "❌ Failed to set welcome channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyGoodbyeChannel(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelId: string | null
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { goodbyeChannelId: channelId });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Goodbye Channel Set")
      .setDescription(channelId ? `Goodbye messages will now be sent to <#${channelId}>` : "Goodbye messages disabled")
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
            section: "WELCOME_SYSTEM",
            setting: "goodbyeChannelId",
            value: channelId,
            action: "SET_GOODBYE_CHANNEL",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of goodbye channel update:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error setting goodbye channel:", error);
    await interaction.reply({
      content: "❌ Failed to set goodbye channel. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyAutoRoles(
  client: Client,
  interaction: RoleSelectMenuInteraction,
  roleIds: string[]
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { moderatorRoleIds: roleIds });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Auto-Roles Updated")
      .setDescription(
        roleIds.length > 0 ? `Auto-roles set: ${roleIds.map((id) => `<@&${id}>`).join(", ")}` : "No auto-roles set"
      )
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
            section: "WELCOME_SYSTEM",
            setting: "moderatorRoleIds",
            value: roleIds,
            action: "SET_AUTO_ROLES",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of auto-role update:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error setting auto-roles:", error);
    await interaction.reply({
      content: "❌ Failed to set auto-roles. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyWelcomeEnabled(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { welcomeEnabled: enabled });

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`✅ Welcome Messages ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`Welcome messages are now ${enabled ? "enabled" : "disabled"}`)
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
            section: "WELCOME_SYSTEM",
            setting: "welcomeEnabled",
            value: enabled,
            action: "TOGGLE_WELCOME",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of welcome toggle:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error toggling welcome messages:", error);
    await interaction.reply({
      content: "❌ Failed to toggle welcome messages. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyGoodbyeEnabled(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { goodbyeEnabled: enabled });

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`✅ Goodbye Messages ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`Goodbye messages are now ${enabled ? "enabled" : "disabled"}`)
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
            section: "WELCOME_SYSTEM",
            setting: "goodbyeEnabled",
            value: enabled,
            action: "TOGGLE_GOODBYE",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of goodbye toggle:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error toggling goodbye messages:", error);
    await interaction.reply({
      content: "❌ Failed to toggle goodbye messages. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleTestMessages(client: Client, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    const config = await getGuildConfig(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🧪 Test Messages")
      .setDescription("Test messages have been sent to the configured channels.")
      .addFields(
        {
          name: "Welcome Channel",
          value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set",
          inline: true,
        },
        {
          name: "Goodbye Channel",
          value: config.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : "Not set",
          inline: true,
        },
        { name: "Welcome Enabled", value: config.welcomeEnabled ? "✅ Yes" : "❌ No", inline: true },
        { name: "Goodbye Enabled", value: config.goodbyeEnabled ? "✅ Yes" : "❌ No", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Send test messages to channels if configured
    if (config.welcomeChannelId && config.welcomeEnabled) {
      const welcomeChannel = interaction.guild.channels.cache.get(config.welcomeChannelId);
      if (welcomeChannel?.isTextBased()) {
        await welcomeChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("👋 Welcome Test Message")
              .setDescription(`Welcome to ${interaction.guild.name}, ${interaction.user}!`)
              .setTimestamp(),
          ],
        });
      }
    }

    if (config.goodbyeChannelId && config.goodbyeEnabled) {
      const goodbyeChannel = interaction.guild.channels.cache.get(config.goodbyeChannelId);
      if (goodbyeChannel?.isTextBased()) {
        await goodbyeChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("👋 Goodbye Test Message")
              .setDescription(`${interaction.user} has left ${interaction.guild.name}`)
              .setTimestamp(),
          ],
        });
      }
    }
  } catch (error) {
    logger.error("Error testing messages:", error);
    await interaction.reply({
      content: "❌ Failed to send test messages. Please try again.",
      ephemeral: true,
    });
  }
}
