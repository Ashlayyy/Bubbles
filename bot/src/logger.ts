import pino from "pino";

import { getConfigFile } from "./botConfig.js";
import { isDevEnvironment } from "./functions/general/environment.js";

/* The following top-level code will execute BEFORE anything else */

const version = process.env.npm_package_version;

function initLogger() {
  const { name } = getConfigFile();
  const service = `${name}@${version ?? "UNKNOWN"}`;

  if (isDevEnvironment()) {
    // Pretty-printed output in development
    return pino({
      name: service,
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
      //base: { service },
    });
  }

  // JSON logs in production – structured & high-performance
  return pino({
    name: service,
    level: "info",
    //base: { service },
  });
}

// Extend Pino logger with a `verbose` alias that maps to `debug` so the rest of the codebase keeps working.
interface ExtendedLogger extends pino.Logger {
  verbose: pino.Logger["debug"];
}

const baseLogger = initLogger();
const logger: ExtendedLogger = baseLogger as unknown as ExtendedLogger;

logger.verbose = baseLogger.debug.bind(baseLogger);

export default logger;
