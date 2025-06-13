import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

interface AutoModPreset {
  name: string;
  description: string;
  emoji: string;
  rules: {
    name: string;
    type: string;
    sensitivity: string;
    actions: string;
    config: Record<string, any>;
  }[];
}

const AUTOMOD_PRESETS: AutoModPreset[] = [
  {
    name: "Basic Protection",
    description: "Essential spam and caps protection for small-medium servers",
    emoji: "🛡️",
    rules: [
      {
        name: "Anti-Spam Basic",
        type: "spam",
        sensitivity: "MEDIUM",
        actions: "DELETE",
        config: { maxMessages: 5, timeWindow: 10, duplicateThreshold: 3 },
      },
      {
        name: "Caps Control",
        type: "caps",
        sensitivity: "MEDIUM",
        actions: "DELETE",
        config: { capsPercent: 70, minLength: 10 },
      },
      {
        name: "Link Filter",
        type: "links",
        sensitivity: "LOW",
        actions: "DELETE",
        config: { requireTLD: true, blockedDomains: ["discord.gg"] },
      },
    ],
  },
  {
    name: "Comprehensive Shield",
    description: "Advanced protection for larger servers with active communities",
    emoji: "🔰",
    rules: [
      {
        name: "Anti-Spam Advanced",
        type: "spam",
        sensitivity: "HIGH",
        actions: "TIMEOUT",
        config: { maxMessages: 4, timeWindow: 8, duplicateThreshold: 2 },
      },
      {
        name: "Strict Caps Control",
        type: "caps",
        sensitivity: "HIGH",
        actions: "WARN",
        config: { capsPercent: 60, minLength: 8 },
      },
      {
        name: "Invite Protection",
        type: "invites",
        sensitivity: "HIGH",
        actions: "DELETE",
        config: { allowOwnServer: true, allowPartners: [] },
      },
      {
        name: "Word Filter",
        type: "words",
        sensitivity: "MEDIUM",
        actions: "DELETE",
        config: { blockedWords: ["spam", "scam"], wildcards: true, ignoreCase: true },
      },
      {
        name: "Mention Spam Protection",
        type: "mentions",
        sensitivity: "MEDIUM",
        actions: "TIMEOUT",
        config: { maxMentions: 5, maxRoleMentions: 2, maxEveryoneMentions: 0 },
      },
    ],
  },
  {
    name: "Family Friendly",
    description: "Strong content filtering for family-oriented communities",
    emoji: "👨‍👩‍👧‍👦",
    rules: [
      {
        name: "Content Filter",
        type: "words",
        sensitivity: "HIGH",
        actions: "DELETE",
        config: { blockedWords: ["toxic", "hate", "inappropriate"], wildcards: true, ignoreCase: true },
      },
      {
        name: "Strict Link Control",
        type: "links",
        sensitivity: "HIGH",
        actions: "DELETE",
        config: { requireTLD: true, allowedDomains: ["youtube.com", "wikipedia.org"] },
      },
      {
        name: "No External Invites",
        type: "invites",
        sensitivity: "HIGH",
        actions: "DELETE",
        config: { allowOwnServer: true, allowPartners: [] },
      },
    ],
  },
  {
    name: "Gaming Community",
    description: "Optimized for gaming servers with competitive environments",
    emoji: "🎮",
    rules: [
      {
        name: "Gaming Spam Control",
        type: "spam",
        sensitivity: "MEDIUM",
        actions: "DELETE",
        config: { maxMessages: 6, timeWindow: 12, duplicateThreshold: 4 },
      },
      {
        name: "Relaxed Caps",
        type: "caps",
        sensitivity: "LOW",
        actions: "DELETE",
        config: { capsPercent: 80, minLength: 15 },
      },
      {
        name: "Gaming Links Allowed",
        type: "links",
        sensitivity: "LOW",
        actions: "DELETE",
        config: {
          requireTLD: true,
          allowedDomains: ["twitch.tv", "youtube.com", "steam.com", "discord.gg"],
          blockedDomains: ["malicious-site.com"],
        },
      },
    ],
  },
];

