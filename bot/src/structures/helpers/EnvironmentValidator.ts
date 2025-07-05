import { isOnlyDigits } from "../../functions/general/strings.js";

export function validateRequired(): void {
  // Always required environment variables
  if (!process.env.DISCORD_TOKEN) {
    throw new ReferenceError("DISCORD_TOKEN environment variable was not set!");
  }
  if (!process.env.DB_URL) {
    throw new ReferenceError("DB_URL environment variable was not set!");
  }
  if (!process.env.DISCORD_CLIENT_ID) {
    throw new ReferenceError("DISCORD_CLIENT_ID environment variable was not set!");
  }

  // Validate form of DISCORD_CLIENT_ID
  if (!isOnlyDigits(process.env.DISCORD_CLIENT_ID)) {
    throw new TypeError("DISCORD_CLIENT_ID environment variable must contain only digits!");
  }
}

export function validateDevelopment(): void {
  if (!process.env.TEST_GUILD_ID) {
    throw new ReferenceError("TEST_GUILD_ID environment variable was not set!");
  }

  // Validate form of TEST_GUILD_ID
  if (!isOnlyDigits(process.env.TEST_GUILD_ID)) {
    throw new TypeError("TEST_GUILD_ID environment variable must contain only digits!");
  }
}
