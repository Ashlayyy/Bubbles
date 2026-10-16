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
import { ALL_LOG_TYPES, LOG_CATEGORIES, STANDARD_LOG_TYPES } from "../../../structures/LogManager.js";
import {
  WIZARD_COLORS,
  WIZARD_EMOJIS,
  createButtonRow,
  createHelpButton,
  createPresetButton,
  createQuickSetupButton,
} from "./WizardComponents.js";

// Helper type & accessor for optional queue service
interface QueueService {
  processRequest: (payload: unknown) => Promise<unknown>;
}
function getQueueService(client: Client): QueueService | undefined {
  return (client as unknown as { queueService?: QueueService }).queueService;
}

// State management for the wizard
interface LoggingWizardState {
  selectedCategories: string[];
  channelMappings: Record<string, string>;
  includeHighVolume: boolean;
  currentStep: number;
  preset?: string;
  testMode: boolean;
}

// Store wizard states per user
const wizardStates = new Map<string, LoggingWizardState>();

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

// Export only the wizard function - no standalone command
export { startLoggingWizard };

async function startLoggingWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  // Initialize wizard state for this user
  const stateKey = `${interaction.guild.id}-${interaction.user.id}`;
  wizardStates.set(stateKey, {
    selectedCategories: [],
    channelMappings: {},
    includeHighVolume: false,
    currentStep: 0,
    testMode: false,
  });

  await showMainMenu(interaction, client);
}

async function showMainMenu(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  client: Client
): Promise<void> {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(WIZARD_COLORS.PRIMARY)
    .setTitle(`${WIZARD_EMOJIS.LOGGING} Logging Setup Wizard`)
    .setDescription(
      "Welcome to the **Server Logging Setup Wizard!**\n\n" +
        "This wizard will help you configure comprehensive logging for your server. " +
        "We'll guide you through each step with clear explanations.\n\n" +
        "**What we'll set up:**\n" +
        "🔹 **Event Categories** - Choose what to track\n" +
        "🔹 **Channel Routing** - Where to send logs\n" +
        "🔹 **Volume Control** - Manage high-volume events\n" +
        "🔹 **Test Mode** - Preview logs before going live\n" +
        "🔹 **Custom Settings** - Fine-tune your setup\n\n" +
        "**Estimated time:** 3-5 minutes"
    )
    .addFields(
      {
        name: "📋 What You'll Choose",
        value:
          "• Which event categories to log\n" +
          "• Channel assignments for different log types\n" +
          "• High-volume event filtering\n" +
          "• Test logs to verify setup\n" +
          "• Custom log formats and settings",
        inline: true,
      },
      {
        name: "🎯 Quick Start Options",
        value:
          "• **Preset Templates** - Pre-configured setups\n" +
          "• **Custom Configuration** - Build your own\n" +
          "• **Quick Setup** - Essential logging only\n" +
          "• **Test Mode** - Preview before applying",
        inline: true,
      }
    )
    .setFooter({ text: "Choose how you'd like to proceed below" })
    .setTimestamp();

  const buttons = createButtonRow(
    createPresetButton("logging_wizard_presets", "Use Presets", "📦"),
    createPresetButton("logging_wizard_custom", "Custom Setup", "⚙️"),
    createQuickSetupButton("logging_quick_setup", "Quick Setup"),
    createHelpButton("logging_wizard_help", "Help & Info")
  );

  // Check interaction state before replying
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      embeds: [welcomeEmbed],
      components: [buttons],
      flags: 64,
    });
  } else if (interaction.deferred) {
    await interaction.editReply({
      embeds: [welcomeEmbed],
      components: [buttons],
    });
  } else {
    await interaction.followUp({
      embeds: [welcomeEmbed],
      components: [buttons],
      flags: 64,
    });
  }

  // Note: Button interactions are now handled by the global handleLoggingButtonInteraction function
  // which is called from the main button interaction event handler
}