export default new Command(
  new SlashCommandBuilder()
    .setName("automod-setup")
    .setDescription("🧙‍♂️ Setup auto-moderation with guided wizard")
    .setDefaultMemberPermissions(0)
    .addSubcommand((sub) => sub.setName("wizard").setDescription("Launch the interactive setup wizard"))
    .addSubcommand((sub) =>
      sub
        .setName("preset")
        .setDescription("Apply a preset configuration")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Preset type")
            .setRequired(true)
            .addChoices(
              { name: "🛡️ Basic Protection", value: "basic" },
              { name: "🔰 Comprehensive Shield", value: "comprehensive" },
              { name: "👨‍👩‍👧‍👦 Family Friendly", value: "family" },
              { name: "🎮 Gaming Community", value: "gaming" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("View current auto-moderation status")),

  async (client, interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "wizard":
        await startSetupWizard(client, interaction);
        break;
      case "preset":
        await applyPreset(client, interaction);
        break;
      case "status":
        await showStatus(client, interaction);
        break;
    }
  },
  {
    permissions: {
      level: PermissionLevel.ADMIN,
      isConfigurable: true,
    },
  }
);

async function startSetupWizard(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🧙‍♂️ AutoMod Setup Wizard")
    .setDescription(
      "Welcome to the **Auto-Moderation Setup Wizard!**\n\n" +
        "This wizard will help you configure comprehensive auto-moderation for your server. " +
        "We'll guide you through each step with clear explanations.\n\n" +
        "**What we'll set up:**\n" +
        "🔹 **Spam Protection** - Prevent message flooding\n" +
        "🔹 **Content Filtering** - Block inappropriate words\n" +
        "🔹 **Link Control** - Manage external links\n" +
        "🔹 **Caps Control** - Reduce excessive CAPS\n" +
        "🔹 **Invite Protection** - Control Discord invites\n\n" +
        "**Estimated time:** 3-5 minutes"
    )
    .addFields(
      {
        name: "📋 What You'll Choose",
        value:
          "• Protection level (Light/Moderate/Strict)\n" +
          "• Which channels to protect\n" +
          "• Actions to take (Delete/Warn/Timeout)\n" +
          "• Custom word filters\n" +
          "• Allowed/blocked domains",
        inline: true,
      },
      {
        name: "🎯 Quick Start Options",
        value:
          "• **Preset Templates** - Pre-configured setups\n" +
          "• **Custom Configuration** - Build your own\n" +
          "• **Import Settings** - Copy from another server",
        inline: true,
      }
    )
    .setFooter({ text: "Choose how you'd like to proceed below" })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("automod_wizard_presets")
      .setLabel("📦 Use Presets")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📦"),
    new ButtonBuilder()
      .setCustomId("automod_wizard_custom")
      .setLabel("⚙️ Custom Setup")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⚙️"),
    new ButtonBuilder()
      .setCustomId("automod_wizard_help")
      .setLabel("❓ Help & Info")
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
    time: 300000, // 5 minutes
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector?.on("collect", (buttonInteraction: ButtonInteraction) => {
    void (async () => {
      try {
        switch (buttonInteraction.customId) {
          case "automod_wizard_presets":
            await showPresetSelection(buttonInteraction);
            break;
          case "automod_wizard_custom":
            await startCustomSetup(buttonInteraction);
            break;
          case "automod_wizard_help":
            await showHelpInfo(buttonInteraction);
            break;
          case "automod_wizard_back":
            await startSetupWizard(client, interaction);
            break;
          default:
            if (buttonInteraction.customId.startsWith("preset_")) {
              await handlePresetSelection(buttonInteraction, client);
            }
            break;
        }
      } catch (error) {
        logger.error("Error handling automod wizard interaction:", error);
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
    // Disable buttons after timeout
    const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...buttons.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
    );

    void interaction.editReply({ components: [disabledButtons] }).catch(() => {
      // Ignore errors if message was deleted
    });
  });
}

async function showPresetSelection(interaction: ButtonInteraction): Promise<void> {
  const presetEmbed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("📦 AutoMod Presets")
    .setDescription(
      "Choose a preset configuration that matches your server type. " +
        "These are carefully crafted templates that work well for most communities.\n\n" +
        "**You can always customize these settings later!**"
    );

  AUTOMOD_PRESETS.forEach((preset) => {
    presetEmbed.addFields({
      name: `${preset.emoji} ${preset.name}`,
      value: `${preset.description}\n\n**Includes:** ${preset.rules.length} protection rules`,
      inline: false,
    });
  });

  const presetButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("preset_basic").setLabel("🛡️ Basic").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("preset_comprehensive").setLabel("🔰 Comprehensive").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("preset_family").setLabel("👨‍👩‍👧‍👦 Family").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("preset_gaming").setLabel("🎮 Gaming").setStyle(ButtonStyle.Success)
  );

  const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("automod_wizard_back")
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
    .setTitle("⚙️ Custom AutoMod Setup")
    .setDescription(
      "Let's build a custom auto-moderation configuration for your server!\n\n" +
        "We'll go through each protection type step by step. You can enable or disable " +
        "any feature and customize the settings to match your community's needs."
    )
    .addFields(
      {
        name: "🔄 Setup Process",
        value:
          "1️⃣ **Choose Protection Types** - Select what to enable\n" +
          "2️⃣ **Configure Sensitivity** - Set how strict each rule is\n" +
          "3️⃣ **Set Actions** - Choose punishments (warn/delete/timeout)\n" +
          "4️⃣ **Customize Settings** - Fine-tune specific parameters\n" +
          "5️⃣ **Test & Deploy** - Preview and activate",
        inline: false,
      },
      {
        name: "💡 Recommendations",
        value:
          "• Start with **Medium** sensitivity and adjust\n" +
          "• Use **Delete** for most violations initially\n" +
          "• Add **Timeout** for repeat offenders\n" +
          "• Test rules in a dedicated channel first",
        inline: false,
      }
    );

  const setupButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("custom_step1_protection")
      .setLabel("1️⃣ Choose Protections")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("custom_quick_basic")
      .setLabel("⚡ Quick Basic Setup")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("automod_wizard_back").setLabel("← Back").setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [customEmbed],
    components: [setupButtons],
  });
}

