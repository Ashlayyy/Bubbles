import {
  ActionRowBuilder,
  ButtonBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import { prisma } from "../../../database/index.js";
import logger from "../../../logger.js";
import type Client from "../../../structures/Client.js";
import {
  WIZARD_COLORS,
  WIZARD_EMOJIS,
  createButtonRow,
  createChannelSelect,
  createChannelSelectRow,
  createHelpButton,
  createTestButton,
  createToggleButton,
} from "./WizardComponents.js";

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

  // Load current settings
  let appealsChannelId: string | null = null;
  let appealsEnabled = false;

  try {
    const appealSettings = await prisma.appealSettings.findUnique({
      where: { guildId: interaction.guild.id },
      select: { appealChannelId: true, discordBotEnabled: true },
    });

    appealsChannelId = appealSettings?.appealChannelId || null;
    appealsEnabled = appealSettings?.discordBotEnabled || false;
  } catch (error) {
    logger.error("Error loading appeals settings:", error);
    // Continue with default values
  }

  const wizardEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.PRIMARY)
    .setTitle(`${WIZARD_EMOJIS.APPEALS} Appeals System Setup`)
    .setDescription(
      "Welcome to the **Appeals System Setup Wizard**!\n\n" +
        "Configure the appeals system to allow users to appeal moderation actions.\n\n" +
        "• **Appeals Channel** – Where appeal submissions will be posted\n" +
        "• **System Toggle** – Enable or disable the appeals system\n" +
        "• **Test System** – Verify everything is working correctly"
    )
    .addFields(
      {
        name: "Current Settings",
        value:
          `• Status: ${appealsEnabled ? "✅ Enabled" : "❌ Disabled"}` +
          `\n• Channel: ${appealsChannelId ? `<#${appealsChannelId}>` : "Not set"}`,
        inline: false,
      },
      {
        name: "Instructions",
        value:
          "1. Select an appeals channel (dropdown below)\n" +
          "2. Enable/disable the system\n" +
          "3. Test the system to ensure it's working",
        inline: false,
      }
    )
    .setFooter({ text: "This wizard will stay active for 5 minutes." })
    .setTimestamp();

  // Channel select menu
  const channelSelect = createChannelSelect("appeals_channel_select", "Select appeals channel", 1, 1);

  const toggleButton = createToggleButton(
    appealsEnabled,
    appealsEnabled ? "appeals_disable" : "appeals_enable",
    "Appeals System"
  );

  const testButton = createTestButton("appeals_test", "Test Appeals");
  const helpButton = createHelpButton("appeals_help", "Help & Info");

  const components = [createChannelSelectRow(channelSelect), createButtonRow(toggleButton, testButton, helpButton)];

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
          const menu = interactionComponent;
          const selectedChannelId = menu.values[0];
          if (!selectedChannelId) {
            await menu.reply({ content: "❌ No channel selected.", ephemeral: true });
            return;
          }
          await applyAppealsChannel(client, menu, selectedChannelId);
        } else if (interactionComponent.isButton()) {
          const btn = interactionComponent;
          switch (btn.customId) {
            case "appeals_enable":
              await applyAppealsEnabled(client, btn, true);
              break;
            case "appeals_disable":
              await applyAppealsEnabled(client, btn, false);
              break;
            case "appeals_test":
              await handleTestAppeals(client, btn);
              break;
            case "appeals_help":
              await showAppealsHelp(btn);
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
        ChannelSelectMenuBuilder.from(channelSelect).setDisabled(true)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonBuilder.from(toggleButton).setDisabled(true),
        ButtonBuilder.from(testButton).setDisabled(true),
        ButtonBuilder.from(helpButton).setDisabled(true)
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
    await prisma.appealSettings.upsert({
      where: { guildId: interaction.guild.id },
      update: { appealChannelId: channel.id },
      create: {
        guildId: interaction.guild.id,
        appealChannelId: channel.id,
        discordBotEnabled: false,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Appeals Channel Set")
      .setDescription(`Appeals channel has been set to <#${channelId}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error updating appeals channel:", error);
    await interaction.reply({
      content: "❌ Failed to update appeals channel. Please try again.",
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
    await prisma.appealSettings.upsert({
      where: { guildId: interaction.guild.id },
      update: { discordBotEnabled: enabled },
      create: {
        guildId: interaction.guild.id,
        appealChannelId: null,
        discordBotEnabled: enabled,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(enabled ? WIZARD_COLORS.SUCCESS : WIZARD_COLORS.DANGER)
      .setTitle(`✅ Appeals System ${enabled ? "Enabled" : "Disabled"}`)
      .setDescription(`The appeals system has been ${enabled ? "enabled" : "disabled"}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error updating appeals enabled setting:", error);
    await interaction.reply({
      content: "❌ Failed to update appeals system setting. Please try again.",
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
    const settings = await prisma.appealSettings.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!settings?.discordBotEnabled) {
      await interaction.reply({
        content: "❌ Please enable the appeals system before testing.",
        ephemeral: true,
      });
      return;
    }

    if (!settings.appealChannelId) {
      await interaction.reply({
        content: "❌ Please set an appeals channel before testing.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(settings.appealChannelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        content: "❌ The appeals channel is no longer available.",
        ephemeral: true,
      });
      return;
    }

    const testEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.INFO)
      .setTitle("🧪 Appeals System Test")
      .setDescription("This is a test message to verify the appeals system is working correctly.")
      .addFields({
        name: "Test Details",
        value: "• Appeals channel: Working\n• Embed permissions: Working\n• System status: Active",
        inline: false,
      })
      .setTimestamp();

    await channel.send({ embeds: [testEmbed] });

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Test Successful")
      .setDescription("Test message sent to appeals channel. The appeals system is working correctly!")
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    logger.error("Error testing appeals system:", error);
    await interaction.reply({
      content: "❌ Failed to send test message. Please check my permissions in the appeals channel.",
      ephemeral: true,
    });
  }
}

async function showAppealsHelp(interaction: ButtonInteraction): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.INFO)
    .setTitle("❓ Appeals System Help")
    .setDescription("Learn how the appeals system works and how to configure it.")
    .addFields(
      {
        name: "What is the Appeals System?",
        value:
          "The appeals system allows users to appeal moderation actions taken against them. Users can submit appeals through a form, and moderators can review and respond to them.",
        inline: false,
      },
      {
        name: "How to Set Up",
        value:
          "1. Select an appeals channel where appeals will be posted\n2. Enable the appeals system\n3. Test the system to ensure it's working\n4. Configure appeal forms and settings as needed",
        inline: false,
      },
      {
        name: "Required Permissions",
        value:
          "The bot needs these permissions in the appeals channel:\n• View Channel\n• Send Messages\n• Embed Links",
        inline: false,
      },
      {
        name: "Next Steps",
        value:
          "After setup, you can:\n• Configure appeal forms\n• Set up auto-responses\n• Create appeal categories\n• Set up appeal review workflows",
        inline: false,
      }
    )
    .setFooter({ text: "Use the buttons below to continue setup" })
    .setTimestamp();

  await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}
