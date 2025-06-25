import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import logger from "../../logger.js";
import Client from "../../structures/Client.js";
import Command, { GuildChatInputCommandInteraction } from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

// Setup Wizard Handler
async function handleSetupWizard(client: Client, interaction: GuildChatInputCommandInteraction) {
  const state = {
    step: 1,
    config: {
      website: null as string | null,
      channelId: null as string | null,
      cooldown: 24,
      maxAppeals: 3,
      enabled: true,
    },
  };

  const generateWizardEmbed = (step: number) => {
    const embed = new EmbedBuilder().setTitle("⚖️ Appeals System Setup Wizard").setColor(0x3498db).setTimestamp();

    switch (step) {
      case 1:
        embed.setDescription(
          "**Step 1/4: Enable Appeals System**\n\n" +
            "Would you like to enable the appeals system for your server?\n\n" +
            "This allows users to appeal their punishments (bans, mutes, etc.)"
        );
        break;
      case 2:
        embed.setDescription(
          "**Step 2/4: Appeals Website**\n\n" +
            "Do you have a custom appeals website URL?\n\n" +
            "• Choose **Custom** to set your own URL\n" +
            "• Choose **Default** to use the bot's built-in system"
        );
        break;
      case 3:
        embed.setDescription(
          "**Step 3/4: Review Channel**\n\n" +
            "Select a channel where staff will review appeals.\n\n" +
            "This is where appeal notifications will be sent for staff review."
        );
        break;
      case 4:
        embed.setDescription("**Step 4/4: Configuration Summary**\n\n" + "Review your settings before finishing:");
        embed.addFields(
          { name: "🔘 Status", value: state.config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          { name: "🌐 Website", value: state.config.website ?? "Default URL", inline: true },
          {
            name: "📝 Review Channel",
            value: state.config.channelId ? `<#${state.config.channelId}>` : "Not set",
            inline: true,
          },
          { name: "⏰ Cooldown", value: `${state.config.cooldown} hours`, inline: true },
          { name: "🔢 Max Appeals", value: `${state.config.maxAppeals} per user`, inline: true }
        );
        break;
    }

    return embed;
  };

  const generateWizardComponents = (step: number) => {
    switch (step) {
      case 1:
        return [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("wizard_enable")
              .setLabel("Enable")
              .setEmoji("✅")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("wizard_disable")
              .setLabel("Disable")
              .setEmoji("❌")
              .setStyle(ButtonStyle.Secondary)
          ),
        ];
      case 2:
        return [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("wizard_custom_url")
              .setLabel("Custom Website")
              .setEmoji("🌐")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("wizard_default_url")
              .setLabel("Use Default")
              .setEmoji("🔧")
              .setStyle(ButtonStyle.Secondary)
          ),
        ];
      case 3:
        if (!interaction.guild) return [];
        return [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("wizard_channel_select")
              .setPlaceholder("Select a channel for appeal reviews...")
              .addOptions(
                interaction.guild.channels.cache
                  .filter((ch) => ch.type === ChannelType.GuildText)
                  .first(20)
                  .map((ch) => ({
                    label: ch.name,
                    value: ch.id,
                    description: `Channel for appeals review`,
                  }))
              )
          ),
        ];
      case 4:
        return [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("wizard_finish")
              .setLabel("Complete Setup")
              .setEmoji("✅")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("wizard_cancel")
              .setLabel("Cancel")
              .setEmoji("❌")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("wizard_advanced")
              .setLabel("Advanced Settings")
              .setEmoji("⚙️")
              .setStyle(ButtonStyle.Secondary)
          ),
        ];
      default:
        return [];
    }
  };

  await interaction.reply({
    embeds: [generateWizardEmbed(1)],
    components: generateWizardComponents(1),
    ephemeral: true,
  });

  const reply = await interaction.fetchReply();
  const collector = reply.createMessageComponentCollector({
    time: 300000, // 5 minutes
  });

  collector.on("collect", (i) => {
    void (async () => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "❌ You can't use these buttons.", ephemeral: true });
        return;
      }

      try {
        switch (i.customId) {
          case "wizard_enable":
            state.config.enabled = true;
            state.step = 2;
            await i.update({
              embeds: [generateWizardEmbed(2)],
              components: generateWizardComponents(2),
            });
            break;

          case "wizard_disable":
            state.config.enabled = false;
            state.step = 4; // Skip to summary
            await i.update({
              embeds: [generateWizardEmbed(4)],
              components: generateWizardComponents(4),
            });
            break;

          case "wizard_custom_url": {
            const modal = new ModalBuilder().setCustomId("wizard_url_modal").setTitle("Custom Appeals Website");

            const urlInput = new TextInputBuilder()
              .setCustomId("website_url")
              .setLabel("Website URL")
              .setPlaceholder("https://appeals.yourdomain.com")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput));

            await i.showModal(modal);
            const urlSubmitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);

            if (urlSubmitted) {
              await urlSubmitted.deferUpdate();
              state.config.website = urlSubmitted.fields.getTextInputValue("website_url");
              state.step = 3;
              await urlSubmitted.editReply({
                embeds: [generateWizardEmbed(3)],
                components: generateWizardComponents(3),
              });
            }
            break;
          }

          case "wizard_default_url":
            state.config.website = null;
            state.step = 3;
            await i.update({
              embeds: [generateWizardEmbed(3)],
              components: generateWizardComponents(3),
            });
            break;

          case "wizard_channel_select":
            if (i.isStringSelectMenu()) {
              state.config.channelId = i.values[0];
              state.step = 4;
              await i.update({
                embeds: [generateWizardEmbed(4)],
                components: generateWizardComponents(4),
              });
            }
            break;

          case "wizard_advanced": {
            const advancedModal = new ModalBuilder()
              .setCustomId("wizard_advanced_modal")
              .setTitle("Advanced Appeals Settings");

            const cooldownInput = new TextInputBuilder()
              .setCustomId("cooldown")
              .setLabel("Appeal Cooldown (hours)")
              .setPlaceholder("24")
              .setValue(state.config.cooldown.toString())
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const maxAppealsInput = new TextInputBuilder()
              .setCustomId("max_appeals")
              .setLabel("Max Appeals Per User")
              .setPlaceholder("3")
              .setValue(state.config.maxAppeals.toString())
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            advancedModal.addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(cooldownInput),
              new ActionRowBuilder<TextInputBuilder>().addComponents(maxAppealsInput)
            );

            await i.showModal(advancedModal);
            const advancedSubmitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);

            if (advancedSubmitted) {
              await advancedSubmitted.deferUpdate();
              state.config.cooldown = parseInt(advancedSubmitted.fields.getTextInputValue("cooldown")) || 24;
              state.config.maxAppeals = parseInt(advancedSubmitted.fields.getTextInputValue("max_appeals")) || 3;
              await advancedSubmitted.editReply({
                embeds: [generateWizardEmbed(4)],
                components: generateWizardComponents(4),
              });
            }
            break;
          }

          case "wizard_finish": {
            await i.deferUpdate();

            if (!interaction.guild) return;

            try {
              await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
                enabled: state.config.enabled,
                webFormUrl: state.config.website ?? undefined,
                appealChannelId: state.config.channelId ?? undefined,
                cooldownHours: state.config.cooldown,
                maxAppealsPerUser: state.config.maxAppeals,
              });

              const successEmbed = new EmbedBuilder()
                .setTitle("✅ Appeals System Configured!")
                .setDescription("Your appeals system has been successfully set up.")
                .setColor(0x2ecc71)
                .addFields(
                  { name: "🔘 Status", value: state.config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
                  { name: "🌐 Website", value: state.config.website ?? "Default URL", inline: true },
                  {
                    name: "📝 Review Channel",
                    value: state.config.channelId ? `<#${state.config.channelId}>` : "Not set",
                    inline: true,
                  },
                  { name: "⏰ Cooldown", value: `${state.config.cooldown} hours`, inline: true },
                  { name: "🔢 Max Appeals", value: `${state.config.maxAppeals} per user`, inline: true }
                )
                .setTimestamp();

              await i.editReply({
                embeds: [successEmbed],
                components: [],
              });

              // Log the configuration
              await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
                userId: interaction.user.id,
                metadata: {
                  configType: "wizard_setup",
                  enabled: state.config.enabled,
                  website: state.config.website,
                  channelId: state.config.channelId,
                  cooldown: state.config.cooldown,
                  maxAppeals: state.config.maxAppeals,
                },
              });
            } catch (error) {
              logger.error("Error configuring appeals system:", error);
              await i.editReply({
                content: "❌ Failed to configure appeals system. Please try again.",
                embeds: [],
                components: [],
              });
            }
            collector.stop();
            break;
          }

          case "wizard_cancel":
            await i.update({
              content: "❌ **Appeals setup cancelled.**",
              embeds: [],
              components: [],
            });
            collector.stop();
            break;
        }
      } catch (error) {
        logger.error("Error in appeals wizard:", error);
        await i.followUp({ content: "❌ An error occurred. Please try again.", ephemeral: true });
      }
    })();
  });

  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      void interaction.editReply({
        content: "⏰ **Setup wizard timed out.** Use `/appeals setup wizard` to start again.",
        embeds: [],
        components: [],
      });
    }
  });
}

