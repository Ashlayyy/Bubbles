import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ThreadListSync, async (threads, guild) => {
  const client = guild.client as import("../../structures/Client.js").default;

  try {
    const threadArray = Array.from(threads.values());

    await client.logManager.log(guild.id, "THREAD_LIST_SYNC", {
      metadata: {
        threadsCount: threads.size,
        threadIds: threadArray.map((thread) => thread.id),
        threadNames: threadArray.map((thread) => thread.name),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error logging thread list sync:", error);
  }
});
