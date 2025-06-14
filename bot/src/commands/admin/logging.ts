import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { ALL_LOG_TYPES, LOG_CATEGORIES, STANDARD_LOG_TYPES } from "../../structures/LogManager.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

interface LoggingPreset {
  name: string;
  description: string;
  emoji: string;
  categories: string[];
  logTypes: string[];
  recommendedChannels: {
    name: string;
    categories: string[];
    description: string;
  }[];
}

const LOGGING_PRESETS: LoggingPreset[] = [
  {
    name: "Essential Logging",
    description: "Basic logging for small servers - tracks the most important events without spam",
    emoji: "📝",
    categories: ["MODERATION", "MEMBER", "ROLE", "SERVER"],
    logTypes: ["MESSAGE_DELETE", "MESSAGE_EDIT", "MEMBER_JOIN", "MEMBER_LEAVE", "MEMBER_BAN", "MEMBER_KICK"],
    recommendedChannels: [
      {
        name: "Server Log",
        categories: ["MODERATION", "MEMBER", "ROLE", "SERVER", "MESSAGE"],
        description: "All important server events in one place",
      },
    ],
  },
  {
    name: "Comprehensive Logging",
    description: "Complete logging for active servers - tracks everything except high-volume spam",
    emoji: "📊",
    categories: ["MESSAGE", "MEMBER", "ROLE", "CHANNEL", "VOICE", "SERVER", "MODERATION", "INVITE"],
    logTypes: STANDARD_LOG_TYPES,
    recommendedChannels: [
      {
        name: "Member Log",
        categories: ["MEMBER"],
        description: "User joins, leaves, roles, and profile changes",
      },
      {
        name: "Message Log",
        categories: ["MESSAGE"],
        description: "Message edits, deletions, and bulk operations",
      },
      {
        name: "Mod Log",
        categories: ["MODERATION"],
        description: "All moderation actions and punishments",
      },
      {
        name: "Server Log",
        categories: ["SERVER", "ROLE", "CHANNEL", "VOICE"],
        description: "Server settings, channels, roles, and voice events",
      },
    ],
  },
  {
    name: "Security Focused",
    description: "Enhanced security logging for servers requiring strict oversight",
    emoji: "🔒",
    categories: ["MODERATION", "MEMBER", "ROLE", "SERVER", "BOT", "WEBHOOK", "AUTOMOD", "REACTION_ROLE"],
    logTypes: [
      ...LOG_CATEGORIES.MODERATION,
      ...LOG_CATEGORIES.MEMBER,
      ...LOG_CATEGORIES.ROLE,
      ...LOG_CATEGORIES.SERVER,
      ...LOG_CATEGORIES.BOT,
      ...LOG_CATEGORIES.WEBHOOK,
      ...LOG_CATEGORIES.AUTOMOD,
      ...LOG_CATEGORIES.REACTION_ROLE,
      "MESSAGE_DELETE",
      "MESSAGE_EDIT",
      "INVITE_CREATE",
      "INVITE_DELETE",
    ],
    recommendedChannels: [
      {
        name: "Security Log",
        categories: ["MODERATION", "AUTOMOD", "BOT", "WEBHOOK", "REACTION_ROLE"],
        description: "All security-related events and automated actions",
      },
      {
        name: "Member Activity",
        categories: ["MEMBER"],
        description: "User activity and permission changes",
      },
      {
        name: "Admin Log",
        categories: ["SERVER", "ROLE", "CHANNEL"],
        description: "Administrative changes and server modifications",
      },
    ],
  },
  {
    name: "Community Server",
    description: "Optimized for large community servers with active chat and voice",
    emoji: "👥",
    categories: ["MESSAGE", "MEMBER", "VOICE", "MODERATION", "REACTION_ROLE", "INVITE"],
    logTypes: [
      ...LOG_CATEGORIES.MESSAGE.filter((type) => !["MESSAGE_CREATE"].includes(type)),
      ...LOG_CATEGORIES.MEMBER,
      ...LOG_CATEGORIES.VOICE.filter((type) => !type.startsWith("VOICE_SELF")),
      ...LOG_CATEGORIES.MODERATION,
      ...LOG_CATEGORIES.REACTION_ROLE,
      ...LOG_CATEGORIES.INVITE,
    ],
    recommendedChannels: [
      {
        name: "Member Log",
        categories: ["MEMBER"],
        description: "User joins, leaves, and activity tracking",
      },
      {
        name: "Chat Log",
        categories: ["MESSAGE"],
        description: "Message moderation and bulk operations",
      },
      {
        name: "Voice Log",
        categories: ["VOICE"],
        description: "Voice channel activity and moderation",
      },
      {
        name: "Mod Actions",
        categories: ["MODERATION", "REACTION_ROLE"],
        description: "Moderation actions and automated systems",
      },
    ],
  },
];

