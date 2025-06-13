import type { AutoModerationRule } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.AutoModerationRuleUpdate,
  async (oldRule: AutoModerationRule | null, newRule: AutoModerationRule) => {
    const client = newRule.client as import("../../structures/Client.js").default;

    try {
      // If oldRule is null, treat as creation
      if (!oldRule) {
        await client.logManager.log(newRule.guild.id, "AUTOMOD_RULE_CREATE", {
          executorId: newRule.creatorId,
          metadata: {
            ruleName: newRule.name,
            ruleId: newRule.id,
            enabled: newRule.enabled,
            eventType: newRule.eventType,
            triggerType: newRule.triggerType,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Track what changed
      const changes: string[] = [];
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      if (oldRule.name !== newRule.name) {
        changes.push("name");
        before.name = oldRule.name;
        after.name = newRule.name;
      }

      if (oldRule.enabled !== newRule.enabled) {
        changes.push("enabled");
        before.enabled = oldRule.enabled;
        after.enabled = newRule.enabled;
      }

      if (JSON.stringify(oldRule.triggerMetadata) !== JSON.stringify(newRule.triggerMetadata)) {
        changes.push("triggerMetadata");
        before.triggerMetadata = JSON.stringify(oldRule.triggerMetadata);
        after.triggerMetadata = JSON.stringify(newRule.triggerMetadata);
      }

      if (JSON.stringify(oldRule.actions) !== JSON.stringify(newRule.actions)) {
        changes.push("actions");
        before.actions = JSON.stringify(oldRule.actions);
        after.actions = JSON.stringify(newRule.actions);
      }

      if (changes.length > 0) {
        await client.logManager.log(newRule.guild.id, "AUTOMOD_RULE_UPDATE", {
          executorId: newRule.creatorId,
          before: JSON.stringify(before),
          after: JSON.stringify(after),
          metadata: {
            ruleName: newRule.name,
            ruleId: newRule.id,
            changes,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("Error logging automod rule update:", error);
    }
  }
);
