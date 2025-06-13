import logger from "../../logger.js";
import Client, { DiscordAPIAction } from "../../structures/Client.js";

// Force development environment
process.env.NODE_ENV = "development";

const client = await Client.get();
await client.manageDiscordAPICommands(DiscordAPIAction.Register);

logger.info("Exiting script");
await client.destroy();
