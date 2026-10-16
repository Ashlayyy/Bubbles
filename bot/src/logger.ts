import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import pretty from "pino-pretty";

import { getConfigFile } from "./botConfig.js";
import { isDevEnvironment } from "./functions/general/environment.js";

/* The following top-level code will execute BEFORE anything else */

const version = process.env.npm_package_version;
const logFilePath = join(process.cwd(), "logs", "bot.log");

function compactError(err: unknown) {
  if (!err || typeof err !== "object") return err;
  const error = err as {
    name?: string;
    type?: string;
    message?: string;
    code?: unknown;
    status?: unknown;
    method?: string;
    url?: string;
    stack?: string;
  };
  return {
    type: error.name ?? error.type,
    message: error.message,
    code: error.code,
    status: error.status,
    method: error.method,
    url: error.url,
    stack: error.stack,
  };
}

function toPinoArgs(args: unknown[]): Parameters<pino.LogFn> {
  if (args.length >= 2 && typeof args[0] === "string") {
    const msg = args[0];
    const payload = args[1];
    if (payload instanceof Error) {
      return [{ err: payload }, msg] as unknown as Parameters<pino.LogFn>;
    }
    if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
      return [payload, msg] as unknown as Parameters<pino.LogFn>;
    }
  }
  return args as Parameters<pino.LogFn>;
}

function teeLogger(consoleLogger: pino.Logger, fileLogger: pino.Logger): ExtendedLogger {
  const wrapped = consoleLogger as ExtendedLogger;
  const methods = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

  for (const method of methods) {
    const toConsole = consoleLogger[method].bind(consoleLogger);
    const toFile = fileLogger[method].bind(fileLogger);
    wrapped[method] = ((...args: Parameters<pino.LogFn>) => {
      const normalized = toPinoArgs(args);
      toFile(...normalized);
      return toConsole(...normalized);
    }) as pino.LogFn;
  }

  wrapped.verbose = wrapped.debug.bind(wrapped);
  wrapped.child = ((bindings: pino.Bindings) =>
    teeLogger(consoleLogger.child(bindings), fileLogger.child(bindings))) as unknown as pino.Logger["child"];

  return wrapped;
}

function initLogger() {
  const { name } = getConfigFile();
  const service = `${name}@${version ?? "UNKNOWN"}`;

  mkdirSync(join(process.cwd(), "logs"), { recursive: true });
  const fileLogger = pino(
    {
      name: service,
      level: "debug",
      base: { service },
    },
    pino.destination({ dest: logFilePath, mkdir: true, sync: false })
  );

  if (isDevEnvironment()) {
    const consoleLogger = pino(
      {
        name: service,
        level: "debug",
        base: { service },
        serializers: {
          err: compactError,
          error: compactError,
        },
      },
      pretty({
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      })
    );

    return teeLogger(consoleLogger, fileLogger);
  }

  const consoleLogger = pino({
    name: service,
    level: "info",
    base: { service },
    serializers: {
      err: compactError,
      error: compactError,
    },
  });

  return teeLogger(consoleLogger, fileLogger);
}

// Extend Pino logger with a `verbose` alias that maps to `debug` so the rest of the codebase keeps working.
interface ExtendedLogger extends pino.Logger {
  verbose: pino.Logger["debug"];
}

const logger: ExtendedLogger = initLogger();

export default logger;
