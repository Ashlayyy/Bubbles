import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";

import logger from "../../logger.js";
import { MusicPlayerGuildQueueEvent } from "../../structures/Event.js";

export default new MusicPlayerGuildQueueEvent("audioTrackAdd", async (queue, track) => {
  logger.verbose(
    `${track.requestedBy?.displayName ?? "USER_DISPLAY_NAME"} added this audio track to the queue:\n\t${track.title}`
  );

  const latestInteraction = (queue.metadata as { latestInteraction?: ChatInputCommandInteraction }).latestInteraction;
  if (!latestInteraction) {
    logger.debug("No latestInteraction metadata – skipping follow-up message");
    return;
  }

  if (queue.isPlaying()) {
    logger.verbose("Queue is playing, sending confirmation message");

    await latestInteraction.followUp({
      content: `Queued [${track.title}](${track.url}) by ${track.author}!`,
      flags: MessageFlags.SuppressEmbeds,
    });
  } else {
    logger.verbose("Queue has just begun, NOT sending a redundant confirmation message");
  }
});