export default new Command(
  new SlashCommandBuilder()
    .setName("logging")
    .setDescription("🗂️ Comprehensive server logging configuration")
    .addSubcommand((sub) => sub.setName("setup").setDescription("🧙‍♂️ Launch the interactive logging setup wizard"))
    .addSubcommand((sub) =>
      sub
        .setName("preset")
        .setDescription("📦 Apply a logging preset configuration")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Preset type")
            .setRequired(true)
            .addChoices(
              { name: "📝 Essential Logging", value: "essential" },
              { name: "📊 Comprehensive Logging", value: "comprehensive" },
              { name: "🔒 Security Focused", value: "security" },
              { name: "👥 Community Server", value: "community" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("📊 View current logging configuration"))
    .addSubcommand((sub) => sub.setName("channels").setDescription("📍 Configure log channels for specific categories"))
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("🔄 Enable/disable specific log categories")
        .addStringOption((opt) => {
          opt.setName("category").setDescription("Log category to toggle").setRequired(true);
          Object.keys(LOG_CATEGORIES).forEach((category) => {
            opt.addChoices({ name: category, value: category });
          });
          return opt;
        })
        .addBooleanOption((opt) => opt.setName("enabled").setDescription("Enable or disable").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("advanced").setDescription("⚙️ Advanced logging configuration and management")),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "setup":
        await startLoggingWizard(client, interaction);
        break;
      case "preset":
        await applyLoggingPreset(client, interaction);
        break;
      case "status":
        await showLoggingStatus(client, interaction);
        break;
      case "channels":
        await configureChannels(client, interaction);
        break;
      case "toggle":
        await toggleCategory(client, interaction);
        break;
      case "advanced":
        await showAdvancedOptions(client, interaction);
        break;
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
    },
  }
);

async function startLoggingWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🗂️ Logging Setup Wizard")
    .setDescription(
      "Welcome to the **Server Logging Setup Wizard!**\n\n" +
        "This wizard will help you configure comprehensive logging for your server. " +
        "We'll guide you through each step to ensure you capture the right events.\n\n" +
        "**What we'll set up:**\n" +
        "🔹 **Message Logging** - Track edits, deletions, and bulk operations\n" +
        "🔹 **Member Activity** - Joins, leaves, roles, and profile changes\n" +
        "🔹 **Moderation Events** - Bans, kicks, timeouts, and warnings\n" +
        "🔹 **Server Changes** - Settings, channels, roles, and permissions\n" +
        "🔹 **Voice Activity** - Channel joins, leaves, and server actions\n\n" +
        "**Estimated time:** 2-4 minutes"
    )
    .addFields(
      {
        name: "📋 What You'll Configure",
        value:
          "• **Log Categories** - Choose what types of events to track\n" +
          "• **Channel Routing** - Set where different logs are sent\n" +
          "• **Volume Level** - Exclude high-spam events if desired\n" +
          "• **Permissions** - Ensure proper channel access",
        inline: true,
      },
      {
        name: "🎯 Setup Options",
        value:
          "• **Quick Presets** - Pre-configured templates\n" +
          "• **Custom Setup** - Build your own configuration\n" +
          "• **Import Settings** - Copy from another server",
        inline: true,
      }
    )
    .setFooter({ text: "Choose your preferred setup method below" })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("logging_wizard_presets")
      .setLabel("📦 Use Presets")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📦"),
    new ButtonBuilder()
      .setCustomId("logging_wizard_custom")
      .setLabel("⚙️ Custom Setup")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⚙️"),
    new ButtonBuilder()
      .setCustomId("logging_wizard_help")
      .setLabel("❓ Help & Guide")
      .setStyle(ButtonStyle.Success)
      .setEmoji("❓")
  );

  await interaction.reply({
    embeds: [welcomeEmbed],
    components: [buttons],
    ephemeral: true,
  });

  // Set up collector for button interactions
  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 600000, // 10 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (buttonInteraction: ButtonInteraction) => {
    void (async () => {
      try {
        switch (buttonInteraction.customId) {
          case "logging_wizard_presets":
            await showPresetSelection(buttonInteraction);
            break;
          case "logging_wizard_custom":
            await startCustomSetup(buttonInteraction);
            break;
          case "logging_wizard_help":
            await showLoggingHelp(buttonInteraction);
            break;
          case "logging_wizard_back":
            await startLoggingWizard(client, interaction);
            break;
          default:
            if (buttonInteraction.customId.startsWith("preset_")) {
              await handlePresetSelection(buttonInteraction, client);
            } else if (buttonInteraction.customId.startsWith("logging_")) {
              await handleLoggingAction(buttonInteraction, client);
            }
            break;
        }
      } catch (error) {
        logger.error("Error handling logging wizard interaction:", error);
        if (!buttonInteraction.replied && !buttonInteraction.deferred) {
          await buttonInteraction.reply({
            content: "❌ An error occurred. Please try again.",
            ephemeral: true,
          });
        }
      }
    })();
  });

  collector?.on("end", () => {
    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...buttons.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
    );

    void interaction.editReply({ components: [disabledButtons] }).catch((error: unknown) => {
      logger.error("Failed to disable buttons:", error);
    });
  });
}