// Quick Setup Handler
async function handleQuickSetup(client: Client, interaction: GuildChatInputCommandInteraction) {
  const website = interaction.options.getString("website");
  const channel = interaction.options.getChannel("channel");
  const cooldown = interaction.options.getInteger("cooldown") ?? 24;
  const maxAppeals = interaction.options.getInteger("max_appeals") ?? 3;

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      enabled: true,
      webFormUrl: website ?? undefined,
      appealChannelId: channel?.id,
      cooldownHours: cooldown,
      maxAppealsPerUser: maxAppeals,
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Appeals System Configured")
      .setColor(0x2ecc71)
      .addFields(
        { name: "🌐 Website URL", value: website ?? "Using default from bot config", inline: false },
        { name: "📝 Review Channel", value: channel ? `<#${channel.id}>` : "Not set", inline: true },
        { name: "⏰ Cooldown", value: `${cooldown} hours`, inline: true },
        { name: "🔢 Max Appeals", value: `${maxAppeals} per user`, inline: true }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });

    // Log the configuration
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "quick_setup",
        website: website,
        channelId: channel?.id,
        cooldown: cooldown,
        maxAppeals: maxAppeals,
      },
    });
  } catch (error) {
    logger.error("Error in quick setup:", error);
    await interaction.followUp({
      content: "❌ Failed to configure appeals system. Please try again.",
      ephemeral: true,
    });
  }
}

