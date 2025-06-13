import type { ThreadChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ThreadUpdate, async (oldThread: ThreadChannel, newThread: ThreadChannel) => {
  const client = newThread.client as import("../../structures/Client.js").default;

  // Compare thread changes
  const changes: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Check for name changes
  if (oldThread.name !== newThread.name) {
    changes.push("name");
    before.name = oldThread.name;
    after.name = newThread.name;
  }

  // Check for archive status changes
  if (oldThread.archived !== newThread.archived) {
    changes.push("archived");
    before.archived = oldThread.archived;
    after.archived = newThread.archived;
  }

  // Check for lock status changes
  if (oldThread.locked !== newThread.locked) {
    changes.push("locked");
    before.locked = oldThread.locked;
    after.locked = newThread.locked;
  }

  // Check for rate limit changes
  if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
    changes.push("slowmode");
    before.rateLimitPerUser = oldThread.rateLimitPerUser;
    after.rateLimitPerUser = newThread.rateLimitPerUser;
  }

  // Check for auto archive duration changes
  if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
    changes.push("autoArchiveDuration");
    before.autoArchiveDuration = oldThread.autoArchiveDuration;
    after.autoArchiveDuration = newThread.autoArchiveDuration;
  }

  // Log the thread update if there are changes
  if (changes.length > 0) {
    await client.logManager.log(newThread.guild.id, "THREAD_UPDATE", {
      channelId: newThread.id,
      executorId: newThread.ownerId,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      metadata: {
        threadName: newThread.name,
        threadId: newThread.id,
        parentChannelId: newThread.parentId,
        parentChannelName: newThread.parent?.name,
        ownerId: newThread.ownerId,
        changes,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
