import type { AutoModerationRule } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.AutoModerationRuleCreate, async (rule: AutoModerationRule) => {
  const client = rule.client as import("../../structures/Client.js").default;

  try {
    await client.logManager.log(rule.guild.id, "AUTOMOD_RULE_CREATE", {
      executorId: rule.creatorId,
      metadata: {
        ruleName: rule.name,
        ruleId: rule.id,
        enabled: rule.enabled,
        eventType: rule.eventType,
        triggerType: rule.triggerType,
        actions: JSON.stringify(
          rule.actions.map((action) => ({
            type: action.type,
            metadata: action.metadata,
          }))
        ),
        triggerMetadata: JSON.stringify(rule.triggerMetadata),
        exemptRoles: rule.exemptRoles.map((role) => role.id),
        exemptChannels: rule.exemptChannels.map((channel) => channel.id),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error logging automod rule creation:", error);
  }
});
