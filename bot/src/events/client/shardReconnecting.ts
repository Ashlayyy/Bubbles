import { Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardReconnecting, (shardId: number) => {
  logger.warn(`Shard ${shardId} is attempting to reconnect...`);
});