async function showHelpInfo(interaction: ButtonInteraction): Promise<void> {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("❓ AutoMod Help & Information")
    .setDescription("Here's everything you need to know about auto-moderation and how it protects your server.")
    .addFields(
      {
        name: "🛡️ What is Auto-Moderation?",
        value:
          "Auto-moderation automatically detects and responds to rule violations without " +
          "human intervention. It helps maintain a healthy community by:\n" +
          "• Removing spam and inappropriate content\n" +
          "• Warning users about violations\n" +
          "• Taking action against repeat offenders\n" +
          "• Logging all activities for review",
        inline: false,
      },
      {
        name: "📊 Protection Types Explained",
        value:
          "**🔹 Spam Protection:** Prevents message flooding and duplicate content\n" +
          "**🔹 Word Filter:** Blocks inappropriate or custom-defined words\n" +
          "**🔹 Link Control:** Manages external links and domains\n" +
          "**🔹 Caps Control:** Reduces excessive CAPITAL LETTER usage\n" +
          "**🔹 Invite Protection:** Controls Discord server invites\n" +
          "**🔹 Mention Spam:** Prevents excessive @mentions",
        inline: false,
      },
      {
        name: "⚖️ Action Types",
        value:
          "**🗑️ Delete:** Remove the violating message\n" +
          "**⚠️ Warn:** Send a warning to the user\n" +
          "**⏱️ Timeout:** Temporarily restrict the user\n" +
          "**👢 Kick:** Remove user from server\n" +
          "**🔨 Ban:** Permanently ban the user",
        inline: false,
      },
      {
        name: "🎯 Sensitivity Levels",
        value:
          "**🟢 Low:** Relaxed - catches obvious violations\n" +
          "**🟡 Medium:** Balanced - good for most servers\n" +
          "**🔴 High:** Strict - very sensitive detection",
        inline: false,
      }
    )
    .setFooter({ text: "Need more help? Contact your server administrators" });

  const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("automod_wizard_back")
      .setLabel("← Back to Main Menu")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [helpEmbed],
    components: [backButton],
  });
}

