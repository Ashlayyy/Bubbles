import logger from "../../logger.js";
import { MusicPlayerGuildQueueEvent } from "../../structures/Event.js";
import type QueueMetadata from "../../structures/QueueMetadata.js";

export default new MusicPlayerGuildQueueEvent("playerStart", async (queue, track) => {
  logger.verbose(`Starting new audio track: ${track.title}`);

  const metadata = queue.metadata as QueueMetadata | undefined;

  // Reset consecutive failure counter on a successful start
  if (metadata) metadata.streamFailCount = 0;

  if (metadata && typeof metadata.updateNowPlaying === "function") {
    await metadata.updateNowPlaying(track);
  }
});
