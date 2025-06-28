// Load environment variables first, before any other imports
import { loadEnvironment } from "./functions/general/environmentLoader.js";
loadEnvironment();

import Client from "./structures/Client.js";

const client = await Client.get();
await client.start();
