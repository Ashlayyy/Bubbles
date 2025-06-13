import type { AutoModerationRule } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.AutoModerationRuleDelete, async (rule: AutoModerationRule) => {
  const client = rule.client as import("../../structures/Client.js").default;

  try {
    await client.logManager.log(rule.guild.id, "AUTOMOD_RULE_DELETE", {
      executorId: rule.creatorId,
      metadata: {
        ruleName: rule.name,
        ruleId: rule.id,
        wasEnabled: rule.enabled,
        eventType: rule.eventType,
        triggerType: rule.triggerType,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error logging automod rule deletion:", error);
  }
});
