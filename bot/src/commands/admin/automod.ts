import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { prisma } from "../../database/index.js";
import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import Command from "../../structures/Command.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";

interface AutoModTriggerConfig {
  // Spam detection
  maxMessages?: number;
  timeWindow?: number; // seconds
  duplicateThreshold?: number;

  // Caps detection
  capsPercent?: number;
  minLength?: number;

  // Link detection
  allowedDomains?: string[];
  blockedDomains?: string[];
  requireTLD?: boolean;

  // Word filter
  blockedWords?: string[];
  wildcards?: boolean;
  ignoreCase?: boolean;

  // Invite detection
  allowOwnServer?: boolean;
  allowPartners?: string[]; // Partner server IDs

  // Mention spam
  maxMentions?: number;
  maxRoleMentions?: number;
  maxEveryoneMentions?: number;

  // Emoji spam
  maxEmojis?: number;
  maxCustomEmojis?: number;

  // Other patterns
  patterns?: string[]; // Custom regex patterns
}

interface AutoModActionConfig {
  // Primary actions
  delete?: boolean;
  warn?: boolean;
  timeout?: number; // Duration in seconds
  kick?: boolean;
  ban?: number; // Duration in seconds, 0 = permanent

  // Additional actions
  logToChannel?: string;
  notifyStaff?: boolean;
  addRole?: string; // Mute role ID
  removeRole?: string;

  // Message actions
  sendDM?: boolean;
  customMessage?: string;
  replyInChannel?: boolean;
}

interface EscalationConfig {
  enableEscalation?: boolean;
  maxWarnings?: number;
  escalationActions?: AutoModActionConfig[];
}

