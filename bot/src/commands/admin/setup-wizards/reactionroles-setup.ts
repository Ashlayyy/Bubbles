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

import { getGuildConfig, updateGuildConfig } from "../../../database/GuildConfig.js";
import logger from "../../../logger.js";
import type Client from "../../../structures/Client.js";

// Export only the wizard function - no standalone command
export { startReactionRolesWizard };

async function startReactionRolesWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ This command must be used in a server.",
      ephemeral: true,
    });
    return;
  }

  const config = await getGuildConfig(interaction.guild.id);

  const wizardEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🎭 Reaction Roles Setup Wizard")
    .setDescription(
      "Welcome to the **Reaction Roles Setup Wizard**!\n\n" +
        "This wizard will help you configure reaction roles for your server.\n\n" +
        "• **Allowed Channels** – Channels where reaction roles can be created\n" +
        "• **Enable/Disable** – Turn the reaction roles system on or off\n" +
        "• **Logging** – Track reaction role activities\n" +
        "• **Permissions** – Set up role assignment permissions"
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Allowed Channels: ${config.reactionRoleChannels.length > 0 ? config.reactionRoleChannels.map((id) => `<#${id}>`).join(", ") : "None"}` +
          `\n• Logging Enabled: ${config.logReactionRoles ? "✅ Yes" : "❌ No"}` +
          `\n• System Status: ${config.reactionRoleChannels.length > 0 ? "✅ Active" : "❌ Inactive"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select channels where reaction roles are allowed\n" +
          "2. Enable or disable logging\n" +
          "3. Configure permissions\n" +
          "4. Test the setup",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu for allowed channels
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("reactionroles_channel_select")
    .setPlaceholder("Select channels where reaction roles are allowed")
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(10);

  const enableLoggingButton = new ButtonBuilder()
    .setCustomId(config.logReactionRoles ? "reactionroles_log_disable" : "reactionroles_log_enable")
    .setLabel(config.logReactionRoles ? "Disable Logging" : "Enable Logging")
    .setStyle(config.logReactionRoles ? ButtonStyle.Danger : ButtonStyle.Success);

  const testButton = new ButtonBuilder()
    .setCustomId("reactionroles_test")
    .setLabel("Test Setup")
    .setStyle(ButtonStyle.Primary);

  const components = [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    new ActionRowBuilder<ButtonBuilder>().addComponents(enableLoggingButton, testButton),
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
        if (
          interactionComponent.isChannelSelectMenu() &&
          interactionComponent.customId === "reactionroles_channel_select"
        ) {
          const selectedChannelIds = interactionComponent.values;
          await applyReactionRoleChannels(client, interactionComponent, selectedChannelIds);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "reactionroles_log_enable":
              await applyLoggingEnabled(client, btn, true);
              break;
            case "reactionroles_log_disable":
              await applyLoggingEnabled(client, btn, false);
              break;
            case "reactionroles_test":
              await handleTestReactionRoles(client, btn);
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
        logger.error("Reaction roles wizard error:", error);
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
        ButtonBuilder.from(enableLoggingButton).setDisabled(true),
        ButtonBuilder.from(testButton).setDisabled(true)
      ),
    ];

    void interaction.editReply({ components: disabledComponents }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function applyReactionRoleChannels(
  client: Client,
  interaction: ChannelSelectMenuInteraction,
  channelIds: string[]
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { reactionRoleChannels: channelIds });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Reaction Role Channels Updated")
      .setDescription(
        channelIds.length > 0
          ? `Reaction roles are now allowed in: ${channelIds.map((id) => `<#${id}>`).join(", ")}`
          : "Reaction roles are now disabled in all channels"
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
            section: "REACTION_ROLES",
            setting: "reactionRoleChannels",
            value: channelIds,
            action: "SET_REACTION_ROLE_CHANNELS",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of reaction role channels update:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error setting reaction role channels:", error);
    await interaction.reply({
      content: "❌ Failed to set reaction role channels. Please try again.",
      ephemeral: true,
    });
  }
}

async function applyLoggingEnabled(client: Client, interaction: ButtonInteraction, enabled: boolean): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    await updateGuildConfig(interaction.guild.id, { logReactionRoles: enabled });

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`✅ Reaction Role Logging ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`Reaction role logging is now ${enabled ? "enabled" : "disabled"}`)
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
            section: "REACTION_ROLES",
            setting: "logReactionRoles",
            value: enabled,
            action: "TOGGLE_REACTION_ROLE_LOGGING",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (queueError) {
        logger.warn("Failed to notify queue service of reaction role logging toggle:", queueError);
      }
    }
  } catch (error) {
    logger.error("Error toggling reaction role logging:", error);
    await interaction.reply({
      content: "❌ Failed to toggle reaction role logging. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleTestReactionRoles(client: Client, interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ Guild unavailable.", ephemeral: true });
    return;
  }

  try {
    const config = await getGuildConfig(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🧪 Test Reaction Roles")
      .setDescription("Reaction roles system is ready for testing.")
      .addFields(
        {
          name: "Allowed Channels",
          value:
            config.reactionRoleChannels.length > 0
              ? config.reactionRoleChannels.map((id) => `<#${id}>`).join(", ")
              : "None",
          inline: true,
        },
        { name: "Logging Enabled", value: config.logReactionRoles ? "✅ Yes" : "❌ No", inline: true },
        {
          name: "System Status",
          value: config.reactionRoleChannels.length > 0 ? "✅ Active" : "❌ Inactive",
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Send test message to first allowed channel if any
    if (config.reactionRoleChannels.length > 0) {
      const testChannel = interaction.guild.channels.cache.get(config.reactionRoleChannels[0]);
      if (testChannel?.isTextBased()) {
        await testChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9b59b6)
              .setTitle("🎭 Reaction Roles Test")
              .setDescription(
                "This channel is configured for reaction roles. Use `/reactionroles create` to create a reaction role message."
              )
              .setTimestamp(),
          ],
        });
      }
    }
  } catch (error) {
    logger.error("Error testing reaction roles:", error);
    await interaction.reply({
      content: "❌ Failed to test reaction roles. Please try again.",
      ephemeral: true,
    });
  }
}
