import { Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ShardResume, (shardId: number, replayedEvents: number) => {
  logger.info(`Shard ${shardId} resumed successfully with ${replayedEvents} replayed events`);
});
