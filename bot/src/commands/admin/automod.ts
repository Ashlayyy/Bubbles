import { EmbedBuilder, PermissionsBitField, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

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
    .setDefaultMemberPermissions(0)
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

// Placeholder functions for unimplemented subcommands
async function handleConfigure(client: any, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "🚧 Rule configuration coming soon! Use `/automod toggle` to enable/disable rules for now.",
    ephemeral: true,
  });
}

async function handleDelete(client: any, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "🚧 Rule deletion coming soon!",
    ephemeral: true,
  });
}

async function handleTest(client: any, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "🚧 Rule testing coming soon!",
    ephemeral: true,
  });
}

async function handleStats(client: any, interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "🚧 Statistics coming soon!",
    ephemeral: true,
  });
}