async function showPresetSelection(interaction: ButtonInteraction): Promise<void> {
  const presetEmbed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📦 Logging Presets")
    .setDescription(
      "Choose a preset configuration that matches your server type and needs. " +
        "These templates are designed to provide optimal logging coverage without overwhelming your channels.\n\n" +
        "**All presets can be customized after setup!**"
    );

  LOGGING_PRESETS.forEach((preset) => {
    const categories = preset.categories.join(", ");
    const channels = preset.recommendedChannels.length;
    presetEmbed.addFields({
      name: `${preset.emoji} ${preset.name}`,
      value:
        `${preset.description}\n\n` +
        `**Categories:** ${categories}\n` +
        `**Log Types:** ${preset.logTypes.length} events\n` +
        `**Recommended Channels:** ${channels}`,
      inline: false,
    });
  });

  const presetButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("preset_essential").setLabel("📝 Essential").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("preset_comprehensive").setLabel("📊 Comprehensive").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("preset_security").setLabel("🔒 Security").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("preset_community").setLabel("👥 Community").setStyle(ButtonStyle.Success)
  );

  const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("logging_wizard_back")
      .setLabel("← Back to Main Menu")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [presetEmbed],
    components: [presetButtons, backButton],
  });
}

async function startCustomSetup(interaction: ButtonInteraction): Promise<void> {
  const customEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("⚙️ Custom Logging Setup")
    .setDescription(
      "Let's build a custom logging configuration for your server!\n\n" +
        "We'll walk through each category of events step by step, allowing you to choose exactly " +
        "what you want to track and where to send the logs."
    )
    .addFields(
      {
        name: "🔄 Setup Process",
        value:
          "1️⃣ **Choose Categories** - Select which event types to log\n" +
          "2️⃣ **Configure Channels** - Set up log channel routing\n" +
          "3️⃣ **Volume Control** - Include or exclude high-volume events\n" +
          "4️⃣ **Fine-tune Settings** - Adjust specific log types\n" +
          "5️⃣ **Review & Deploy** - Confirm and activate settings",
        inline: false,
      },
      {
        name: "💡 Best Practices",
        value:
          "• **Separate channels** for different log types\n" +
          "• **Start conservative** and add more as needed\n" +
          "• **Exclude high-volume** events initially\n" +
          "• **Set proper permissions** on log channels",
        inline: false,
      }
    );

  const setupButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("logging_step1_categories")
      .setLabel("1️⃣ Choose Categories")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("logging_quick_setup").setLabel("⚡ Quick Setup").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("logging_wizard_back").setLabel("← Back").setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [customEmbed],
    components: [setupButtons],
  });
}

async function showLoggingHelp(interaction: ButtonInteraction): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("❓ Logging Help & Information")
    .setDescription("Complete guide to server logging and what each category tracks.")
    .addFields(
      {
        name: "📊 What is Server Logging?",
        value:
          "Server logging automatically tracks and records various events that happen in your server. " +
          "This helps with moderation, security, and understanding your community's activity patterns.",
        inline: false,
      },
      {
        name: "📋 Log Categories Explained",
        value:
          "**📝 MESSAGE** - Message edits, deletions, bulk operations\n" +
          "**👥 MEMBER** - Joins, leaves, role changes, profile updates\n" +
          "**🛡️ MODERATION** - Bans, kicks, timeouts, warnings, cases\n" +
          "**🏢 SERVER** - Server settings, channels, roles, permissions\n" +
          "**🎤 VOICE** - Voice channel activity and moderation\n" +
          "**🎭 ROLE** - Role creation, deletion, permission changes\n" +
          "**📺 CHANNEL** - Channel management and modifications\n" +
          "**🔗 INVITE** - Invite creation and usage tracking",
        inline: false,
      },
      {
        name: "⚠️ High-Volume Events",
        value:
          "Some events generate many logs and can spam channels:\n" +
          "• **Message Creation** - Every sent message\n" +
          "• **Voice Self-Actions** - Users muting/unmuting themselves\n" +
          "• **Presence Changes** - Online/offline status updates\n" +
          "• **Reaction Events** - Adding/removing reactions\n\n" +
          "**Recommendation:** Start without these, add later if needed.",
        inline: false,
      },
      {
        name: "🎯 Channel Strategy",
        value:
          "**Single Channel:** Simple but can become crowded\n" +
          "**Category-based:** Different channels for different log types\n" +
          "**Priority-based:** Separate critical vs. informational logs\n\n" +
          "**Most Common Setup:**\n" +
          "• `#member-log` - User activity\n" +
          "• `#message-log` - Chat moderation\n" +
          "• `#mod-log` - Staff actions\n" +
          "• `#server-log` - Administrative changes",
        inline: false,
      }
    )
    .setFooter({ text: "Use the buttons below to get started!" });

  const helpButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("logging_wizard_presets").setLabel("📦 View Presets").setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("logging_wizard_custom")
      .setLabel("⚙️ Custom Setup")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("logging_wizard_back").setLabel("← Back").setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [helpEmbed],
    components: [helpButtons],
  });
}

