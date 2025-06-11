import { Events } from "discord.js";
import logger from "../../logger.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.Warn, (info: string) => {
  logger.warn(`Discord.js Warning: ${info}`);
});
