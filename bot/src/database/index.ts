// import below force loads `.env` file if present AND `schema.prisma` refers to an environment variable that is unset
import { createPrismaClient, PrismaClient } from "@shared/database";

import logger from "../logger.js";

// Create our own configured Prisma client instance
export const prisma: PrismaClient = createPrismaClient();

let hasDoneInitialConnection = false;
/** Connects to database with `DB_URL` environment variable specified in `prisma/schema.prisma` file.
 *
 * Should NOT need to call this method (see {@link https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management#connect here})
 */
export async function connect() {
  if (!hasDoneInitialConnection) {
    logger.info("Initializing connection to database...");
    await prisma.$connect();
    hasDoneInitialConnection = true;
    logger.info("Successfully completed initial connection to database!");
  } else {
    logger.warn(
      "Do not need to explicitly connect to the database! Refer to: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management#connect"
    );
  }
}

export async function disconnect() {
  try {
    logger.info("Disconnecting from database...");
    await prisma.$disconnect();
    logger.info("Successfully disconnected from database!");
  } catch (error) {
    logger.error(error);
    logger.error(new Error("Errored trying to disconnect from database!"));
  }
}

export default { connect, disconnect };