async function handlePresetSelection(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const presetType = interaction.customId.replace("preset_", "");
  const preset = LOGGING_PRESETS.find((p) => p.name.toLowerCase().includes(presetType));

  if (!preset) {
    await interaction.reply({ content: "❌ Preset not found.", ephemeral: true });
    return;
  }

  await interaction.update({
    content: "⏳ Setting up logging preset...",
    embeds: [],
    components: [],
  });

  try {
    // Apply the preset configuration
    await client.logManager.enableLogTypes(interaction.guild.id, preset.logTypes);

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ ${preset.emoji} ${preset.name} Applied!`)
      .setDescription(
        `Successfully configured logging with the **${preset.name}** preset.\n\n` +
          `**Enabled:** ${preset.logTypes.length} log types\n` +
          `**Categories:** ${preset.categories.join(", ")}`
      )
      .addFields({
        name: "📍 Next Steps",
        value:
          "1. **Create log channels** using `/logging channels`\n" +
          "2. **Review settings** with `/logging status`\n" +
          "3. **Customize further** with `/logging advanced`\n\n" +
          "💡 **Tip:** Set up dedicated channels for different log types to keep things organized!",
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    logger.error("Error applying logging preset:", error);
    await interaction.followUp({
      content: "❌ Failed to apply preset. Please try again or contact support.",
      ephemeral: true,
    });
  }
}

async function handleLoggingAction(interaction: ButtonInteraction, client: Client): Promise<void> {
  // Handle various logging wizard actions
  const action = interaction.customId.replace("logging_", "");

  switch (action) {
    case "step1_categories":
      await showCategorySelection(interaction);
      break;
    case "quick_setup":
      await performQuickSetup(interaction, client);
      break;
    default:
      await interaction.reply({ content: "❌ Unknown action.", ephemeral: true });
      break;
  }
}

async function showCategorySelection(interaction: ButtonInteraction): Promise<void> {
  const categoryEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("1️⃣ Choose Log Categories")
    .setDescription(
      "Select which categories of events you want to track. You can always change these later.\n\n" +
        "**Recommended for most servers:** MESSAGE, MEMBER, MODERATION, SERVER"
    );

  const categories = Object.entries(LOG_CATEGORIES);
  categories.forEach(([category, types]) => {
    const isHighVolume = category === "HIGH_VOLUME";
    const emoji = isHighVolume ? "⚠️" : "✅";
    const description = isHighVolume ? "High-volume events (can spam channels)" : `${types.length} event types`;

    categoryEmbed.addFields({
      name: `${emoji} ${category}`,
      value: description,
      inline: true,
    });
  });

  const categoryButtons = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("cat_MESSAGE").setLabel("MESSAGE").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cat_MEMBER").setLabel("MEMBER").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cat_MODERATION").setLabel("MODERATION").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cat_SERVER").setLabel("SERVER").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("cat_VOICE").setLabel("VOICE").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cat_ROLE").setLabel("ROLE").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cat_CHANNEL").setLabel("CHANNEL").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("logging_next_step").setLabel("Continue →").setStyle(ButtonStyle.Success)
    ),
  ];

  await interaction.update({
    embeds: [categoryEmbed],
    components: categoryButtons,
  });
}

async function performQuickSetup(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.update({
    content: "⏳ Performing quick logging setup...",
    embeds: [],
    components: [],
  });

  try {
    // Enable standard log types (excludes high-volume)
    await client.logManager.enableLogTypes(interaction.guild.id, STANDARD_LOG_TYPES);

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("⚡ Quick Setup Complete!")
      .setDescription(
        "Successfully enabled standard logging configuration.\n\n" +
          `**Enabled:** ${STANDARD_LOG_TYPES.length} essential log types\n` +
          "**Excluded:** High-volume spam events"
      )
      .addFields({
        name: "📍 Next Steps",
        value:
          "1. **Set up log channels** using `/logging channels`\n" +
          "2. **Review what's enabled** with `/logging status`\n" +
          "3. **Enable more events** with `/logging toggle` if needed\n\n" +
          "💡 **Tip:** Create separate channels like `#member-log`, `#message-log`, etc.",
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    logger.error("Error performing quick setup:", error);
    await interaction.followUp({
      content: "❌ Quick setup failed. Please try the manual setup instead.",
      ephemeral: true,
    });
  }
}