// Status Handler with enhanced display
async function handleStatus(client: Client, interaction: GuildChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    const settings = await client.moderationManager.getAppealsSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle("⚖️ Appeals System Status")
      .setColor(settings.discordBotEnabled ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        { name: "🔘 Status", value: settings.discordBotEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "🌐 Website", value: settings.webFormUrl ?? "Default URL", inline: false },
        {
          name: "📝 Review Channel",
          value:
            "appealChannelId" in settings && settings.appealChannelId
              ? `<#${settings.appealChannelId}>`
              : "Not configured",
          inline: true,
        },
        { name: "⏰ Cooldown", value: `${Math.floor(settings.appealCooldown / 3600)} hours`, inline: true },
        { name: "🔢 Max Appeals", value: `${settings.maxAppealsPerUser} per user`, inline: true }
      )
      .setTimestamp();

    // Add message previews if they exist
    if ("appealReceived" in settings && (settings.appealReceived || settings.appealApproved || settings.appealDenied)) {
      const messages: string[] = [];
      if (settings.appealReceived) messages.push(`**📥 Received:** ${settings.appealReceived}`);
      if (settings.appealApproved) messages.push(`**✅ Approved:** ${settings.appealApproved}`);
      if (settings.appealDenied) messages.push(`**❌ Denied:** ${settings.appealDenied}`);

      embed.addFields({
        name: "💬 Custom Messages",
        value: messages.join("\n\n") || "Using defaults",
        inline: false,
      });
    }

    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("appeals_quick_setup")
        .setLabel("Quick Setup")
        .setEmoji("⚡")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("appeals_wizard")
        .setLabel("Setup Wizard")
        .setEmoji("🧙")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("appeals_toggle")
        .setLabel(settings.discordBotEnabled ? "Disable" : "Enable")
        .setEmoji(settings.discordBotEnabled ? "❌" : "✅")
        .setStyle(settings.discordBotEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    await interaction.followUp({
      embeds: [embed],
      components: [actionButtons],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error fetching appeals status:", error);
    await interaction.followUp({
      content: "❌ Failed to fetch appeals status. Please try again.",
      ephemeral: true,
    });
  }
}

// Toggle Handler
async function handleToggle(client: Client, interaction: GuildChatInputCommandInteraction) {
  const enable = interaction.options.getBoolean("enable", true);

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      enabled: enable,
    });

    await interaction.followUp({
      content: `${enable ? "✅" : "❌"} Appeals system has been **${enable ? "enabled" : "disabled"}**.`,
      ephemeral: true,
    });

    // Log the toggle
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "toggle",
        enabled: enable,
      },
    });
  } catch (error) {
    logger.error("Error toggling appeals system:", error);
    await interaction.followUp({
      content: "❌ Failed to toggle appeals system. Please try again.",
      ephemeral: true,
    });
  }
}

