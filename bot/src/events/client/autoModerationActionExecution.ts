import type { AutoModerationActionExecution } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.AutoModerationActionExecution,
  async (execution: AutoModerationActionExecution) => {
    const client = execution.guild.client as import("../../structures/Client.js").default;

    try {
      await client.logManager.log(execution.guild.id, "AUTOMOD_ACTION_EXECUTE", {
        userId: execution.user?.id,
        channelId: execution.channel?.id,
        executorId: execution.user?.id,
        metadata: {
          ruleId: execution.ruleId,
          ruleTriggerType: execution.ruleTriggerType,
          action: {
            type: execution.action.type,
            metadata: JSON.stringify(execution.action.metadata),
          },
          messageId: execution.messageId,
          alertSystemMessageId: execution.alertSystemMessageId,
          content: execution.content,
          matchedKeyword: execution.matchedKeyword,
          matchedContent: execution.matchedContent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error logging automod action execution:", error);
    }
  }
);