async function applyLoggingPreset(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const presetType = interaction.options.getString("type", true);
  const preset = LOGGING_PRESETS.find((p) => p.name.toLowerCase().includes(presetType));

  if (!preset) {
    await interaction.reply({ content: "❌ Invalid preset type.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await client.logManager.enableLogTypes(interaction.guild.id, preset.logTypes);

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ ${preset.emoji} ${preset.name} Applied!`)
      .setDescription(
        `Successfully applied the **${preset.name}** logging preset.\n\n` +
          `**${preset.logTypes.length} log types** have been enabled.`
      )
      .addFields(
        {
          name: "📋 Enabled Categories",
          value: preset.categories.join(", "),
          inline: false,
        },
        {
          name: "📍 Recommended Channel Setup",
          value: preset.recommendedChannels.map((ch) => `**${ch.name}:** ${ch.description}`).join("\n"),
          inline: false,
        },
        {
          name: "🔄 Next Steps",
          value:
            "• Use `/logging channels` to set up log channel routing\n" +
            "• Use `/logging status` to review your configuration\n" +
            "• Use `/logging toggle` to enable/disable specific categories",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error applying preset:", error);
    await interaction.followUp({ content: "❌ Failed to apply preset. Please try again." });
  }
}

async function showLoggingStatus(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const settings = await client.logManager.getSettings(interaction.guild.id);
    const totalLogTypes = ALL_LOG_TYPES.length;
    const enabledCount = settings.enabledLogTypes.length;
    const disabledCount = totalLogTypes - enabledCount;

    const statusEmbed = new EmbedBuilder()
      .setColor(enabledCount > 0 ? 0x2ecc71 : 0x95a5a6)
      .setTitle("📊 Logging System Status")
      .setDescription(
        enabledCount > 0
          ? "🟢 **Logging is active** and monitoring your server"
          : "⚪ **Logging is inactive** - no events are currently being tracked"
      )
      .addFields(
        {
          name: "📈 Overview",
          value:
            `**Total Available:** ${totalLogTypes} log types\n` +
            `**Currently Enabled:** ${enabledCount}\n` +
            `**Disabled:** ${disabledCount}\n` +
            `**Coverage:** ${Math.round((enabledCount / totalLogTypes) * 100)}%`,
          inline: true,
        },
        {
          name: "📍 Channel Routing",
          value:
            Object.keys(settings.channelRouting).length > 0
              ? Object.entries(settings.channelRouting)
                  .slice(0, 5)
                  .map(([type, channelId]) => `**${type}:** <#${channelId}>`)
                  .join("\n") +
                (Object.keys(settings.channelRouting).length > 5
                  ? `\n... and ${Object.keys(settings.channelRouting).length - 5} more`
                  : "")
              : "No channels configured yet",
          inline: true,
        }
      );

    // Category breakdown
    const categoryStatus = Object.entries(LOG_CATEGORIES)
      .map(([category, types]) => {
        const categoryEnabled = types.filter((type: string) => settings.enabledLogTypes.includes(type));
        const percentage = Math.round((categoryEnabled.length / types.length) * 100);
        const statusIcon = percentage === 100 ? "🟢" : percentage > 0 ? "🟡" : "🔴";

        return `${statusIcon} **${category}**: ${categoryEnabled.length}/${types.length} (${percentage}%)`;
      })
      .join("\n");

    statusEmbed.addFields({
      name: "📋 Category Status",
      value: categoryStatus,
      inline: false,
    });

    // Management buttons
    const managementButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("logging_manage_channels")
        .setLabel("📍 Configure Channels")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("logging_manage_categories")
        .setLabel("🔄 Toggle Categories")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("logging_advanced_settings")
        .setLabel("⚙️ Advanced")
        .setStyle(ButtonStyle.Secondary)
    );

    if (enabledCount === 0) {
      statusEmbed.addFields({
        name: "🚀 Get Started",
        value:
          "**Quick Options:**\n" +
          "• `/logging setup` - Interactive setup wizard\n" +
          "• `/logging preset` - Apply pre-configured templates\n" +
          "• `/logging channels` - Configure log channels first",
        inline: false,
      });
    }

    await interaction.followUp({
      embeds: [statusEmbed],
      components: enabledCount > 0 ? [managementButtons] : [],
    });
  } catch (error) {
    logger.error("Error showing logging status:", error);
    await interaction.followUp({ content: "❌ Failed to retrieve logging status." });
  }
}

async function configureChannels(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const channelEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📍 Configure Log Channels")
    .setDescription(
      "Set up where different types of logs should be sent. You can route different categories " +
        "to different channels for better organization."
    )
    .addFields(
      {
        name: "💡 Recommended Setup",
        value:
          "**#member-log** - User activity (joins, leaves, roles)\n" +
          "**#message-log** - Chat moderation (edits, deletions)\n" +
          "**#mod-log** - Staff actions (bans, kicks, warnings)\n" +
          "**#server-log** - Administrative changes\n" +
          "**#voice-log** - Voice channel activity",
        inline: false,
      },
      {
        name: "🔧 How to Configure",
        value:
          "Use the buttons below to set up channel routing for each category. " +
          "You can also route multiple categories to the same channel if preferred.",
        inline: false,
      }
    );

  const categoryButtons = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("channel_config_MESSAGE")
        .setLabel("📝 Message Logs")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("channel_config_MEMBER")
        .setLabel("👥 Member Logs")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("channel_config_MODERATION")
        .setLabel("🛡️ Mod Logs")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("channel_config_SERVER")
        .setLabel("🏢 Server Logs")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("channel_config_VOICE").setLabel("🎤 Voice Logs").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("channel_config_ALL")
        .setLabel("📊 All to One Channel")
        .setStyle(ButtonStyle.Primary)
    ),
  ];

  await interaction.followUp({
    embeds: [channelEmbed],
    components: categoryButtons,
  });
}

