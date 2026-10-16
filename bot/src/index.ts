import "./functions/general/environmentLoader.js";

// OpenTelemetry must be imported first for auto-instrumentation
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

// Start the SDK
sdk.start();

// Initialize Sentry for error tracking
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [Sentry.httpIntegration()],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out noisy errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.type === "DiscordAPIError" || error?.value?.includes("Unknown interaction")) {
          return null; // Don't send to Sentry
        }
      }
      return event;
    },
  });

  // Capture unhandled rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    Sentry.captureException(reason);
  });

  // Capture uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    Sentry.captureException(error);
    process.exit(1);
  });
}

import { isConfiguredEnv, isDevEnvironment } from "./functions/general/environment.js";
import Client from "./structures/Client.js";

if (!isConfiguredEnv(process.env.DISCORD_TOKEN)) {
  const hint = isDevEnvironment()
    ? "Set DISCORD_TOKEN (and DISCORD_CLIENT_ID) in the Bubbles repo-root .env file, then save it. Nodemon will restart."
    : "DISCORD_TOKEN must be set to start the bot.";
  console.error(`DISCORD_TOKEN is not set. ${hint}`);
  if (!isDevEnvironment()) {
    process.exit(1);
  }
  console.error("Waiting instead of crashing so other npm run all processes can keep running.");
  await new Promise(() => undefined);
} else {
  const client = await Client.get();
  await client.start();
}
