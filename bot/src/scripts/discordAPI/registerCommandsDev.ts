// Load environment variables first
import { loadEnvironment } from "../../functions/general/environmentLoader.js";
loadEnvironment();

// Force development environment for this script
process.env.NODE_ENV = "development";

import logger from "../../logger.js";
import Client, { DiscordAPIAction } from "../../structures/Client.js";

const client = await Client.get();
await client.manageDiscordAPICommands(DiscordAPIAction.Register);

logger.info("Exiting script");
await client.destroy();
