import type { ThreadChannel } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ThreadCreate, async (thread: ThreadChannel) => {
  const client = thread.client as import("../../structures/Client.js").default;

  // Log the thread creation
  await client.logManager.log(thread.guild.id, "THREAD_CREATE", {
    channelId: thread.id,
    executorId: thread.ownerId,
    metadata: {
      threadName: thread.name,
      threadId: thread.id,
      parentChannelId: thread.parentId,
      parentChannelName: thread.parent?.name,
      ownerId: thread.ownerId,
      type: thread.type,
      archived: thread.archived,
      locked: thread.locked,
      invitable: thread.invitable,
      rateLimitPerUser: thread.rateLimitPerUser,
      memberCount: thread.memberCount,
      messageCount: thread.messageCount,
      autoArchiveDuration: thread.autoArchiveDuration,
      createdAt: thread.createdAt?.toISOString(),
      timestamp: new Date().toISOString(),
    },
  });
});