export default new Command(
  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("ADMIN ONLY: Configure auto-moderation for your server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new auto-moderation rule")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Name for this rule").setRequired(true).setMaxLength(50)
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Type of auto-moderation")
            .setRequired(true)
            .addChoices(
              { name: "Spam Detection", value: "spam" },
              { name: "Caps Lock", value: "caps" },
              { name: "Link Filtering", value: "links" },
              { name: "Word Filter", value: "words" },
              { name: "Invite Filtering", value: "invites" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("sensitivity")
            .setDescription("Detection sensitivity")
            .setRequired(true)
            .addChoices(
              { name: "Low", value: "LOW" },
              { name: "Medium", value: "MEDIUM" },
              { name: "High", value: "HIGH" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action to take when triggered")
            .setRequired(true)
            .addChoices(
              { name: "Delete Message", value: "DELETE" },
              { name: "Warn User", value: "WARN" },
              { name: "Timeout User", value: "TIMEOUT" },
              { name: "Kick User", value: "KICK" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("custom_words").setDescription("Custom words/phrases to filter (comma-separated)")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all auto-moderation rules")
        .addBooleanOption((opt) => opt.setName("detailed").setDescription("Show detailed rule configuration"))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("configure")
        .setDescription("Configure an existing rule")
        .addStringOption((opt) =>
          opt.setName("rule").setDescription("Rule to configure").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("toggle")
        .setDescription("Enable or disable a rule")
        .addStringOption((opt) =>
          opt.setName("rule").setDescription("Rule to toggle").setRequired(true).setAutocomplete(true)
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable or disable the rule").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete an auto-moderation rule")
        .addStringOption((opt) =>
          opt.setName("rule").setDescription("Rule to delete").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setDescription("Test a rule against sample text")
        .addStringOption((opt) =>
          opt.setName("rule").setDescription("Rule to test").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("text").setDescription("Sample text to test").setRequired(true).setMaxLength(500)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stats")
        .setDescription("View auto-moderation statistics")
        .addStringOption((opt) => opt.setName("rule").setDescription("Specific rule statistics").setAutocomplete(true))
        .addStringOption((opt) =>
          opt
            .setName("timeframe")
            .setDescription("Time period for statistics")
            .addChoices(
              { name: "Last 24 hours", value: "24h" },
              { name: "Last 7 days", value: "7d" },
              { name: "Last 30 days", value: "30d" }
            )
        )
    ),

  async (client, interaction) => {
    // Type guard to ensure this is a chat input command
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "create":
        await handleCreate(client, interaction);
        break;
      case "list":
        await handleList(client, interaction);
        break;
      case "configure":
        await handleConfigure(client, interaction);
        break;
      case "toggle":
        await handleToggle(client, interaction);
        break;
      case "delete":
        await handleDelete(client, interaction);
        break;
      case "test":
        await handleTest(client, interaction);
        break;
      case "stats":
        await handleStats(client, interaction);
        break;
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

async function handleCreate(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const name = interaction.options.getString("name", true);
  const type = interaction.options.getString("type", true);
  const sensitivity = interaction.options.getString("sensitivity", true);
  const action = interaction.options.getString("action", true);
  const customWords = interaction.options.getString("custom_words");

  try {
    // Create auto-mod rule in database
    const rule = await prisma.autoModRule.create({
      data: {
        guildId: interaction.guild.id,
        name,
        type,
        enabled: true,
        sensitivity,
        actions: action,
        createdBy: interaction.user.id,
        triggers: {},
        escalation: {},
      },
    });

    // Notify API of automod rule creation
    if ((client as any).queueService) {
      try {
        await (client as any).queueService.processRequest({
          type: "AUTOMOD_UPDATE",
          data: {
            guildId: interaction.guild.id,
            ruleId: rule.id,
            action: "CREATE_RULE",
            ruleData: {
              name,
              type,
              sensitivity,
              actions: action,
              enabled: true,
            },
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of automod rule creation:", error);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Auto-Moderation Rule Created")
      .addFields(
        { name: "🏷️ Name", value: name, inline: true },
        { name: "🔧 Type", value: getTypeDisplayName(type), inline: true },
        { name: "📊 Sensitivity", value: sensitivity, inline: true },
        { name: "⚡ Action", value: getActionDisplayName(action), inline: true },
        { name: "🆔 Rule ID", value: rule.id, inline: true },
        { name: "✅ Status", value: "Enabled", inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Created by ${interaction.user.username}` });

    if (customWords) {
      embed.addFields({
        name: "📝 Custom Words",
        value: customWords.length > 100 ? customWords.substring(0, 97) + "..." : customWords,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Log the creation
    await client.logManager.log(interaction.guild.id, "AUTOMOD_RULE_CREATE", {
      userId: interaction.user.id,
      metadata: {
        ruleId: rule.id,
        ruleName: name,
        ruleType: type,
        sensitivity,
        action,
      },
    });
  } catch (error) {
    logger.error("Error creating auto-mod rule:", error);
    await interaction.reply({
      content: "❌ Failed to create auto-moderation rule. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleList(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const detailed = interaction.options.getBoolean("detailed") ?? false;

  try {
    const rules = await prisma.autoModRule.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { createdAt: "desc" },
    });

    if (rules.length === 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle("📋 Auto-Moderation Rules")
            .setDescription(
              "No auto-moderation rules configured for this server.\n\nUse `/automod create` to create your first rule!"
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📋 Auto-Moderation Rules (${rules.length})`)
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.username}` });

    // Group rules by status
    const enabledRules = rules.filter((rule) => rule.enabled);
    const disabledRules = rules.filter((rule) => !rule.enabled);

    if (enabledRules.length > 0) {
      const enabledList = enabledRules
        .slice(0, 10) // Limit to prevent embed size issues
        .map((rule) => {
          const typeEmoji = getTypeEmoji(rule.type);
          const sensitivityColor = rule.sensitivity === "HIGH" ? "🔴" : rule.sensitivity === "MEDIUM" ? "🟡" : "🟢";
          return `${typeEmoji} **${rule.name}**\n${sensitivityColor} ${getTypeDisplayName(rule.type)} • ${rule.sensitivity} • ${getActionDisplayName((rule.actions as string) || "UNKNOWN")}`;
        })
        .join("\n\n");

      embed.addFields({
        name: `✅ Enabled Rules (${enabledRules.length})`,
        value: enabledList + (enabledRules.length > 10 ? "\n*...and more*" : ""),
        inline: false,
      });
    }

    if (disabledRules.length > 0) {
      const disabledList = disabledRules
        .slice(0, 5) // Show fewer disabled rules
        .map((rule) => {
          const typeEmoji = getTypeEmoji(rule.type);
          return `${typeEmoji} **${rule.name}**\n*${getTypeDisplayName(rule.type)} • Disabled*`;
        })
        .join("\n\n");

      embed.addFields({
        name: `❌ Disabled Rules (${disabledRules.length})`,
        value: disabledList + (disabledRules.length > 5 ? "\n*...and more*" : ""),
        inline: false,
      });
    }

    if (detailed && rules.length <= 5) {
      // Show detailed stats for each rule if there aren't too many
      embed.addFields({
        name: "📊 Usage Statistics",
        value: "Use `/automod stats` for detailed statistics per rule.",
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error listing auto-mod rules:", error);
    await interaction.reply({
      content: "❌ Failed to fetch auto-moderation rules. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleToggle(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ruleId = interaction.options.getString("rule", true);
  const enabled = interaction.options.getBoolean("enabled", true);

  try {
    const rule = await prisma.autoModRule.findFirst({
      where: {
        id: ruleId,
        guildId: interaction.guild.id,
      },
    });

    if (!rule) {
      await interaction.reply({
        content: "❌ Auto-moderation rule not found.",
        ephemeral: true,
      });
      return;
    }

    await prisma.autoModRule.update({
      where: { id: ruleId },
      data: { enabled },
    });

    // Notify API of automod rule toggle
    if ((client as any).queueService) {
      try {
        await (client as any).queueService.processRequest({
          type: "AUTOMOD_UPDATE",
          data: {
            guildId: interaction.guild.id,
            ruleId: ruleId,
            action: "TOGGLE_RULE",
            enabled: enabled,
            ruleName: rule.name,
            updatedBy: interaction.user.id,
          },
          source: "rest",
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          requiresReliability: true,
        });
      } catch (error) {
        console.warn("Failed to notify API of automod rule toggle:", error);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`${enabled ? "✅" : "❌"} Rule ${enabled ? "Enabled" : "Disabled"}`)
      .addFields(
        { name: "🏷️ Rule Name", value: rule.name, inline: true },
        { name: "🔧 Type", value: getTypeDisplayName(rule.type), inline: true },
        { name: "📊 Status", value: enabled ? "Enabled" : "Disabled", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    await client.logManager.log(interaction.guild.id, "AUTOMOD_RULE_TOGGLE", {
      userId: interaction.user.id,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        enabled,
      },
    });
  } catch (error) {
    logger.error("Error toggling auto-mod rule:", error);
    await interaction.reply({
      content: "❌ Failed to toggle auto-moderation rule. Please try again.",
      ephemeral: true,
    });
  }
}

// Helper functions
function getTypeDisplayName(type: string): string {
  const typeNames = {
    spam: "Spam Detection",
    caps: "Caps Lock Filter",
    links: "Link Filter",
    words: "Word Filter",
    invites: "Invite Filter",
  };
  return typeNames[type as keyof typeof typeNames] || type;
}

function getActionDisplayName(action: string): string {
  const actionNames = {
    DELETE: "Delete Message",
    WARN: "Warn User",
    TIMEOUT: "Timeout User",
    KICK: "Kick User",
  };
  return actionNames[action as keyof typeof actionNames] || action;
}

function getTypeEmoji(type: string): string {
  const typeEmojis = {
    spam: "🚫",
    caps: "🔤",
    links: "🔗",
    words: "💬",
    invites: "📨",
  };
  return typeEmojis[type as keyof typeof typeEmojis] || "🔧";
}

// Complete implementation of missing functions
async function handleConfigure(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ruleId = interaction.options.getString("rule", true);

  try {
    const rule = await prisma.autoModRule.findFirst({
      where: {
        id: ruleId,
        guildId: interaction.guild.id,
      },
    });

    if (!rule) {
      await interaction.reply({
        content: "❌ Auto-moderation rule not found.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`⚙️ Configure Rule: ${rule.name}`)
      .setDescription("Use the buttons below to modify this rule's settings.")
      .addFields(
        { name: "🏷️ Rule Name", value: rule.name, inline: true },
        { name: "🔧 Type", value: getTypeDisplayName(rule.type), inline: true },
        { name: "📊 Sensitivity", value: rule.sensitivity, inline: true },
        { name: "⚡ Action", value: getActionDisplayName((rule.actions as string) || "UNKNOWN"), inline: true },
        { name: "✅ Status", value: rule.enabled ? "Enabled" : "Disabled", inline: true },
        { name: "🆔 Rule ID", value: rule.id, inline: true }
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`automod_edit_name_${rule.id}`)
        .setLabel("Edit Name")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`automod_edit_sensitivity_${rule.id}`)
        .setLabel("Change Sensitivity")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`automod_edit_action_${rule.id}`)
        .setLabel("Change Action")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`automod_toggle_${rule.id}`)
        .setLabel(rule.enabled ? "Disable" : "Enable")
        .setStyle(rule.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error configuring auto-mod rule:", error);
    await interaction.reply({
      content: "❌ Failed to configure auto-moderation rule. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleDelete(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ruleId = interaction.options.getString("rule", true);

  try {
    const rule = await prisma.autoModRule.findFirst({
      where: {
        id: ruleId,
        guildId: interaction.guild.id,
      },
    });

    if (!rule) {
      await interaction.reply({
        content: "❌ Auto-moderation rule not found.",
        ephemeral: true,
      });
      return;
    }

    // Create confirmation embed
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("⚠️ Confirm Rule Deletion")
      .setDescription(`Are you sure you want to delete the rule **${rule.name}**?`)
      .addFields(
        { name: "🔧 Type", value: getTypeDisplayName(rule.type), inline: true },
        { name: "📊 Sensitivity", value: rule.sensitivity, inline: true },
        { name: "⚠️ Warning", value: "This action cannot be undone!", inline: false }
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`automod_confirm_delete_${rule.id}`)
        .setLabel("Yes, Delete Rule")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("automod_cancel_delete").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error deleting auto-mod rule:", error);
    await interaction.reply({
      content: "❌ Failed to delete auto-moderation rule. Please try again.",
      ephemeral: true,
    });
  }
}

async function handleTest(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ruleId = interaction.options.getString("rule", true);
  const testText = interaction.options.getString("text", true);

  try {
    const rule = await prisma.autoModRule.findFirst({
      where: {
        id: ruleId,
        guildId: interaction.guild.id,
      },
    });

    if (!rule) {
      await interaction.reply({
        content: "❌ Auto-moderation rule not found.",
        ephemeral: true,
      });
      return;
    }

    // Test the rule against the provided text
    const testResult = testRuleAgainstText(rule, testText);

    const embed = new EmbedBuilder()
      .setColor(testResult.triggered ? 0xe74c3c : 0x2ecc71)
      .setTitle(`🧪 Rule Test: ${rule.name}`)
      .addFields(
        { name: "📝 Test Text", value: `\`\`\`${testText}\`\`\``, inline: false },
        { name: "🔧 Rule Type", value: getTypeDisplayName(rule.type), inline: true },
        { name: "📊 Sensitivity", value: rule.sensitivity, inline: true },
        { name: "🎯 Result", value: testResult.triggered ? "❌ **TRIGGERED**" : "✅ **PASSED**", inline: true }
      )
      .setTimestamp();

    if (testResult.triggered) {
      embed.addFields(
        { name: "⚡ Action", value: getActionDisplayName((rule.actions as string) || "UNKNOWN"), inline: true },
        { name: "📋 Reason", value: testResult.reason ?? "Rule conditions met", inline: false }
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    logger.error("Error testing auto-mod rule:", error);
    await interaction.reply({
      content: "❌ Failed to test auto-moderation rule. Please try again.",
      ephemeral: true,
    });
  }
}

// Interface for rule structure (matching Prisma model)
interface AutoModRuleTest {
  id: string;
  type: string;
  triggers: any; // JsonValue from Prisma
  actions: any; // JsonValue from Prisma
  sensitivity: string;
}

// Helper function to test rules
function testRuleAgainstText(rule: AutoModRuleTest, text: string): { triggered: boolean; reason?: string } {
  const triggers = rule.triggers as AutoModTriggerConfig;

  switch (rule.type) {
    case "spam": {
      // Simple duplicate check for testing
      const words = text.split(" ");
      const duplicates = words.filter((word, index) => words.indexOf(word) !== index);
      if (duplicates.length > (triggers.duplicateThreshold ?? 2)) {
        return { triggered: true, reason: "Duplicate words detected" };
      }
      break;
    }

    case "caps": {
      const capsPercent = ((text.match(/[A-Z]/g) ?? []).length / text.length) * 100;
      const threshold = triggers.capsPercent ?? 70;
      if (text.length >= (triggers.minLength ?? 10) && capsPercent >= threshold) {
        return { triggered: true, reason: `${Math.round(capsPercent)}% caps (threshold: ${threshold}%)` };
      }
      break;
    }

    case "words": {
      const blockedWords = triggers.blockedWords ?? [];
      const foundWord = blockedWords.find((word) =>
        triggers.ignoreCase ? text.toLowerCase().includes(word.toLowerCase()) : text.includes(word)
      );
      if (foundWord) {
        return { triggered: true, reason: `Blocked word detected: "${foundWord}"` };
      }
      break;
    }

    case "links": {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const links = text.match(urlRegex);
      if (links) {
        const blockedDomains = triggers.blockedDomains ?? [];
        for (const link of links) {
          if (blockedDomains.some((domain) => link.includes(domain))) {
            return { triggered: true, reason: "Blocked domain detected" };
          }
        }
      }
      break;
    }

    case "invites": {
      const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/g;
      if (inviteRegex.test(text)) {
        return { triggered: true, reason: "Discord invite detected" };
      }
      break;
    }
  }

  return { triggered: false };
}

async function handleStats(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const ruleId = interaction.options.getString("rule");
  const timeframe = interaction.options.getString("timeframe") ?? "24h";

  try {
    if (ruleId) {
      // Show stats for specific rule
      const rule = await prisma.autoModRule.findFirst({
        where: {
          id: ruleId,
          guildId: interaction.guild.id,
        },
      });

      if (!rule) {
        await interaction.reply({
          content: "❌ Auto-moderation rule not found.",
          ephemeral: true,
        });
        return;
      }

      // Get time range
      const timeRanges = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const since = new Date(Date.now() - timeRanges[timeframe as keyof typeof timeRanges]);

      // For now, show placeholder stats since we don't have moderation action logging yet
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📊 Rule Statistics: ${rule.name}`)
        .addFields(
          { name: "🔧 Rule Type", value: getTypeDisplayName(rule.type), inline: true },
          { name: "📊 Sensitivity", value: rule.sensitivity, inline: true },
          { name: "✅ Status", value: rule.enabled ? "Enabled" : "Disabled", inline: true },
          { name: "⏱️ Timeframe", value: timeframe, inline: true },
          { name: "🎯 Triggers", value: "0", inline: true },
          { name: "⚡ Actions Taken", value: "0", inline: true },
          { name: "📈 Effectiveness", value: "Data collection starting...", inline: false }
        )
        .setDescription(
          "📋 **Note:** Statistics collection will be available once the auto-moderation engine is active."
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      // Show overall stats
      const rules = await prisma.autoModRule.findMany({
        where: { guildId: interaction.guild.id },
      });

      const enabledRules = rules.filter((rule) => rule.enabled);
      const disabledRules = rules.filter((rule) => !rule.enabled);

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📊 Auto-Moderation Statistics")
        .addFields(
          {
            name: "📈 Overview",
            value:
              `**Total Rules:** ${rules.length}\n` +
              `**Active Rules:** ${enabledRules.length}\n` +
              `**Disabled Rules:** ${disabledRules.length}`,
            inline: true,
          },
          { name: "⏱️ Timeframe", value: timeframe, inline: true },
          { name: "🎯 Total Actions", value: "0", inline: true },
          { name: "🔥 Most Active Rule", value: "Data pending", inline: true },
          {
            name: "📋 Rule Types",
            value: rules.length > 0 ? [...new Set(rules.map((r) => getTypeDisplayName(r.type)))].join(", ") : "None",
            inline: false,
          }
        )
        .setDescription(
          "📋 **Note:** Detailed statistics will be available once the auto-moderation engine is processing messages."
        )
        .setTimestamp();

      if (enabledRules.length === 0) {
        embed.addFields({
          name: "⚠️ No Active Rules",
          value: "Enable some rules to start collecting statistics!",
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    logger.error("Error getting auto-mod stats:", error);
    await interaction.reply({
      content: "❌ Failed to get auto-moderation statistics. Please try again.",
      ephemeral: true,
    });
  }
}