async function handlePresetSelection(interaction: ButtonInteraction, client: Client): Promise<void> {
  const presetType = interaction.customId.replace("preset_", "");
  const preset = AUTOMOD_PRESETS.find((p) => p.name.toLowerCase().includes(presetType));

  if (!preset || !interaction.guild) {
    await interaction.reply({
      content: "❌ Preset not found or guild unavailable.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Apply preset rules
    let createdRules = 0;
    for (const rule of preset.rules) {
      try {
        await prisma.autoModRule.create({
          data: {
            guildId: interaction.guild.id,
            name: rule.name,
            type: rule.type,
            sensitivity: rule.sensitivity,
            triggers: rule.config,
            actions: [rule.actions],
            enabled: true,
            createdBy: interaction.user.id,
          },
        });
        createdRules++;
      } catch (error) {
        logger.warn(`Failed to create auto-mod rule ${rule.name}:`, error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ ${preset.emoji} ${preset.name} Applied`)
      .setDescription(
        `Successfully applied the **${preset.name}** preset configuration!\n\n` +
          `**Rules Created:** ${createdRules}/${preset.rules.length}\n` +
          `**Status:** Active and monitoring\n\n` +
          preset.description
      )
      .addFields({
        name: "📋 Applied Rules",
        value: preset.rules.map((rule, index) => `${index + 1}. **${rule.name}** (${rule.type})`).join("\n"),
        inline: false,
      })
      .addFields({
        name: "⚙️ Next Steps",
        value:
          "• Use `/automod list` to view all rules\n" +
          "• Use `/automod configure` to customize settings\n" +
          "• Use `/automod test` to test rules with sample text\n" +
          "• Monitor `/automod stats` for effectiveness",
        inline: false,
      })
      .setTimestamp()
      .setFooter({ text: "AutoMod is now protecting your server!" });

    await interaction.editReply({ embeds: [successEmbed] });

    // Log the configuration change
    await client.logManager.log(interaction.guild.id, "AUTOMOD_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        action: "preset_applied",
        presetName: preset.name,
        rulesCreated: createdRules,
      },
    });
  } catch (error) {
    logger.error("Error applying AutoMod preset:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Failed to Apply Preset")
          .setDescription("An error occurred while applying the preset configuration. Please try again.")
          .setTimestamp(),
      ],
    });
  }
}

async function applyPreset(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const presetType = interaction.options.getString("type", true);
  const preset = AUTOMOD_PRESETS.find((p) => p.name.toLowerCase().includes(presetType));

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Guild Not Found")
          .setDescription("The command must be used in a server.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  if (!preset) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Preset Not Found")
          .setDescription("The specified preset configuration was not found.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Apply preset rules
    let createdRules = 0;
    for (const rule of preset.rules) {
      try {
        await prisma.autoModRule.create({
          data: {
            guildId: interaction.guild.id,
            name: rule.name,
            type: rule.type,
            sensitivity: rule.sensitivity,
            triggers: rule.config,
            actions: [rule.actions],
            enabled: true,
            createdBy: interaction.user.id,
          },
        });
        createdRules++;
      } catch (error) {
        logger.warn(`Failed to create auto-mod rule ${rule.name}:`, error);
      }
    }

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`✅ ${preset.emoji} ${preset.name} Applied`)
      .setDescription(
        `Successfully applied the **${preset.name}** preset configuration!\n\n` +
          `**Rules Created:** ${createdRules}/${preset.rules.length}\n` +
          `**Status:** Active and monitoring\n\n` +
          preset.description
      )
      .addFields({
        name: "📋 Applied Rules",
        value: preset.rules.map((rule, index) => `${index + 1}. **${rule.name}** (${rule.type})`).join("\n"),
        inline: false,
      })
      .addFields({
        name: "⚙️ Next Steps",
        value:
          "• Use `/automod list` to view all rules\n" +
          "• Use `/automod configure` to customize settings\n" +
          "• Use `/automod test` to test rules with sample text\n" +
          "• Monitor `/automod stats` for effectiveness",
        inline: false,
      })
      .setTimestamp()
      .setFooter({ text: "AutoMod is now protecting your server!" });

    await interaction.editReply({ embeds: [successEmbed] });

    // Log the configuration change
    await client.logManager.log(interaction.guild.id, "AUTOMOD_CONFIG_CHANGE", {
      userId: interaction.user.id,
      metadata: {
        action: "preset_applied",
        presetName: preset.name,
        rulesCreated: createdRules,
      },
    });
  } catch (error) {
    logger.error("Error applying AutoMod preset:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Failed to Apply Preset")
          .setDescription("An error occurred while applying the preset configuration. Please try again.")
          .setTimestamp(),
      ],
    });
  }
}

async function showStatus(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Guild Not Found")
          .setDescription("The command must be used in a server.")
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  try {
    const rules = await prisma.autoModRule.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { createdAt: "desc" },
    });

    const enabledRules = rules.filter((rule) => rule.enabled);
    const disabledRules = rules.filter((rule) => !rule.enabled);

    // Get recent activity (last 24 hours) - simplified for now
    const recentActivity = 0; // TODO: Implement when AutoModAction table is available

    const statusEmbed = new EmbedBuilder()
      .setColor(enabledRules.length > 0 ? 0x2ecc71 : 0x95a5a6)
      .setTitle("📊 AutoMod Status")
      .setDescription(
        enabledRules.length > 0
          ? "🟢 **Auto-moderation is active** and protecting your server"
          : "⚪ **Auto-moderation is inactive** - no rules are currently enabled"
      )
      .addFields(
        {
          name: "📈 Overview",
          value:
            `**Total Rules:** ${rules.length}\n` +
            `**Active Rules:** ${enabledRules.length}\n` +
            `**Disabled Rules:** ${disabledRules.length}\n` +
            `**24h Actions:** ${recentActivity}`,
          inline: true,
        },
        {
          name: "🎯 Coverage",
          value:
            enabledRules.length > 0
              ? enabledRules
                  .map((rule) => `• **${rule.type}** (${rule.sensitivity.toLowerCase()})`)
                  .slice(0, 6)
                  .join("\n") + (enabledRules.length > 6 ? `\n... and ${enabledRules.length - 6} more` : "")
              : "No protection currently active",
          inline: true,
        }
      )
      .setTimestamp();

    if (enabledRules.length === 0) {
      statusEmbed.addFields({
        name: "🚀 Get Started",
        value:
          "Use `/automod-setup wizard` to configure auto-moderation for your server!\n\n" +
          "**Quick options:**\n" +
          "• `/automod-setup preset` - Apply ready-made configurations\n" +
          "• `/automod create` - Create individual rules\n" +
          "• `/automod-setup wizard` - Interactive setup guide",
        inline: false,
      });
    } else {
      statusEmbed.addFields({
        name: "⚙️ Management",
        value:
          "• `/automod list` - View all rules\n" +
          "• `/automod configure <rule>` - Modify settings\n" +
          "• `/automod stats` - View detailed statistics\n" +
          "• `/automod test <rule>` - Test with sample text",
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [statusEmbed] });
  } catch (error) {
    logger.error("Error fetching AutoMod status:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Error")
          .setDescription("Failed to fetch auto-moderation status. Please try again.")
          .setTimestamp(),
      ],
    });
  }
}