/**
 * Handle button interactions for logging configuration
 */
export async function handleLoggingButtonInteraction(
  interaction: ButtonInteraction | ChannelSelectMenuInteraction
): Promise<void> {
  const client = interaction.client as Client;

  try {
    // Handle channel select menu interactions
    if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("logging_channel_select_")) {
      await handleChannelSelection(interaction, client);
      return;
    }

    if (!interaction.isButton()) return;

    // Handle preset selection buttons
    if (interaction.customId.startsWith("preset_")) {
      await handlePresetSelection(interaction, client);
      return;
    }

    // Handle wizard navigation buttons
    if (interaction.customId === "logging_wizard_back") {
      await interaction.reply({
        content: "⬅️ To restart the setup wizard, please use `/logging setup` again.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === "logging_quick_setup") {
      await performQuickSetup(interaction, client);
      return;
    }

    if (interaction.customId === "logging_custom_setup") {
      await startCustomSetup(interaction);
      return;
    }

    // Handle category selection
    if (interaction.customId === "logging_step1_categories") {
      await showCategorySelection(interaction);
      return;
    }

    // Handle channel configuration buttons
    if (interaction.customId.startsWith("channel_config_")) {
      await handleChannelConfiguration(interaction, client);
      return;
    }

    // Handle status management buttons
    if (interaction.customId === "logging_manage_channels") {
      await interaction.reply({
        content: "📍 To configure channels, please use `/logging channels` command.",
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === "logging_manage_categories") {
      await showCategoryToggle(interaction);
      return;
    }

    if (interaction.customId === "logging_advanced_settings") {
      await interaction.reply({
        content: "⚙️ To access advanced options, please use `/logging advanced` command.",
        ephemeral: true,
      });
      return;
    }

    // Default fallback
    await interaction.reply({
      content: "❌ This button interaction is not implemented yet.",
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error handling logging button interaction:", error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ An error occurred while processing your request.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "❌ An error occurred while processing your request.",
        ephemeral: true,
      });
    }
  }
}

/**
 * Handle channel selection for logging configuration
 */
async function handleChannelSelection(interaction: ChannelSelectMenuInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const category = interaction.customId.replace("logging_channel_select_", "");

  // Add debugging information
  logger.info(`Channel selection for category: "${category}" from customId: "${interaction.customId}"`);

  // Handle special case for "ALL" category
  if (category === "ALL") {
    await handleAllChannelSelection(interaction, client);
    return;
  }

  // Validate that the category exists in LOG_CATEGORIES
  if (!(category in LOG_CATEGORIES)) {
    logger.error(
      `Invalid category "${category}" in channel selection. Available categories:`,
      Object.keys(LOG_CATEGORIES)
    );
    await interaction.reply({
      content: `❌ Invalid log category "${category}". Please use the \`/logging channels\` command to configure channels properly.`,
      ephemeral: true,
    });
    return;
  }

  const selectedChannel = interaction.channels.first();

  if (!selectedChannel) {
    await interaction.reply({ content: "❌ No channel selected.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Check bot permissions in the selected channel
    const botMember = interaction.guild.members.me;
    if (!botMember) {
      await interaction.editReply({ content: "❌ Unable to check bot permissions." });
      return;
    }

    // Type guard to ensure we have a proper guild channel
    const guildChannel = interaction.guild.channels.cache.get(selectedChannel.id);
    if (!guildChannel?.isTextBased()) {
      await interaction.editReply({ content: "❌ Selected channel is not a valid text channel." });
      return;
    }

    const channelPerms = guildChannel.permissionsFor(botMember);
    if (!channelPerms.has(["ViewChannel", "SendMessages", "EmbedLinks"])) {
      await interaction.editReply({
        content: `❌ I need the following permissions in <#${selectedChannel.id}>:\n• View Channel\n• Send Messages\n• Embed Links`,
      });
      return;
    }

    // Save the channel configuration
    const channelMapping = { [category]: selectedChannel.id };
    await client.logManager.setupCategoryLogging(interaction.guild.id, channelMapping);

    // Get category types safely
    const categoryTypes = LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES];

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Log Channel Configured!")
      .setDescription(`**${category}** logs will now be sent to <#${selectedChannel.id}>`)
      .addFields(
        {
          name: "📋 Log Types Included",
          value:
            categoryTypes
              .slice(0, 8)
              .map((type: string) => `• ${type.replace(/_/g, " ").toLowerCase()}`)
              .join("\n") + (categoryTypes.length > 8 ? `\n• ...and ${categoryTypes.length - 8} more` : ""),
          inline: false,
        },
        {
          name: "🔄 Next Steps",
          value:
            "• Configure more categories with `/logging channels`\n" +
            "• Check your settings with `/logging status`\n" +
            "• Enable/disable specific categories with `/logging toggle`",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Log the configuration change
    await client.logManager.log(interaction.guild.id, "LOGGING_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "channel-routing",
        category,
        channelId: selectedChannel.id,
        channelName: guildChannel.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error configuring log channel:", error);
    await interaction.editReply({
      content: "❌ Failed to configure log channel. Please try again.",
    });
  }
}

async function handleAllChannelSelection(interaction: ChannelSelectMenuInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const selectedChannel = interaction.channels.first();

  if (!selectedChannel) {
    await interaction.reply({ content: "❌ No channel selected.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Check bot permissions in the selected channel
    const botMember = interaction.guild.members.me;
    if (!botMember) {
      await interaction.editReply({ content: "❌ Unable to check bot permissions." });
      return;
    }

    // Type guard to ensure we have a proper guild channel
    const guildChannel = interaction.guild.channels.cache.get(selectedChannel.id);
    if (!guildChannel?.isTextBased()) {
      await interaction.editReply({ content: "❌ Selected channel is not a valid text channel." });
      return;
    }

    const channelPerms = guildChannel.permissionsFor(botMember);
    if (!channelPerms.has(["ViewChannel", "SendMessages", "EmbedLinks"])) {
      await interaction.editReply({
        content: `❌ I need the following permissions in <#${selectedChannel.id}>:\n• View Channel\n• Send Messages\n• Embed Links`,
      });
      return;
    }

    // Create channel mapping for all categories
    const allCategoryMappings: Record<string, string> = {};
    Object.keys(LOG_CATEGORIES).forEach((category) => {
      allCategoryMappings[category] = selectedChannel.id;
    });

    // Save the channel configuration for all categories
    await client.logManager.setupCategoryLogging(interaction.guild.id, allCategoryMappings);

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ All-in-One Log Channel Configured!")
      .setDescription(`**All log categories** will now be sent to <#${selectedChannel.id}>`)
      .addFields(
        {
          name: "📋 Categories Configured",
          value:
            Object.keys(LOG_CATEGORIES)
              .slice(0, 8)
              .map((cat) => `• ${cat.toLowerCase().replace(/_/g, " ")}`)
              .join("\n") +
            (Object.keys(LOG_CATEGORIES).length > 8 ? `\n• ...and ${Object.keys(LOG_CATEGORIES).length - 8} more` : ""),
          inline: false,
        },
        {
          name: "📊 Total Log Types",
          value: `**${ALL_LOG_TYPES.length}** different log types will be sent to this channel`,
          inline: false,
        },
        {
          name: "🔄 Next Steps",
          value:
            "• Monitor the channel volume and adjust as needed\n" +
            "• Use `/logging toggle` to disable specific categories if too busy\n" +
            "• Consider setting up separate channels later with `/logging channels`",
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    // Log the configuration change
    await client.logManager.log(interaction.guild.id, "LOGGING_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        configType: "all-in-one-channel",
        channelId: selectedChannel.id,
        channelName: guildChannel.name,
        categoriesConfigured: Object.keys(LOG_CATEGORIES),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error configuring all-in-one log channel:", error);
    await interaction.editReply({
      content: "❌ Failed to configure log channel. Please try again.",
    });
  }
}

async function handleChannelConfiguration(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const category = interaction.customId.replace("channel_config_", "");

  // Add debugging information
  logger.info(`Channel configuration requested for category: "${category}" from customId: "${interaction.customId}"`);

  // Handle special case for "ALL" category
  if (category === "ALL") {
    await handleAllCategoryConfiguration(interaction, client);
    return;
  }

  // Validate that the category exists in LOG_CATEGORIES
  if (!(category in LOG_CATEGORIES)) {
    logger.error(
      `Invalid category "${category}" requested for channel configuration. Available categories:`,
      Object.keys(LOG_CATEGORIES)
    );
    await interaction.reply({
      content: `❌ Invalid log category "${category}". Please use the \`/logging channels\` command to configure channels properly.`,
      ephemeral: true,
    });
    return;
  }

  const categoryTypes = LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES];

  // Additional safety check
  if (!Array.isArray(categoryTypes)) {
    logger.error(`Category "${category}" does not contain an array of log types:`, categoryTypes);
    await interaction.reply({
      content: `❌ Invalid configuration for category "${category}". Please contact an administrator.`,
      ephemeral: true,
    });
    return;
  }

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`logging_channel_select_${category}`)
    .setPlaceholder(`Select a channel for ${category} logs`)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMaxValues(1);

  const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📍 Configure ${category} Log Channel`)
    .setDescription(
      `Select the channel where **${category}** logs should be sent.\n\n` +
        `**This category includes:**\n` +
        categoryTypes
          .slice(0, 5)
          .map((type: string) => `• ${type.replace(/_/g, " ").toLowerCase()}`)
          .join("\n") +
        (categoryTypes.length > 5 ? `\n• ...and ${categoryTypes.length - 5} more` : "")
    )
    .addFields({
      name: "💡 Tips",
      value:
        "• Choose a channel that only moderators can see\n" +
        "• Make sure the bot has permission to send messages\n" +
        "• You can change this later if needed",
      inline: false,
    });

  await interaction.reply({
    embeds: [embed],
    components: [selectRow],
    ephemeral: true,
  });
}

async function handleAllCategoryConfiguration(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId("logging_channel_select_ALL")
    .setPlaceholder("Select a channel for all log categories")
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMaxValues(1);

  const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📊 Configure All-in-One Log Channel")
    .setDescription(
      "Select a single channel where **all** log categories will be sent.\n\n" +
        "**This will route all log types to one channel including:**\n" +
        `• Message logs (${LOG_CATEGORIES.MESSAGE.length} types)\n` +
        `• Member logs (${LOG_CATEGORIES.MEMBER.length} types)\n` +
        `• Moderation logs (${LOG_CATEGORIES.MODERATION.length} types)\n` +
        `• Server logs (${LOG_CATEGORIES.SERVER.length} types)\n` +
        `• Voice logs (${LOG_CATEGORIES.VOICE.length} types)\n` +
        `• And ${Object.keys(LOG_CATEGORIES).length - 5} more categories`
    )
    .addFields(
      {
        name: "⚠️ Important Notes",
        value:
          "• This will create a **very busy** channel with many logs\n" +
          "• Consider using separate channels for different categories\n" +
          "• You can always reconfigure individual categories later",
        inline: false,
      },
      {
        name: "💡 Tips",
        value:
          "• Choose a channel that only moderators can see\n" + "• Make sure the bot has permission to send messages",
        inline: false,
      }
    );

  await interaction.reply({
    embeds: [embed],
    components: [selectRow],
    ephemeral: true,
  });
}

async function showCategoryToggle(interaction: ButtonInteraction): Promise<void> {
  const toggleEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🔄 Toggle Log Categories")
    .setDescription(
      "Use the `/logging toggle` command to enable or disable specific log categories.\n\n" +
        "**Available categories:**\n" +
        Object.keys(LOG_CATEGORIES)
          .map((cat) => `• \`${cat}\``)
          .join("\n")
    )
    .addFields({
      name: "📝 Example Usage",
      value: "• `/logging toggle category:MESSAGE enabled:true`\n• `/logging toggle category:MEMBER enabled:false`",
      inline: false,
    });

  await interaction.reply({ embeds: [toggleEmbed], ephemeral: true });
}

async function toggleCategory(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    return;
  }

  const category = interaction.options.getString("category", true);
  const enabled = interaction.options.getBoolean("enabled", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const categoryTypes = LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES];

    if (enabled) {
      await client.logManager.enableLogTypes(interaction.guild.id, [...categoryTypes]);
    } else {
      await client.logManager.disableLogTypes(interaction.guild.id, [...categoryTypes]);
    }

    const statusEmoji = enabled ? "✅" : "❌";
    const statusText = enabled ? "enabled" : "disabled";

    await interaction.followUp({
      content:
        `${statusEmoji} **${category}** category ${statusText}!\n\n` +
        `**Affected log types:** ${categoryTypes.length}\n` +
        `Use \`/logging status\` to view your complete configuration.`,
    });
  } catch (error) {
    logger.error("Error toggling category:", error);
    await interaction.followUp({ content: "❌ Failed to toggle category." });
  }
}

async function showAdvancedOptions(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const advancedEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("⚙️ Advanced Logging Configuration")
    .setDescription("Advanced options for fine-tuning your logging setup.")
    .addFields(
      {
        name: "🔧 Available Actions",
        value:
          "• **High-Volume Events** - Enable/disable spam-prone events\n" +
          "• **Bulk Operations** - Mass enable/disable categories\n" +
          "• **Channel Templates** - Create channel sets automatically\n" +
          "• **Import/Export** - Backup and restore configurations\n" +
          "• **Ignore Lists** - Exclude specific users/channels/roles",
        inline: false,
      },
      {
        name: "⚠️ High-Volume Events",
        value:
          "Events that can generate many logs per minute:\n" +
          "• Message creation (every message sent)\n" +
          "• Voice self-actions (mute/unmute)\n" +
          "• Presence changes (online/offline)\n" +
          "• Reaction additions/removals",
        inline: false,
      }
    );

  const advancedButtons = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("advanced_high_volume")
        .setLabel("⚠️ High-Volume Events")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("advanced_bulk_ops")
        .setLabel("📦 Bulk Operations")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("advanced_ignore_lists")
        .setLabel("🚫 Ignore Lists")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];

  await interaction.followUp({
    embeds: [advancedEmbed],
    components: advancedButtons,
  });
}
