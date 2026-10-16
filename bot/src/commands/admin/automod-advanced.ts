import type { AutoModRule } from "@shared/types";
import { SlashCommandBuilder, type User } from "discord.js";
import { prisma } from "../../database/index.js";
import { AutoModService } from "../../services/autoModService.js";
import { PermissionLevel } from "../../structures/PermissionTypes.js";
import { type CommandResponse } from "../_core/index.js";
import { ModerationCommand } from "../_core/specialized/ModerationCommand.js";

/**
 * Advanced AutoMod Command - Create and manage advanced AutoMod rules
 */
export class AutoModAdvancedCommand extends ModerationCommand {
  constructor() {
    super({
      name: "automod-advanced",
      description: "Create and manage advanced AutoMod rules with pattern detection",
      category: "admin",
      permissions: { level: PermissionLevel.ADMIN, isConfigurable: true },
      cooldown: 5,
    });
  }

  protected async execute(): Promise<CommandResponse> {
    if (!this.isSlashCommand()) {
      return this.createModerationError(
        "use automod-advanced",
        { username: "N/A", id: "unknown" } as User,
        "This command only works as a slash command."
      );
    }

    const subcommand = this.getSubcommand();

    switch (subcommand) {
      case "create":
        return await this.handleCreateRule();
      case "list":
        return await this.handleListRules();
      case "edit":
        return await this.handleEditRule();
      case "delete":
        return await this.handleDeleteRule();
      case "test":
        return await this.handleTestRule();
      case "stats":
        return await this.handleRuleStats();
      default:
        return this.createModerationError(
          "use automod-advanced",
          { username: "N/A", id: "unknown" } as User,
          `Unknown subcommand: ${subcommand}`
        );
    }
  }

  private getSubcommand(): string {
    if (!this.isSlashCommand()) return "";
    const interaction = this.interaction as { options: { getSubcommand(): string } };
    return interaction.options.getSubcommand();
  }

