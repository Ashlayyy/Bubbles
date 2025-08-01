// Load environment variables first
import { loadEnvironment } from "../../functions/general/environmentLoader.js";
loadEnvironment();

import logger from "../../logger.js";
import Client, { DiscordAPIAction } from "../../structures/Client.js";

const client = await Client.get();
await client.manageDiscordAPICommands(DiscordAPIAction.Reset);

logger.info("Exiting script");
await client.destroy();
