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
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    Sentry.captureException(reason);
  });

  // Capture uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    Sentry.captureException(error);
    process.exit(1);
  });
}

// Load environment variables first, before any other imports
import { loadEnvironment } from "./functions/general/environmentLoader.js";
loadEnvironment();

import logger from "./logger.js";
import Client from "./structures/Client.js";

const client = await Client.get();
await client.start();

// Start periodic voice XP processing
import { levelingService } from "./services/levelingService.js";
setInterval(() => {
  (async () => {
    try {
      await levelingService.processVoiceXP();
    } catch (error) {
      logger.error("Error processing voice XP:", error);
    }
  })();
}, 60000); // Process every minute

// Start periodic database sync (every 15 minutes)
setInterval(() => {
  (async () => {
    try {
      await levelingService.syncAllUserData();
    } catch (error) {
      logger.error("Error syncing user data:", error);
    }
  })();
}, 900000); // Sync every 15 minutes