  private async handleCreateRule(): Promise<CommandResponse> {
    const name = this.getStringOption("name", true);
    const _description = this.getStringOption("description");
    const ruleType = this.getStringOption("type", true);
    const sensitivity = this.getStringOption("sensitivity") ?? "MEDIUM";
    const patterns =
      this.getStringOption("patterns")
        ?.split(",")
        .map((p) => p.trim()) ?? [];
    const actions = this.getStringOption("actions")
      ?.split(",")
      .map((a) => a.trim().toUpperCase()) ?? ["DELETE"];
    const exemptRoles =
      this.getStringOption("exempt-roles")
        ?.split(",")
        .map((r) => r.trim()) ?? [];
    const exemptChannels =
      this.getStringOption("exempt-channels")
        ?.split(",")
        .map((c) => c.trim()) ?? [];
    const targetChannels =
      this.getStringOption("target-channels")
        ?.split(",")
        .map((c) => c.trim()) ?? [];

    // Validate inputs
    try {
      this.validatePatterns(ruleType, patterns);
      this.validateActions(actions);
    } catch (error) {
      return this.createModerationError(
        "create automod rule",
        { username: "N/A", id: "unknown" } as User,
        error instanceof Error ? error.message : "Validation failed"
      );
    }

    // Check if rule name already exists
    const existingRule = await prisma.autoModRule.findFirst({
      where: { guildId: this.guild.id, name },
    });

    if (existingRule) {
      return this.createModerationError(
        "create automod rule",
        { username: "N/A", id: "unknown" } as User,
        "A rule with this name already exists."
      );
    }

    try {
      // Create the rule
      const rule = await prisma.autoModRule.create({
        data: {
          guildId: this.guild.id,
          name,
          type: ruleType,
          triggers: {
            patterns: patterns,
            threshold: this.getThresholdForSensitivity(sensitivity),
            timeWindow: this.getTimeWindowForSensitivity(sensitivity),
          },
          actions: {
            primary: actions[0] ?? "DELETE",
            secondary: actions[1] ?? undefined,
            tertiary: actions[2] ?? undefined,
            notifyUser: actions.includes("NOTIFY"),
            logAction: actions.includes("LOG"),
          },
          sensitivity,
          exemptRoles: exemptRoles,
          exemptChannels: exemptChannels,
          targetChannels: targetChannels,
          enabled: true,
          createdBy: this.user.id,
        },
      });

      // Clear cache
      await AutoModService.invalidateRulesCache(this.guild.id);

      const embed = this.client.genEmbed({
        title: "✅ Advanced AutoMod Rule Created",
        description: `Rule **${name}** has been created successfully.`,
        color: 0x2ecc71,
        fields: [
          { name: "📝 Type", value: ruleType.toUpperCase(), inline: true },
          { name: "🎯 Sensitivity", value: sensitivity, inline: true },
          { name: "🔍 Patterns", value: patterns.join(", ") || "None", inline: false },
          { name: "⚡ Actions", value: actions.join(", "), inline: false },
          {
            name: "🛡️ Exempt Roles",
            value: exemptRoles.length > 0 ? exemptRoles.map((r) => `<@&${r}>`).join(", ") : "None",
            inline: false,
          },
          {
            name: "📺 Exempt Channels",
            value: exemptChannels.length > 0 ? exemptChannels.map((c) => `<#${c}>`).join(", ") : "None",
            inline: false,
          },
        ],
        footer: { text: `Rule ID: ${String(rule.id)}` },
      });

      return { embeds: [embed], ephemeral: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createModerationError(
        "create automod rule",
        { username: "N/A", id: "unknown" } as User,
        errorMessage
      );
    }
  }

  private async handleListRules(): Promise<CommandResponse> {
    const rules = await prisma.autoModRule.findMany({
      where: { guildId: this.guild.id },
      orderBy: { createdAt: "desc" },
    });

    if (rules.length === 0) {
      return this.createModerationError(
        "list automod rules",
        { username: "N/A", id: "unknown" } as User,
        "No AutoMod rules found for this server."
      );
    }

    const embed = this.client.genEmbed({
      title: "🛡️ AutoMod Rules",
      description: `Found **${String(rules.length)}** AutoMod rules:`,
      color: 0x3498db,
      fields: rules.map((rule) => ({
        name: `${rule.enabled ? "✅" : "❌"} ${rule.name}`,
        value: `**Type:** ${rule.type.toUpperCase()}\n**Sensitivity:** ${rule.sensitivity}\n**Triggers:** ${String(rule.triggerCount)}\n**Created:** <t:${String(Math.floor(rule.createdAt.getTime() / 1000))}:R>`,
        inline: true,
      })),
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleEditRule(): Promise<CommandResponse> {
    const ruleId = this.getStringOption("rule-id", true);
    const field = this.getStringOption("field", true);
    const value = this.getStringOption("value", true);

    const rule = await prisma.autoModRule.findFirst({
      where: { id: ruleId, guildId: this.guild.id },
    });

    if (!rule) {
      return this.createModerationError(
        "edit automod rule",
        { username: "N/A", id: "unknown" } as User,
        "AutoMod rule not found."
      );
    }

    const updateData: Record<string, unknown> = {};

    switch (field) {
      case "name":
        updateData.name = value;
        break;
      case "sensitivity":
        if (!["LOW", "MEDIUM", "HIGH"].includes(value)) {
          return this.createModerationError(
            "edit automod rule",
            { username: "N/A", id: "unknown" } as User,
            "Invalid sensitivity level. Use: LOW, MEDIUM, HIGH"
          );
        }
        updateData.sensitivity = value;
        break;
      case "enabled":
        updateData.enabled = value.toLowerCase() === "true";
        break;
      default:
        return this.createModerationError(
          "edit automod rule",
          { username: "N/A", id: "unknown" } as User,
          "Invalid field. Use: name, sensitivity, enabled"
        );
    }

    await prisma.autoModRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Clear cache
    await AutoModService.invalidateRulesCache(this.guild.id);

    const embed = this.client.genEmbed({
      title: "✅ AutoMod Rule Updated",
      description: `Rule **${rule.name}** has been updated.`,
      color: 0x2ecc71,
      fields: [
        { name: "📝 Field", value: field, inline: true },
        { name: "🔄 New Value", value: value, inline: true },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleDeleteRule(): Promise<CommandResponse> {
    const ruleId = this.getStringOption("rule-id", true);

    const rule = await prisma.autoModRule.findFirst({
      where: { id: ruleId, guildId: this.guild.id },
    });

    if (!rule) {
      return this.createModerationError(
        "delete automod rule",
        { username: "N/A", id: "unknown" } as User,
        "AutoMod rule not found."
      );
    }

    await prisma.autoModRule.delete({
      where: { id: ruleId },
    });

    // Clear cache
    await AutoModService.invalidateRulesCache(this.guild.id);

    const embed = this.client.genEmbed({
      title: "🗑️ AutoMod Rule Deleted",
      description: `Rule **${rule.name}** has been deleted.`,
      color: 0xe74c3c,
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleTestRule(): Promise<CommandResponse> {
    const ruleId = this.getStringOption("rule-id", true);
    const testText = this.getStringOption("text", true);

    const rule = await prisma.autoModRule.findFirst({
      where: { id: ruleId, guildId: this.guild.id },
    });

    if (!rule) {
      return this.createModerationError(
        "test automod rule",
        { username: "N/A", id: "unknown" } as User,
        "AutoMod rule not found."
      );
    }

    // Convert database rule to AutoModRule type
    const typedRule: AutoModRule = {
      ...rule,
      triggers:
        typeof rule.triggers === "string"
          ? (JSON.parse(rule.triggers) as AutoModRule["triggers"])
          : (rule.triggers as AutoModRule["triggers"]),
      actions:
        typeof rule.actions === "string"
          ? (JSON.parse(rule.actions) as AutoModRule["actions"])
          : (rule.actions as AutoModRule["actions"]),
      escalation: rule.escalation
        ? typeof rule.escalation === "string"
          ? (JSON.parse(rule.escalation) as AutoModRule["escalation"])
          : (rule.escalation as AutoModRule["escalation"])
        : undefined,
      lastTriggered: rule.lastTriggered ?? undefined,
      logChannel: rule.logChannel ?? undefined,
    };

    const result = AutoModService.testRuleAgainstText(typedRule, testText);

    const embed = this.client.genEmbed({
      title: "🧪 AutoMod Rule Test",
      description: `Testing rule **${rule.name}** against sample text.`,
      color: result.triggered ? 0xe74c3c : 0x2ecc71,
      fields: [
        {
          name: "📝 Test Text",
          value: testText.length > 100 ? testText.substring(0, 100) + "..." : testText,
          inline: false,
        },
        { name: "🎯 Result", value: result.triggered ? "❌ **TRIGGERED**" : "✅ **PASSED**", inline: true },
        { name: "📊 Severity", value: result.severity ?? "MEDIUM", inline: true },
        { name: "🔍 Matched Content", value: result.matchedContent ?? "None", inline: false },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private async handleRuleStats(): Promise<CommandResponse> {
    const ruleId = this.getStringOption("rule-id", true);

    const rule = await prisma.autoModRule.findFirst({
      where: { id: ruleId, guildId: this.guild.id },
    });

    if (!rule) {
      return this.createModerationError(
        "rule stats",
        { username: "N/A", id: "unknown" } as User,
        "AutoMod rule not found."
      );
    }

    const embed = this.client.genEmbed({
      title: "📊 AutoMod Rule Statistics",
      description: `Statistics for rule **${rule.name}**`,
      color: 0x3498db,
      fields: [
        { name: "🎯 Total Triggers", value: String(rule.triggerCount), inline: true },
        {
          name: "📅 Last Triggered",
          value: rule.lastTriggered ? `<t:${String(Math.floor(rule.lastTriggered.getTime() / 1000))}:R>` : "Never",
          inline: true,
        },
        { name: "📈 Status", value: rule.enabled ? "✅ Active" : "❌ Disabled", inline: true },
        { name: "🕒 Created", value: `<t:${String(Math.floor(rule.createdAt.getTime() / 1000))}:F>`, inline: false },
      ],
    });

    return { embeds: [embed], ephemeral: true };
  }

  private validatePatterns(ruleType: string, patterns: string[]): void {
    switch (ruleType) {
      case "spam":
        // Spam patterns should be behavioral indicators
        break;
      case "caps":
        // Caps patterns should be percentage thresholds
        patterns.forEach((p) => {
          const num = parseInt(p);
          if (isNaN(num) || num < 0 || num > 100) {
            throw new Error("Caps patterns must be percentages (0-100)");
          }
        });
        break;
      case "words":
        // Word patterns should be valid regex or keywords
        patterns.forEach((p) => {
          try {
            new RegExp(p);
          } catch {
            // If not valid regex, treat as keyword
            if (p.length < 2) {
              throw new Error("Word patterns must be at least 2 characters or valid regex");
            }
          }
        });
        break;
      case "links":
        // Link patterns should be domains or URL patterns
        patterns.forEach((p) => {
          if (!p.includes(".") && !p.startsWith("http")) {
            throw new Error("Link patterns must be domains or URL patterns");
          }
        });
        break;
      case "invites":
        // Invite patterns should be Discord invite patterns
        patterns.forEach((p) => {
          if (!p.includes("discord.gg") && !p.includes("discordapp.com")) {
            throw new Error("Invite patterns must be Discord invite patterns");
          }
        });
        break;
      case "mentions":
        // Mention patterns should be mention counts
        patterns.forEach((p) => {
          const num = parseInt(p);
          if (isNaN(num) || num < 1) {
            throw new Error("Mention patterns must be positive numbers");
          }
        });
        break;
    }
  }

  private validateActions(actions: string[]): void {
    const validActions = ["DELETE", "WARN", "TIMEOUT", "KICK", "BAN", "NOTIFY", "LOG"];
    actions.forEach((action) => {
      if (!validActions.includes(action.toUpperCase())) {
        throw new Error(`Invalid action: ${action}. Valid actions: ${validActions.join(", ")}`);
      }
    });
  }

  private getThresholdForSensitivity(sensitivity: string): number {
    switch (sensitivity) {
      case "LOW":
        return 5;
      case "MEDIUM":
        return 3;
      case "HIGH":
        return 1;
      default:
        return 3;
    }
  }

  private getTimeWindowForSensitivity(sensitivity: string): number {
    switch (sensitivity) {
      case "LOW":
        return 300; // 5 minutes
      case "MEDIUM":
        return 180; // 3 minutes
      case "HIGH":
        return 60; // 1 minute
      default:
        return 180;
    }
  }
}

// Export the command instance
export default new AutoModAdvancedCommand();

// Export the Discord command builder for registration
export const builder = new SlashCommandBuilder()
  .setName("automod-advanced")
  .setDescription("Create and manage advanced AutoMod rules with pattern detection")
  .setDefaultMemberPermissions(0)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("Create a new advanced AutoMod rule")
      .addStringOption((option) => option.setName("name").setDescription("Name of the rule").setRequired(true))
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Type of rule")
          .setRequired(true)
          .addChoices(
            { name: "Spam Detection", value: "spam" },
            { name: "Caps Detection", value: "caps" },
            { name: "Word Filter", value: "words" },
            { name: "Link Filter", value: "links" },
            { name: "Invite Filter", value: "invites" },
            { name: "Mention Spam", value: "mentions" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("patterns")
          .setDescription("Comma-separated patterns (regex, keywords, or thresholds)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("actions")
          .setDescription("Comma-separated actions (DELETE, WARN, TIMEOUT, KICK, BAN, NOTIFY, LOG)")
          .setRequired(true)
      )
      .addStringOption((option) => option.setName("description").setDescription("Description of the rule"))
      .addStringOption((option) =>
        option
          .setName("sensitivity")
          .setDescription("Sensitivity level")
          .addChoices(
            { name: "Low", value: "LOW" },
            { name: "Medium", value: "MEDIUM" },
            { name: "High", value: "HIGH" }
          )
      )
      .addStringOption((option) =>
        option.setName("exempt-roles").setDescription("Comma-separated role IDs that are exempt")
      )
      .addStringOption((option) =>
        option.setName("exempt-channels").setDescription("Comma-separated channel IDs that are exempt")
      )
      .addStringOption((option) =>
        option.setName("target-channels").setDescription("Comma-separated channel IDs where rule applies (empty = all)")
      )
  )
  .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List all AutoMod rules"))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("edit")
      .setDescription("Edit an AutoMod rule")
      .addStringOption((option) => option.setName("rule-id").setDescription("ID of the rule to edit").setRequired(true))
      .addStringOption((option) =>
        option
          .setName("field")
          .setDescription("Field to edit")
          .setRequired(true)
          .addChoices(
            { name: "Name", value: "name" },
            { name: "Sensitivity", value: "sensitivity" },
            { name: "Enabled", value: "enabled" }
          )
      )
      .addStringOption((option) => option.setName("value").setDescription("New value").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("Delete an AutoMod rule")
      .addStringOption((option) =>
        option.setName("rule-id").setDescription("ID of the rule to delete").setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("test")
      .setDescription("Test an AutoMod rule against sample text")
      .addStringOption((option) => option.setName("rule-id").setDescription("ID of the rule to test").setRequired(true))
      .addStringOption((option) => option.setName("text").setDescription("Text to test against").setRequired(true))
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stats")
      .setDescription("View statistics for an AutoMod rule")
      .addStringOption((option) =>
        option.setName("rule-id").setDescription("ID of the rule to view stats for").setRequired(true)
      )
  );
