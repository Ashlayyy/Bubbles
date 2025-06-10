import { Events } from "discord.js";
import logger from "../../logger.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.Debug, (info: string) => {
  // Only log important debug messages to avoid spam
  if (
    info.includes("Heartbeat acknowledged") ||
    info.includes("Session Resume") ||
    info.includes("Session Invalidated") ||
    info.includes("Gateway") ||
    info.includes("Shard") ||
    info.includes("WebSocket")
  ) {
    logger.debug(`Discord.js Debug: ${info}`);
  }
});
