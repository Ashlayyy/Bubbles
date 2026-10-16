const PLACEHOLDER_ENV = /^(your_.+_here)$/i;

/** True when an env value is present and not a copy-paste placeholder from env.example. */
export function isConfiguredEnv(value: string | undefined | null): value is string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }
  return !PLACEHOLDER_ENV.test(trimmed);
}

/** Determine if this is a development runtime environment or not according to the `NODE_ENV` environment variable. */
export function isDevEnvironment(): boolean {
  switch (process.env.NODE_ENV) {
    case "development": {
      return true;
    }
    case undefined: // allow default to fallthrough to production
    case "production": {
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
