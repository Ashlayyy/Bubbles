import { MusicPlayerGuildQueueEvent } from "../../structures/Event.js";
import type QueueMetadata from "../../structures/QueueMetadata.js";

export default new MusicPlayerGuildQueueEvent("playerSkip", async (queue, track) => {
  const metadata = queue.metadata as QueueMetadata | undefined;

  // Increment failure counter
  if (metadata) metadata.streamFailCount += 1;

  const failCount = metadata ? metadata.streamFailCount : 0;

  const latestInteraction = metadata?.latestInteraction;
  if (latestInteraction) {
    await latestInteraction.followUp({
      content: `Skipping \`${track.title}\` due to stream loading failure! (${failCount}/3)`,
      ephemeral: true,
    });
  }

  // If failures reach threshold, stop playback and clear queue
  if (failCount >= 3) {
    queue.delete();

    if (latestInteraction) {
      await latestInteraction.followUp({
        content: "❌ Stopped playback after 3 consecutive failed stream attempts.",
        ephemeral: true,
      });
    }
  }
});