// Messages Handler
async function handleMessages(client: Client, interaction: GuildChatInputCommandInteraction) {
  const received = interaction.options.getString("received");
  const approved = interaction.options.getString("approved");
  const denied = interaction.options.getString("denied");

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.followUp({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  try {
    await client.moderationManager.configureAppealsSettings(interaction.guild.id, {
      appealReceived: received ?? undefined,
      appealApproved: approved ?? undefined,
      appealDenied: denied ?? undefined,
    });

    const embed = new EmbedBuilder().setTitle("✅ Appeal Messages Updated").setColor(0x2ecc71).setTimestamp();

    if (received) embed.addFields({ name: "📥 Received Message", value: received, inline: false });
    if (approved) embed.addFields({ name: "✅ Approved Message", value: approved, inline: false });
    if (denied) embed.addFields({ name: "❌ Denied Message", value: denied, inline: false });

    if (!received && !approved && !denied) {
      embed.setDescription("No messages were updated. Use the options to set custom messages.");
    }

    await interaction.followUp({ embeds: [embed], ephemeral: true });

    // Log the message update
    await client.logManager.log(interaction.guild.id, "APPEALS_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "messages",
        messagesUpdated: { received, approved, denied },
      },
    });
  } catch (error) {
    logger.error("Error updating appeal messages:", error);
    await interaction.followUp({
      content: "❌ Failed to update appeal messages. Please try again.",
      ephemeral: true,
    });
  }
}

// Main command
export default new Command(
  (() => {
    const builder = new SlashCommandBuilder()
      .setName("appeals")
      .setDescription("⚖️ Manage user appeals for punishments")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)

      // Setup Group
      .addSubcommandGroup((group) =>
        group
          .setName("setup")
          .setDescription("Configure the appeals system")
          .addSubcommand((sub) =>
            sub.setName("wizard").setDescription("Interactive setup wizard for first-time configuration")
          )
          .addSubcommand((sub) =>
            sub
              .setName("quick")
              .setDescription("Quick setup with basic options")
              .addStringOption((opt) =>
                opt.setName("website").setDescription("Your appeals website URL").setRequired(false)
              )
              .addChannelOption((opt) =>
                opt
                  .setName("channel")
                  .setDescription("Channel for staff review")
                  .addChannelTypes(ChannelType.GuildText)
                  .setRequired(false)
              )
              .addIntegerOption((opt) =>
                opt
                  .setName("cooldown")
                  .setDescription("Hours between appeals (default: 24)")
                  .setMinValue(1)
                  .setMaxValue(168)
                  .setRequired(false)
              )
              .addIntegerOption((opt) =>
                opt
                  .setName("max_appeals")
                  .setDescription("Maximum appeals per user (default: 3)")
                  .setMinValue(1)
                  .setMaxValue(10)
                  .setRequired(false)
              )
          )
      )

      // Management Group
      .addSubcommandGroup((group) =>
        group
          .setName("manage")
          .setDescription("Manage appeals system settings")
          .addSubcommand((sub) =>
            sub.setName("status").setDescription("View current appeals configuration with quick actions")
          )
          .addSubcommand((sub) =>
            sub
              .setName("toggle")
              .setDescription("Enable or disable the appeals system")
              .addBooleanOption((opt) =>
                opt.setName("enable").setDescription("Enable or disable appeals").setRequired(true)
              )
          )
          .addSubcommand((sub) =>
            sub
              .setName("messages")
              .setDescription("Configure custom appeal response messages")
              .addStringOption((opt) =>
                opt.setName("received").setDescription("Message sent when appeal is received").setRequired(false)
              )
              .addStringOption((opt) =>
                opt.setName("approved").setDescription("Message sent when appeal is approved").setRequired(false)
              )
              .addStringOption((opt) =>
                opt.setName("denied").setDescription("Message sent when appeal is denied").setRequired(false)
              )
          )
      );

    return builder;
  })(),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommandGroup) {
        case "setup":
          switch (subcommand) {
            case "wizard":
              await handleSetupWizard(client, interaction);
              break;
            case "quick":
              await handleQuickSetup(client, interaction);
              break;
          }
          break;

        case "manage":
          switch (subcommand) {
            case "status":
              await handleStatus(client, interaction);
              break;
            case "toggle":
              await handleToggle(client, interaction);
              break;
            case "messages":
              await handleMessages(client, interaction);
              break;
          }
          break;
      }
    } catch (error: unknown) {
      logger.error("Error in appeals command:", error);
      const errorMessage = `❌ Error configuring appeals: ${error instanceof Error ? error.message : "Unknown error"}`;

      if (interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
  {
    ephemeral: true,
    permissions: {
      level: PermissionLevel.ADMIN,
      discordPermissions: [PermissionsBitField.Flags.Administrator],
      isConfigurable: true,
    },
  }
);
