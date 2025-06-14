import { Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardReady, (shardId: number, unavailableGuilds: Set<string> | undefined) => {
  logger.info(`Shard ${shardId} is ready!`, { unavailableGuilds: unavailableGuilds?.size ?? 0 });
});
