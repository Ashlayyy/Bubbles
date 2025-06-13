import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardResume, async (shardId: number, replayedEvents: number) => {
  // Get client from global instance
  const Client = (await import("../../structures/Client.js")).default;
  const client = await Client.get();

  console.log(`Shard ${shardId} resumed successfully with ${replayedEvents} replayed events`);

  // Try to log to any available guild (use first available guild)
  const firstGuild = client.guilds.cache.first();
  if (firstGuild) {
    await client.logManager.log(firstGuild.id, "SHARD_RESUME", {
      metadata: {
        shardId,
        replayedEvents,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
