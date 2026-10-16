import { isConfiguredEnv } from "../../functions/general/environment.js";
import { isOnlyDigits } from "../../functions/general/strings.js";

export function validateRequired(): void {
  const missing: string[] = [];
  if (!isConfiguredEnv(process.env.DISCORD_TOKEN)) {
    missing.push("DISCORD_TOKEN");
  }
  if (!isConfiguredEnv(process.env.DB_URL)) {
    missing.push("DB_URL");
  }
  if (!isConfiguredEnv(process.env.DISCORD_CLIENT_ID)) {
    missing.push("DISCORD_CLIENT_ID");
  }
  if (missing.length > 0) {
    throw new ReferenceError(`${missing.join(", ")} environment variable(s) were not set!`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  if (!isOnlyDigits(clientId)) {
    throw new TypeError("DISCORD_CLIENT_ID environment variable must contain only digits!");
  }
}

export function validateDevelopment(): void {
  if (!isConfiguredEnv(process.env.TEST_GUILD_ID)) {
    console.warn("TEST_GUILD_ID is not set; development command registration will be skipped.");
    return;
  }

  if (!isOnlyDigits(process.env.TEST_GUILD_ID ?? "")) {
    throw new TypeError("TEST_GUILD_ID environment variable must contain only digits!");
  }
}
