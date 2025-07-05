import type { Message } from "discord.js";
import { PermissionsBitField } from "discord.js";

import type {
  AutoModActionConfig,
  AutoModRule,
  AutoModRuleType,
  AutoModTestResult,
  AutoModTriggerConfig,
  EscalationConfig,
  LegacyActionType,
} from "@shared/types";
import { prisma } from "../database/index.js";
import logger from "../logger.js";
import type Client from "../structures/Client.js";
import { cacheService } from "./cacheService.js";

function isAutoModTriggerConfig(obj: unknown): obj is AutoModTriggerConfig {
  return typeof obj === "object" && obj !== null;
}

function isAutoModActionConfig(obj: unknown): obj is AutoModActionConfig {
  return typeof obj === "object" && obj !== null;
}

function isLegacyAction(action: unknown): action is LegacyActionType {
  return typeof action === "string" && ["DELETE", "WARN", "TIMEOUT", "KICK", "LOG_ONLY"].includes(action);
}

const ruleCache = new Map<string, { rules: AutoModRule[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AutoModService {
  static async processMessage(client: Client, message: Message): Promise<void> {
    if (!message.guild || !message.member || message.author.bot) return;

    try {
      const rules = await AutoModService.getActiveRules(message.guild.id);
      if (rules.length === 0) return;

      if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return;
      }

      if (AutoModService.isExempt(message, rules)) {
        return;
      }

      const violations: { rule: AutoModRule; result: AutoModTestResult }[] = [];

      for (const rule of rules) {
        const result = AutoModService.testMessageAgainstRule(message, rule);
        if (result.triggered) {
          violations.push({ rule, result });
          await AutoModService.updateRuleStats(rule.id);
        }
      }

      if (violations.length > 0) {
        await AutoModService.executeAccumulatedActions(client, message, violations);
      }
    } catch (error: unknown) {
      logger.error("Error processing auto-moderation:", error);
    }
  }

  static testRuleAgainstText(rule: AutoModRule, text: string): AutoModTestResult {
    const mockMessage = {
      content: text,
      author: { id: "test" },
      channel: { id: "test" },
    } as Message;

    return AutoModService.testMessageAgainstRule(mockMessage, rule);
  }

  static clearCache(guildId?: string): void {
    if (guildId) {
      ruleCache.delete(guildId);
    } else {
      ruleCache.clear();
    }
  }

  private static async getActiveRules(guildId: string): Promise<AutoModRule[]> {
    const cached = ruleCache.get(guildId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.rules;
    }

    try {
      // Use Redis cache service for better caching
      const cacheKey = `automod:rules:${guildId}`;
      const cachedRules = await cacheService.get<AutoModRule[]>(cacheKey, "autoModRules");

      if (cachedRules) {
        // Update memory cache for backwards compatibility
        ruleCache.set(guildId, { rules: cachedRules, timestamp: Date.now() });
        return cachedRules;
      }

      // Fetch from database if not in Redis cache
      const dbRules = await prisma.autoModRule.findMany({
        where: {
          guildId,
          enabled: true,
        },
        orderBy: [
          { triggerCount: "desc" }, // Most triggered rules first for performance
          { createdAt: "asc" },
        ],
      });

      // Convert database rules to typed format
      const rules: AutoModRule[] = dbRules.map((rule) => ({
        ...rule,
        triggers:
          typeof rule.triggers === "string"
            ? (JSON.parse(rule.triggers) as AutoModTriggerConfig)
            : (rule.triggers as AutoModTriggerConfig),
        actions:
          typeof rule.actions === "string"
            ? (JSON.parse(rule.actions) as AutoModActionConfig)
            : (rule.actions as AutoModActionConfig),
        escalation: rule.escalation
          ? typeof rule.escalation === "string"
            ? (JSON.parse(rule.escalation) as EscalationConfig)
            : (rule.escalation as EscalationConfig)
          : undefined,
        lastTriggered: rule.lastTriggered ?? undefined,
        logChannel: rule.logChannel ?? undefined,
      }));

      // Cache in both Redis and memory
      await cacheService.set(cacheKey, rules, "autoModRules");
      ruleCache.set(guildId, { rules, timestamp: Date.now() });

      return rules;
    } catch (error) {
      logger.error(`Error loading automod rules for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Invalidate automod rules cache for a guild
   */
  static async invalidateRulesCache(guildId: string): Promise<void> {
    ruleCache.delete(guildId);
    await cacheService.delete(`automod:rules:${guildId}`);
  }

  private static isExempt(message: Message, rules: AutoModRule[]): boolean {
    if (!message.member) return false;

    // Check global exemptions across all rules
    for (const rule of rules) {
      // Check exempt users
      if (rule.exemptUsers.includes(message.author.id)) {
        continue; // Skip this rule only
      }

      // Check exempt channels
      if (rule.exemptChannels.includes(message.channel.id)) {
        continue; // Skip this rule only
      }

      // Check exempt roles
      const hasExemptRole = rule.exemptRoles.some((roleId) => message.member?.roles.cache.has(roleId));
      if (hasExemptRole) {
        continue; // Skip this rule only
      }

      // Check target channels (if specified, only apply rule in these channels)
      if (rule.targetChannels.length > 0 && !rule.targetChannels.includes(message.channel.id)) {
        continue; // Skip this rule only
      }

      // If we get here, at least one rule should apply
      return false;
    }

    // All rules were exempted
    return true;
  }

  private static testMessageAgainstRule(message: Message, rule: AutoModRule): AutoModTestResult {
    const content = message.content;
    const triggers = rule.triggers;

    switch (rule.type as AutoModRuleType) {
      case "spam":
        return AutoModService.testSpamRule(content, triggers, rule.sensitivity);

      case "caps":
        return AutoModService.testCapsRule(content, triggers, rule.sensitivity);

      case "words":
        return AutoModService.testWordsRule(content, triggers, rule.sensitivity);

      case "links":
        return AutoModService.testLinksRule(content, triggers, rule.sensitivity);

      case "invites":
        return AutoModService.testInvitesRule(content, triggers, rule.sensitivity);

      case "mentions":
        return AutoModService.testMentionsRule(content, triggers, rule.sensitivity);

      default:
        return { triggered: false };
    }
  }

  /**
   * Test spam detection
   */
  private static testSpamRule(content: string, triggers: AutoModTriggerConfig, sensitivity: string): AutoModTestResult {
    // Check for duplicate words/phrases
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      if (word.length < 3) continue; // Skip short words
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }

    const baseThreshold = triggers.duplicateThreshold ?? 3;
    const threshold = AutoModService.adjustThresholdBySensitivity(baseThreshold, sensitivity);

    for (const [word, count] of wordCounts) {
      if (count >= threshold) {
        return {
          triggered: true,
          reason: `Spam detected: "${word}" repeated ${count} times`,
          severity: count >= threshold * 2 ? "HIGH" : "MEDIUM",
          matchedContent: word,
        };
      }
    }

    return { triggered: false };
  }

  /**
   * Test caps detection
   */
  private static testCapsRule(content: string, triggers: AutoModTriggerConfig, sensitivity: string): AutoModTestResult {
    const minLength = triggers.minLength ?? 10;
    if (content.length < minLength) return { triggered: false };

    const capsCount = (content.match(/[A-Z]/g) ?? []).length;
    const capsPercent = (capsCount / content.length) * 100;

    const baseThreshold = triggers.capsPercent ?? 70;
    const threshold = AutoModService.adjustThresholdBySensitivity(baseThreshold, sensitivity, true); // Inverse for caps

    if (capsPercent >= threshold) {
      return {
        triggered: true,
        reason: `Excessive caps: ${Math.round(capsPercent)}% (threshold: ${threshold}%)`,
        severity: capsPercent >= threshold * 1.2 ? "HIGH" : "MEDIUM",
      };
    }

    return { triggered: false };
  }

  /**
   * Test word filter
   */
  private static testWordsRule(
    content: string,
    triggers: AutoModTriggerConfig,
    sensitivity: string
  ): AutoModTestResult {
    const blockedWords = triggers.blockedWords ?? [];
    const checkContent = triggers.ignoreCase ? content.toLowerCase() : content;

    for (const word of blockedWords) {
      const checkWord = triggers.ignoreCase ? word.toLowerCase() : word;

      // Support wildcards if enabled
      if (triggers.wildcards) {
        const regex = new RegExp(checkWord.replace(/\*/g, ".*"), triggers.ignoreCase ? "i" : "");
        if (regex.test(content)) {
          return {
            triggered: true,
            reason: `Blocked word pattern detected: "${word}"`,
            severity: "HIGH",
            matchedContent: word,
          };
        }
      } else {
        if (checkContent.includes(checkWord)) {
          return {
            triggered: true,
            reason: `Blocked word detected: "${word}"`,
            severity: "HIGH",
            matchedContent: word,
          };
        }
      }
    }

    return { triggered: false };
  }

  /**
   * Test link filtering
   */
  private static testLinksRule(
    content: string,
    triggers: AutoModTriggerConfig,
    sensitivity: string
  ): AutoModTestResult {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const links = content.match(urlRegex);

    if (!links) return { triggered: false };

    const blockedDomains = triggers.blockedDomains ?? [];
    const allowedDomains = triggers.allowedDomains ?? [];

    for (const link of links) {
      try {
        const url = new URL(link);
        const domain = url.hostname.toLowerCase();

        // Check blocked domains first
        for (const blockedDomain of blockedDomains) {
          if (domain.includes(blockedDomain.toLowerCase())) {
            return {
              triggered: true,
              reason: `Blocked domain detected: ${blockedDomain}`,
              severity: "HIGH",
              matchedContent: domain,
            };
          }
        }

        // If allowed domains are specified, check if domain is allowed
        if (allowedDomains.length > 0) {
          const isAllowed = allowedDomains.some((allowedDomain) => domain.includes(allowedDomain.toLowerCase()));

          if (!isAllowed) {
            return {
              triggered: true,
              reason: `Unauthorized domain: ${domain}`,
              severity: "MEDIUM",
              matchedContent: domain,
            };
          }
        }
      } catch {
        // Invalid URL, might still want to flag depending on sensitivity
        if (sensitivity === "HIGH") {
          return {
            triggered: true,
            reason: "Malformed URL detected",
            severity: "LOW",
          };
        }
      }
    }

    return { triggered: false };
  }

  /**
   * Test invite filtering
   */
  private static testInvitesRule(
    content: string,
    triggers: AutoModTriggerConfig,
    sensitivity: string
  ): AutoModTestResult {
    const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
    const matches = content.match(inviteRegex);

    if (matches) {
      return {
        triggered: true,
        reason: "Discord invite detected",
        severity: "MEDIUM",
        matchedContent: matches[0],
      };
    }

    return { triggered: false };
  }

  /**
   * Test mention spam
   */
  private static testMentionsRule(
    content: string,
    triggers: AutoModTriggerConfig,
    sensitivity: string
  ): AutoModTestResult {
    const mentionCount = (content.match(/<@[!&]?\d+>/g) ?? []).length;
    const baseThreshold = triggers.maxMentions ?? 5;
    const threshold = AutoModService.adjustThresholdBySensitivity(baseThreshold, sensitivity);

    if (mentionCount >= threshold) {
      return {
        triggered: true,
        reason: `Excessive mentions: ${mentionCount} (threshold: ${threshold})`,
        severity: mentionCount >= threshold * 2 ? "HIGH" : "MEDIUM",
      };
    }

    return { triggered: false };
  }

  /**
   * Adjust threshold based on sensitivity level
   */
  private static adjustThresholdBySensitivity(baseThreshold: number, sensitivity: string, inverse = false): number {
    const multiplier = inverse ? { LOW: 1.3, MEDIUM: 1.0, HIGH: 0.7 } : { LOW: 1.3, MEDIUM: 1.0, HIGH: 0.7 };

    return Math.max(1, Math.round(baseThreshold * (multiplier[sensitivity as keyof typeof multiplier] || 1.0)));
  }

  private static async executeAccumulatedActions(
    client: Client,
    message: Message,
    violations: { rule: AutoModRule; result: AutoModTestResult }[]
  ): Promise<void> {
    if (!message.guild || !message.member) return;

    try {
      const severityScore = AutoModService.calculateSeverityScore(violations);
      const reasons = violations.map((v) => v.result.reason).filter(Boolean);
      const ruleNames = violations.map((v) => v.rule.name);

      const summary = `Multiple violations detected: ${ruleNames.join(", ")}`;

      if (message.channel.isSendable()) {
        const reply = await message.reply({
          content: `⚠️ ${message.author}, your message violated server rules: ${reasons.join("; ")}`,
          allowedMentions: { repliedUser: false },
        });

        setTimeout(() => {
          reply.delete().catch((error: unknown) => {
            logger.error("Failed to delete automod reply:", error);
          });
        }, 8000);
      }

      await message.delete();

      if (severityScore >= 8) {
        await message.member.timeout(10 * 60 * 1000, `Auto-mod: High severity violations - ${summary}`);
      } else if (severityScore >= 5) {
        await message.member.timeout(5 * 60 * 1000, `Auto-mod: Multiple violations - ${summary}`);
      }

      for (const { rule, result } of violations) {
        await client.logManager.log(message.guild.id, "AUTOMOD_ACTION", {
          userId: message.author.id,
          channelId: message.channel.id,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            action: severityScore >= 5 ? "TIMEOUT" : "DELETE",
            reason: result.reason,
            severity: result.severity,
            messageId: message.id,
            messageContent: message.content.substring(0, 500),
            severityScore,
            violationCount: violations.length,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error: unknown) {
      logger.error("Error executing accumulated automod actions:", error);
    }
  }

  private static calculateSeverityScore(violations: { rule: AutoModRule; result: AutoModTestResult }[]): number {
    let score = 0;
    for (const { result } of violations) {
      switch (result.severity) {
        case "HIGH":
          score += 3;
          break;
        case "MEDIUM":
          score += 2;
          break;
        case "LOW":
          score += 1;
          break;
        default:
          score += 1;
      }
    }
    return score;
  }

  private static async executeAutoModAction(
    client: Client,
    message: Message,
    rule: AutoModRule,
    result: AutoModTestResult
  ): Promise<void> {
    if (!message.guild || !message.member) return;

    try {
      const actions = rule.actions;

      // Handle legacy string actions
      if (isLegacyAction(actions)) {
        await AutoModService.executeLegacyAction(actions, message, rule, result.reason ?? "Rule triggered");
        return;
      }

      // Handle new complex actions
      if (isAutoModActionConfig(actions)) {
        await AutoModService.executeComplexActions(actions, message, rule, result);
        return;
      }

      // Fallback to delete
      await message.delete();
    } catch (error: unknown) {
      logger.error("Error executing auto-mod action:", error);
    }
  }

  private static async executeLegacyAction(
    action: LegacyActionType,
    message: Message,
    rule: AutoModRule,
    reason: string
  ): Promise<void> {
    if (!message.guild || !message.member) return;

    switch (action) {
      case "DELETE":
        await message.delete();
        break;

      case "TIMEOUT": {
        const member = message.member;
        await member.timeout(5 * 60 * 1000, `Auto-mod: ${reason}`); // 5 minute timeout
        await message.delete();
        break;
      }

      case "WARN": {
        // Log warning
        const client = message.client as Client;
        await client.logManager.log(message.guild.id, "AUTOMOD_WARNING", {
          userId: message.author.id,
          channelId: message.channel.id,
          metadata: {
            reason: `Auto-mod: ${reason}`,
            ruleId: rule.id,
            ruleName: rule.name,
            messageId: message.id,
            timestamp: new Date().toISOString(),
          },
        });
        await message.delete();
        break;
      }

      case "LOG_ONLY":
        // Just log, don't take action on message
        break;

      default:
        await message.delete();
        break;
    }

    // Send notification to user (if not log-only)
    // No DM notifications - using ephemeral replies instead
  }

  private static async executeComplexActions(
    actions: AutoModActionConfig,
    message: Message,
    rule: AutoModRule,
    result: AutoModTestResult
  ): Promise<void> {
    if (!message.guild || !message.member) return;

    const reason = result.reason ?? "Rule triggered";

    // Delete message if specified
    if (actions.delete) {
      await message.delete();
    }

    // Timeout user if specified
    if (actions.timeout && actions.timeout > 0) {
      await message.member.timeout(actions.timeout * 1000, `Auto-mod: ${reason}`);
    }

    // Kick user if specified
    if (actions.kick && message.member.kickable) {
      await message.member.kick(`Auto-mod: ${reason}`);
    }

    // Ban user if specified
    if (typeof actions.ban === "number" && message.member.bannable) {
      await message.guild.members.ban(message.author, {
        reason: `Auto-mod: ${reason}`,
        deleteMessageSeconds: 24 * 60 * 60, // Delete messages from last 24 hours
      });
    }

    // Add/remove roles if specified
    if (actions.addRole && message.member.manageable) {
      const role = message.guild.roles.cache.get(actions.addRole);
      if (role) {
        await message.member.roles.add(role, `Auto-mod: ${reason}`);
      }
    }

    if (actions.removeRole && message.member.manageable) {
      const role = message.guild.roles.cache.get(actions.removeRole);
      if (role) {
        await message.member.roles.remove(role, `Auto-mod: ${reason}`);
      }
    }

    // Send DM if specified
    // DM functionality disabled - using ephemeral replies in accumulated actions

    // Reply in channel if specified
    if (actions.replyInChannel && !actions.delete) {
      const replyMessage = actions.customMessage ?? `${message.author}, your message violated server rules: ${reason}`;

      const reply = await message.reply(replyMessage);

      // Auto-delete reply after 10 seconds
      setTimeout(() => {
        reply.delete().catch((error: unknown) => {
          logger.error("Failed to delete auto-mod reply:", error);
        });
      }, 10000);
    }
  }

  /**
   * Send notification to user
   */
  private static async notifyUser(
    message: Message,
    rule: AutoModRule,
    reason: string,
    customMessage?: string
  ): Promise<void> {
    try {
      const content =
        customMessage ??
        `⚠️ Your message in **${message.guild?.name}** was flagged by auto-moderation.\n\n**Reason:** ${reason}\n**Rule:** ${rule.name}`;

      await message.author.send({ content });
    } catch {
      // User has DMs disabled, ignore
    }
  }

  /**
   * Update rule statistics
   */
  private static async updateRuleStats(ruleId: string): Promise<void> {
    try {
      await prisma.autoModRule.update({
        where: { id: ruleId },
        data: {
          triggerCount: { increment: 1 },
          lastTriggered: new Date(),
        },
      });
    } catch (error) {
      logger.error("Error updating rule stats:", error);
    }
  }

  /**
   * Quick setup for automod - creates basic rules with default settings
   */
  static async quickSetup(guildId: string): Promise<{ configuredRules: string[] }> {
    try {
      const configuredRules: string[] = [];

      // Create basic spam protection rule
      await prisma.autoModRule.create({
        data: {
          guildId,
          name: "Spam Protection",
          type: "spam",
          enabled: true,
          sensitivity: "MEDIUM",
          actions: "DELETE",
          triggers: {
            maxMessages: 5,
            timeWindow: 10,
            duplicateThreshold: 3,
          },
          escalation: {},
          createdBy: "system",
        },
      });
      configuredRules.push("Spam Protection");

      // Create basic caps rule
      await prisma.autoModRule.create({
        data: {
          guildId,
          name: "Caps Lock Filter",
          type: "caps",
          enabled: true,
          sensitivity: "MEDIUM",
          actions: "DELETE",
          triggers: {
            capsPercent: 70,
            minLength: 10,
          },
          escalation: {},
          createdBy: "system",
        },
      });
      configuredRules.push("Caps Lock Filter");

      // Clear cache for this guild
      await AutoModService.invalidateRulesCache(guildId);

      return { configuredRules };
    } catch (error) {
      logger.error(`Failed to perform quick setup for guild ${guildId}:`, error);
      throw new Error("Failed to configure automod rules");
    }
  }

  /**
   * Advanced setup for automod with custom configuration
   */
  static async advancedSetup(
    guildId: string,
    options: {
      antiSpam?: boolean;
      antiRaid?: boolean;
      wordFilter?: boolean;
      linkFilter?: boolean;
    }
  ): Promise<{ configuredRules: string[] }> {
    try {
      const configuredRules: string[] = [];

      if (options.antiSpam) {
        await prisma.autoModRule.create({
          data: {
            guildId,
            name: "Advanced Spam Protection",
            type: "spam",
            enabled: true,
            sensitivity: "HIGH",
            actions: "TIMEOUT",
            triggers: {
              maxMessages: 3,
              timeWindow: 5,
              duplicateThreshold: 2,
            },
            escalation: {},
            createdBy: "system",
          },
        });
        configuredRules.push("Advanced Spam Protection");
      }

      if (options.wordFilter) {
        await prisma.autoModRule.create({
          data: {
            guildId,
            name: "Word Filter",
            type: "words",
            enabled: true,
            sensitivity: "MEDIUM",
            actions: "DELETE",
            triggers: {
              blockedWords: ["spam", "scam"],
              ignoreCase: true,
            },
            escalation: {},
            createdBy: "system",
          },
        });
        configuredRules.push("Word Filter");
      }

      if (options.linkFilter) {
        await prisma.autoModRule.create({
          data: {
            guildId,
            name: "Link Filter",
            type: "links",
            enabled: true,
            sensitivity: "MEDIUM",
            actions: "DELETE",
            triggers: {
              blockedDomains: ["bit.ly", "tinyurl.com"],
            },
            escalation: {},
            createdBy: "system",
          },
        });
        configuredRules.push("Link Filter");
      }

      // Clear cache for this guild
      await AutoModService.invalidateRulesCache(guildId);

      return { configuredRules };
    } catch (error) {
      logger.error(`Failed to perform advanced setup for guild ${guildId}:`, error);
      throw new Error("Failed to configure automod rules");
    }
  }

  /**
   * Reset automod configuration for a guild
   */
  static async resetConfig(guildId: string): Promise<void> {
    try {
      // Delete all automod rules for this guild
      await prisma.autoModRule.deleteMany({
        where: { guildId },
      });

      // Clear cache for this guild
      await AutoModService.invalidateRulesCache(guildId);
    } catch (error) {
      logger.error(`Failed to reset config for guild ${guildId}:`, error);
      throw new Error("Failed to reset automod configuration");
    }
  }
}