async function showPresetSelection(interaction: ButtonInteraction, client: Client): Promise<void> {
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
        `**Log Types:** ${String(preset.logTypes.length)} events\n` +
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

async function startCustomSetup(interaction: ButtonInteraction, client: Client): Promise<void> {
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
          "4️⃣ **Test Mode** - Preview logs before going live\n" +
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

async function showLoggingHelp(interaction: ButtonInteraction, client: Client): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("❓ Logging Help & Information")
    .setDescription(
      "Use `/setup logging` to configure logging for your server!\n\n" +
        "**Quick Start Options:**\n" +
        "• `/setup logging` - Interactive setup wizard\n" +
        "• **Preset Templates** - Pre-configured setups\n" +
        "• **Custom Configuration** - Build your own\n" +
        "• **Test Mode** - Preview before applying"
    )
    .addFields(
      {
        name: "📋 Log Categories",
        value:
          "• **Message Logging** - Track edits, deletions, and bulk operations\n" +
          "• **Member Activity** - Joins, leaves, roles, and profile changes\n" +
          "• **Moderation Events** - Bans, kicks, timeouts, and warnings\n" +
          "• **Server Changes** - Settings, channels, roles, and permissions\n" +
          "• **Voice Activity** - Channel joins, leaves, and server actions",
        inline: false,
      },
      {
        name: "⚡ Quick Setup",
        value:
          "• **Essential Logging** - Basic logging for small servers\n" +
          "• **Comprehensive Logging** - Complete logging for active servers\n" +
          "• **Security Focused** - Enhanced security logging\n" +
          "• **Community Server** - Optimized for large communities",
        inline: false,
      }
    )
    .setFooter({ text: "Choose a preset or build your own configuration" })
    .setTimestamp();

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
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const presetType = interaction.customId.replace("preset_", "");
  const preset = LOGGING_PRESETS.find((p) => p.name.toLowerCase().includes(presetType));

  if (!preset) {
    await interaction.reply({ content: "❌ Preset not found.", flags: 64 });
    return;
  }

  // Update wizard state
  const stateKey = `${interaction.guild.id}-${interaction.user.id}`;
  const state = wizardStates.get(stateKey);
  if (state) {
    state.selectedCategories = preset.categories;
    state.preset = presetType;
    wizardStates.set(stateKey, state);
  }

  await interaction.update({
    content: "⏳ Setting up logging preset...",
    embeds: [],
    components: [],
  });

  try {
    // Apply the preset configuration
    await client.logManager.enableLogTypes(interaction.guild.id, preset.logTypes);

    // Notify API of logging preset change
    if (getQueueService(client)) {
      try {
        await getQueueService(client)?.processRequest({
          type: "LOGGING_UPDATE",
          data: {
            guildId: interaction.guild.id,
            preset: presetType,
            enabledLogTypes: preset.logTypes,
            action: "APPLY_PRESET",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of logging preset change:", error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle(`✅ ${preset.emoji} ${preset.name} Applied!`)
      .setDescription(
        `Successfully configured logging with the **${preset.name}** preset.\n\n` +
          `**Enabled:** ${String(preset.logTypes.length)} log types\n` +
          `**Categories:** ${preset.categories.join(", ")}`
      )
      .addFields({
        name: "📍 Next Steps",
        value:
          "1. **Create log channels** using the channel configuration step\n" +
          "2. **Review settings** with the status check\n" +
          "3. **Test the setup** with test mode\n" +
          "4. **Customize further** if needed\n\n" +
          "💡 **Tip:** Set up dedicated channels for different log types to keep things organized!",
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed], flags: 64 });
  } catch (error) {
    logger.error("Error applying logging preset:", error);
    await interaction.followUp({
      content: "❌ Failed to apply preset. Please try again.",
      flags: 64,
    });
  }
}

async function handleLoggingAction(interaction: ButtonInteraction, client: Client): Promise<void> {
  // Handle various logging wizard actions
  const action = interaction.customId.replace("logging_", "");

  switch (action) {
    case "step1_categories":
      await showCategorySelection(interaction, client);
      break;
    case "quick_setup":
      await performQuickSetup(interaction, client);
      break;
    default:
      await interaction.reply({ content: "❌ Unknown action.", flags: 64 });
      break;
  }
}

async function showCategorySelection(interaction: ButtonInteraction, client: Client): Promise<void> {
  const stateKey = `${interaction.guild!.id}-${interaction.user.id}`;
  const state = wizardStates.get(stateKey);

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
    const isSelected = state?.selectedCategories.includes(category);
    const emoji = isHighVolume ? "⚠️" : isSelected ? "✅" : "❌";
    const description = isHighVolume ? "High-volume events (can spam channels)" : `${String(types.length)} event types`;

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
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
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
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("⚡ Quick Setup Complete!")
      .setDescription(
        "Successfully enabled standard logging configuration.\n\n" +
          `**Enabled:** ${String(STANDARD_LOG_TYPES.length)} essential log types\n` +
          "**Excluded:** High-volume spam events"
      )
      .addFields({
        name: "📍 Next Steps",
        value:
          "1. **Set up log channels** using the channel configuration step\n" +
          "2. **Review what's enabled** with the status check\n" +
          "3. **Test the setup** with test mode\n" +
          "4. **Enable more events** if needed\n\n" +
          "💡 **Tip:** Create separate channels like `#member-log`, `#message-log`, etc.",
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed], flags: 64 });
  } catch (error) {
    logger.error("Error performing quick setup:", error);
    await interaction.followUp({
      content: "❌ Quick setup failed. Please try the manual setup instead.",
      flags: 64,
    });
  }
}

async function applyConfiguration(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const state = wizardStates.get(`${interaction.guild.id}-${interaction.user.id}`);
  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  try {
    // Apply channel routing
    await client.logManager.setupCategoryLogging(interaction.guild.id, state.channelMappings);

    // Apply log type toggles
    if (state.includeHighVolume) {
      await client.logManager.enableLogTypes(interaction.guild.id, ALL_LOG_TYPES);
    } else {
      await client.logManager.enableLogTypes(interaction.guild.id, STANDARD_LOG_TYPES);
    }

    // Notify API of logging configuration change
    if (getQueueService(client)) {
      try {
        await getQueueService(client)?.processRequest({
          type: "LOGGING_UPDATE",
          data: {
            guildId: interaction.guild.id,
            channelRouting: state.channelMappings,
            enabledLogTypes: state.includeHighVolume ? ALL_LOG_TYPES : STANDARD_LOG_TYPES,
            action: "APPLY_CONFIG",
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of logging configuration change:", error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Logging Configuration Applied!")
      .setDescription(
        `Successfully applied your logging configuration.\n\n` +
          `**Channel Routing:** ${Object.keys(state.channelMappings).length} channels configured.\n` +
          `**Log Types:** ${state.includeHighVolume ? "All" : "Standard"} events enabled.`
      )
      .addFields({
        name: "📍 Next Steps",
        value:
          "• Use the status check to review your complete configuration\n" +
          "• Use test mode to verify everything is working\n" +
          "• Customize further if needed\n\n" +
          "💡 **Tip:** Set up dedicated channels for different log types to keep things organized!",
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed] });

    // Clear wizard state
    wizardStates.delete(`${interaction.guild.id}-${interaction.user.id}`);
  } catch (error) {
    logger.error("Error applying logging configuration:", error);
    await interaction.followUp({ content: "❌ Failed to apply configuration. Please try again." });
    wizardStates.delete(`${interaction.guild.id}-${interaction.user.id}`);
  }
}

async function showTestModeOptions(interaction: ButtonInteraction, client: Client): Promise<void> {
  const testModeEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🧪 Test Mode")
    .setDescription(
      "Enable test mode to preview how logs will look before applying them to your server.\n\n" +
        "**Test Mode Features:**\n" +
        "• **Preview Logs** - See example events in a dedicated channel\n" +
        "• **No API Calls** - Your server's logs remain unchanged\n" +
        "• **No Channel Routing** - All logs go to the test channel"
    )
    .addFields(
      {
        name: "💡 How to Use",
        value:
          "1. **Choose a Test Channel** - Select a channel where you want to see example logs.\n" +
          "2. **Enable Test Mode** - Click the button below to activate test mode.\n" +
          "3. **Preview Events** - Send a message in the test channel, and you'll see it in the test channel.\n" +
          "4. **Disable Test Mode** - Click the button again to revert to live mode.",
        inline: false,
      },
      {
        name: "⚠️ Important",
        value:
          "• Test mode is **temporary** and will be lost after the wizard closes.\n" +
          "• Your server's actual logs will not be affected by test mode.",
        inline: false,
      }
    );

  const testModeButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("logging_test_mode_enable")
      .setLabel("Enable Test Mode")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("logging_test_mode_disable")
      .setLabel("Disable Test Mode")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [testModeEmbed],
    components: [testModeButtons],
  });
}

async function handleTestLog(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const state = wizardStates.get(`${interaction.guild.id}-${interaction.user.id}`);
  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  if (!state.testMode) {
    await interaction.reply({ content: "❌ Test mode is not enabled. Please enable it first.", flags: 64 });
    return;
  }

  const testChannel = interaction.channel;
  if (!testChannel?.isTextBased()) {
    await interaction.reply({ content: "❌ This command can only be used in a text channel.", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  try {
    // Check bot permissions in the test channel
    const botMember = interaction.guild.members.me;
    if (!botMember) {
      await interaction.editReply({ content: "❌ Unable to check bot permissions." });
      return;
    }

    const guildChannel = interaction.guild.channels.cache.get(testChannel.id);
    if (!guildChannel?.isTextBased()) {
      await interaction.editReply({ content: "❌ Selected channel is not a valid text channel." });
      return;
    }

    const channelPerms = guildChannel.permissionsFor(botMember);
    if (!channelPerms.has(["ViewChannel", "SendMessages", "EmbedLinks"])) {
      await interaction.editReply({
        content: `❌ I need the following permissions in <#${testChannel.id}>:\n• View Channel\n• Send Messages\n• Embed Links`,
      });
      return;
    }

    // Send a test log
    const testEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🧪 Test Log")
      .setDescription("This is a test log message. It will be sent to the test channel.")
      .addFields({
        name: "🔗 Channel",
        value: `<#${testChannel.id}>`,
        inline: false,
      })
      .setTimestamp();

    await guildChannel.send({
      embeds: [testEmbed],
    });

    const successEmbed = new EmbedBuilder()
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Test Log Sent!")
      .setDescription(`Your test log has been sent to <#${testChannel.id}>`)
      .addFields({
        name: "🔗 Channel",
        value: `<#${testChannel.id}>`,
        inline: false,
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [successEmbed] });
  } catch (error) {
    logger.error("Error sending test log:", error);
    await interaction.followUp({ content: "❌ Failed to send test log. Please try again." });
  }
}

async function handleNextStep(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const stateKey = `${interaction.guild.id}-${interaction.user.id}`;
  const state = wizardStates.get(stateKey);

  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  // Update the current step
  state.currentStep = 2; // Move to channel configuration step
  wizardStates.set(stateKey, state);

  // Show channel configuration options
  const channelConfigEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🔗 Step 2: Channel Configuration")
    .setDescription(
      "Now let's configure where each log category will be sent. You can either:\n\n" +
        "**Option 1: Individual Channel Setup**\n" +
        "• Configure each category to a specific channel\n" +
        "• More control over log organization\n\n" +
        "**Option 2: All-in-One Channel**\n" +
        "• Send all logs to a single channel\n" +
        "• Simpler setup, less organization"
    )
    .addFields({
      name: "📋 Selected Categories",
      value:
        state.selectedCategories.length > 0
          ? state.selectedCategories.map((cat) => `• ${cat}`).join("\n")
          : "No categories selected",
      inline: false,
    });

  const channelConfigButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("channel_config_individual")
      .setLabel("Individual Channels")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("channel_config_all")
      .setLabel("All-in-One Channel")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("logging_wizard_back").setLabel("← Back").setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [channelConfigEmbed],
    components: [channelConfigButtons],
  });
}

async function handleCategoryToggle(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const category = interaction.customId.replace("cat_", "");
  const stateKey = `${interaction.guild.id}-${interaction.user.id}`;
  const state = wizardStates.get(stateKey);

  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  // Toggle the category selection
  const categoryIndex = state.selectedCategories.indexOf(category);
  if (categoryIndex > -1) {
    // Remove category if already selected
    state.selectedCategories.splice(categoryIndex, 1);
  } else {
    // Add category if not selected
    state.selectedCategories.push(category);
  }

  wizardStates.set(stateKey, state);

  // Update the button to show the new state
  const isSelected = state.selectedCategories.includes(category);
  const buttonStyle = isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary;
  const buttonLabel = `${isSelected ? "✅" : "❌"} ${category}`;

  // Create updated buttons for the category selection
  const categoryButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cat_MESSAGE")
      .setLabel(`MESSAGE`)
      .setStyle(state.selectedCategories.includes("MESSAGE") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cat_MEMBER")
      .setLabel(`MEMBER`)
      .setStyle(state.selectedCategories.includes("MEMBER") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cat_MODERATION")
      .setLabel(`MODERATION`)
      .setStyle(state.selectedCategories.includes("MODERATION") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cat_SERVER")
      .setLabel(`SERVER`)
      .setStyle(state.selectedCategories.includes("SERVER") ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const categoryButtons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("cat_VOICE")
      .setLabel(`VOICE`)
      .setStyle(state.selectedCategories.includes("VOICE") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cat_ROLE")
      .setLabel(`ROLE`)
      .setStyle(state.selectedCategories.includes("ROLE") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cat_CHANNEL")
      .setLabel(`CHANNEL`)
      .setStyle(state.selectedCategories.includes("CHANNEL") ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("logging_next_step").setLabel("Continue →").setStyle(ButtonStyle.Success)
  );

  await interaction.update({
    embeds: [],
    components: [categoryButtons, categoryButtons2],
  });
}

async function handleTestModeEnable(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const state = wizardStates.get(`${interaction.guild.id}-${interaction.user.id}`);
  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  if (state.testMode) {
    await interaction.reply({ content: "❌ Test mode is already enabled.", flags: 64 });
    return;
  }

  state.testMode = true;
  wizardStates.set(`${interaction.guild.id}-${interaction.user.id}`, state);

  await interaction.update({
    content: "⏳ Enabling test mode...",
    embeds: [],
    components: [],
  });

  await interaction.followUp({
    content: "✅ Test mode enabled! You can now send test logs to the channel you selected.",
    flags: 64,
  });
}

async function handleTestModeDisable(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const state = wizardStates.get(`${interaction.guild.id}-${interaction.user.id}`);
  if (!state) {
    await interaction.reply({ content: "❌ Wizard state not found. Please start the wizard again.", flags: 64 });
    return;
  }

  if (!state.testMode) {
    await interaction.reply({ content: "❌ Test mode is already disabled.", flags: 64 });
    return;
  }

  state.testMode = false;
  wizardStates.set(`${interaction.guild.id}-${interaction.user.id}`, state);

  await interaction.update({
    content: "⏳ Disabling test mode...",
    embeds: [],
    components: [],
  });

  await interaction.followUp({
    content: "✅ Test mode disabled. Your server's logs will now be sent to the channels you configured.",
    flags: 64,
  });
}

/**
 * Safely reply to an interaction, handling already-acknowledged cases
 */
async function safeReply(
  interaction: ButtonInteraction | ChannelSelectMenuInteraction,
  options: { content: string; flags?: number }
): Promise<void> {
  try {
    const replyOptions = {
      content: options.content,
      flags: options.flags,
    };

    // Check if interaction is still valid and hasn't been replied to
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable:", (interaction as any).customId);
      return;
    }

    // Check if interaction has already been acknowledged
    if (interaction.replied || interaction.deferred) {
      logger.warn("Interaction already acknowledged, using followUp:", (interaction as any).customId);
      await interaction.followUp(replyOptions);
      return;
    }

    // Safe to reply
    await interaction.reply(replyOptions);
  } catch (error) {
    logger.error("Failed to send interaction response:", error);
    // Don't throw - we don't want to crash the bot for UI errors
  }
}

/**
 * Handle button interactions for logging configuration
 */
export async function handleLoggingButtonInteraction(
  interaction: ButtonInteraction | ChannelSelectMenuInteraction
): Promise<void> {
  const client = interaction.client as Client;

  try {
    // Check if interaction is still valid
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable:", (interaction as any).customId);
      return;
    }

    // Handle channel select menu interactions
    if (interaction.isChannelSelectMenu() && (interaction as any).customId.startsWith("logging_channel_select_")) {
      await handleChannelSelection(interaction, client);
      return;
    }

    if (!interaction.isButton()) return;

    // Handle preset selection buttons
    if ((interaction as any).customId.startsWith("preset_")) {
      await handlePresetSelection(interaction, client);
      return;
    }

    // Handle wizard navigation buttons
    if ((interaction as any).customId === "logging_wizard_back") {
      await showMainMenu(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_wizard_presets") {
      await showPresetSelection(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_wizard_custom") {
      await startCustomSetup(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_wizard_help") {
      await showLoggingHelp(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_quick_setup") {
      await performQuickSetup(interaction, client);
      return;
    }

    // Handle category selection
    if ((interaction as any).customId === "logging_step1_categories") {
      await showCategorySelection(interaction, client);
      return;
    }

    // Handle category toggle buttons (cat_*)
    if ((interaction as any).customId.startsWith("cat_")) {
      await handleCategoryToggle(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_next_step") {
      await handleNextStep(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_test_mode") {
      await showTestModeOptions(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_apply_config") {
      await applyConfiguration(interaction, client);
      return;
    }

    // Handle channel configuration buttons
    if ((interaction as any).customId.startsWith("channel_config_")) {
      await handleChannelConfiguration(interaction, client);
      return;
    }

    // Handle test mode buttons
    if ((interaction as any).customId === "logging_test_mode_enable") {
      await handleTestModeEnable(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_test_mode_disable") {
      await handleTestModeDisable(interaction, client);
      return;
    }

    // Handle status management buttons
    if ((interaction as any).customId === "logging_manage_channels") {
      await safeReply(interaction, {
        content: "📍 To configure channels, please use the channel configuration step in the wizard.",
        flags: 64,
      });
      return;
    }

    if ((interaction as any).customId === "logging_manage_categories") {
      await showCategoryToggle(interaction, client);
      return;
    }

    if ((interaction as any).customId === "logging_advanced_settings") {
      await safeReply(interaction, {
        content: "⚙️ Advanced options will be available in future updates.",
        flags: 64,
      });
      return;
    }

    // Default fallback
    await safeReply(interaction, {
      content: "❌ This button interaction is not implemented yet.",
      flags: 64,
    });
  } catch (error) {
    logger.error("Error handling logging button interaction:", error);
    try {
      await safeReply(interaction, {
        content: "❌ An error occurred while processing your request.",
        flags: 64,
      });
    } catch (replyError) {
      logger.error("Failed to send error message to user:", replyError);
    }
  }
}

/**
 * Handle channel selection for logging configuration
 */
async function handleChannelSelection(interaction: ChannelSelectMenuInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  // Check if interaction is still valid
  if (!interaction.isRepliable()) {
    logger.warn("Channel selection interaction is no longer repliable:", (interaction as any).customId);
    return;
  }

  const category = (interaction as any).customId.replace("logging_channel_select_", "");

  // Add debugging information
  logger.info(`Channel selection for category: "${category}" from customId: "${(interaction as any).customId}"`);

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
      content: `❌ Invalid log category "${category}". Please use the channel configuration step to configure channels properly.`,
      flags: 64,
    });
    return;
  }

  const selectedChannel = interaction.channels.first();

  if (!selectedChannel) {
    await interaction.reply({ content: "❌ No channel selected.", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

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
      .setColor(WIZARD_COLORS.SUCCESS)
      .setTitle("✅ Log Channel Configured!")
      .setDescription(`**${category}** logs will now be sent to <#${selectedChannel.id}>`)
      .addFields(
        {
          name: "📋 Log Types Included",
          value:
            categoryTypes
              .slice(0, 8)
              .map((type: string) => `• ${type.replace(/_/g, " ").toLowerCase()}`)
              .join("\n") + (categoryTypes.length > 8 ? `\n• ...and ${String(categoryTypes.length - 8)} more` : ""),
          inline: false,
        },
        {
          name: "🔄 Next Steps",
          value:
            "• Configure more categories with the channel configuration step\n" +
            "• Check your settings with the status check\n" +
            "• Enable/disable specific categories as needed",
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
    try {
      await interaction.editReply({
        content: "❌ Failed to configure log channel. Please try again.",
      });
    } catch (replyError) {
      logger.error("Failed to send error message to user:", replyError);
    }
  }
}

async function handleAllChannelSelection(interaction: ChannelSelectMenuInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
    return;
  }

  const selectedChannel = interaction.channels.first();

  if (!selectedChannel) {
    await interaction.reply({ content: "❌ No channel selected.", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

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
      .setColor(WIZARD_COLORS.SUCCESS)
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
            (Object.keys(LOG_CATEGORIES).length > 8
              ? `\n• ...and ${String(Object.keys(LOG_CATEGORIES).length - 8)} more`
              : ""),
          inline: false,
        },
        {
          name: "📊 Total Log Types",
          value: `**${String(ALL_LOG_TYPES.length)}** different log types will be sent to this channel`,
          inline: false,
        },
        {
          name: "🔄 Next Steps",
          value:
            "• Monitor the channel volume and adjust as needed\n" +
            "• Use the category toggle step to disable specific categories if too busy\n" +
            "• Consider setting up separate channels later with the channel configuration step",
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
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
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
      content: `❌ Invalid log category "${category}". Please use the channel configuration step to configure channels properly.`,
      flags: 64,
    });
    return;
  }

  const categoryTypes = LOG_CATEGORIES[category as keyof typeof LOG_CATEGORIES];

  // Additional safety check
  if (!Array.isArray(categoryTypes)) {
    logger.error(`Category "${category}" does not contain an array of log types:`, categoryTypes);
    await interaction.reply({
      content: `❌ Invalid configuration for category "${category}". Please contact an administrator.`,
      flags: 64,
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
        (categoryTypes.length > 5 ? `\n• ...and ${String(categoryTypes.length - 5)} more` : "")
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
    flags: 64,
  });
}

async function handleAllCategoryConfiguration(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "❌ This command can only be used in a server.", flags: 64 });
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
        `• Message logs (${String(LOG_CATEGORIES.MESSAGE.length)} types)\n` +
        `• Member logs (${String(LOG_CATEGORIES.MEMBER.length)} types)\n` +
        `• Moderation logs (${String(LOG_CATEGORIES.MODERATION.length)} types)\n` +
        `• Server logs (${String(LOG_CATEGORIES.SERVER.length)} types)\n` +
        `• Voice logs (${String(LOG_CATEGORIES.VOICE.length)} types)\n` +
        `• And ${String(Object.keys(LOG_CATEGORIES).length - 5)} more categories`
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
    flags: 64,
  });
}

async function showCategoryToggle(interaction: ButtonInteraction, client: Client): Promise<void> {
  const toggleEmbed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🔄 Toggle Log Categories")
    .setDescription(
      "Use the category selection step to enable or disable specific log categories.\n\n" +
        "**Available categories:**\n" +
        Object.keys(LOG_CATEGORIES)
          .map((cat) => `• \`${cat}\``)
          .join("\n")
    )
    .addFields({
      name: "📝 How to Use",
      value:
        "• Go back to the category selection step\n" +
        "• Click on categories to toggle them on/off\n" +
        "• Use the continue button to proceed to the next step",
      inline: false,
    });

  await interaction.reply({ embeds: [toggleEmbed], flags: 64 });
}
