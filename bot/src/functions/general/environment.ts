import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

let loadedFile = false;

/** Determine if this is a development runtime environment or not according to the `NODE_ENV` environment variable. */
export function isDevEnvironment(): boolean {
  switch (process.env.NODE_ENV) {
    case "development": {
      if (!loadedFile) {
        config({ path: ".env.development" });
        loadedFile = true;
      }
      return true;
    }
    case undefined: // allow default to fallthrough to production
    case "production": {
      if (!loadedFile) {
        config({ path: ".env" });
        loadedFile = true;
      }
      return false;
    }

    default: {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Invalid value for environment variable "NODE_ENV" ${process.env.NODE_ENV}. Refer to \`global.d.ts\`.`
      );
    }
  }
}
isDevEnvironment(); // force load file on first import

// Fallback: load repository root .env (one level above /bot) without overriding existing vars
try {
  const rootEnvPath = resolve(process.cwd(), "../.env");
  if (existsSync(rootEnvPath)) {
    config({ path: rootEnvPath, override: false });
  }
} catch {
  /* silent */
}
