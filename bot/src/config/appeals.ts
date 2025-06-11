export const APPEALS_OAUTH_CONFIG = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ?? "",
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ?? "",
  DEFAULT_WEBSITE_URL: process.env.APPEALS_WEBSITE_URL ?? "https://appeals.yourdomain.com",
} as const;

export type AppealsOAuthConfig = typeof APPEALS_OAUTH_CONFIG;
