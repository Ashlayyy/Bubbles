import type { RateLimitData } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent("rateLimit" as any, async (rateLimitData: RateLimitData) => {
  const client = await import("../../structures/Client.js").then((m) => m.default.get());

  try {
    const { method, url, route, limit, timeToReset, global } = rateLimitData;

    logger.warn("Rate limit hit:", {
      method,
      url,
      route,
      limit,
      timeToReset,
      global,
      remaining: limit - 1,
    });

    // Log to database for monitoring
    await client.logManager.log("SYSTEM", "RATE_LIMIT_HIT", {
      executorId: client.user?.id ?? "UNKNOWN",
      metadata: {
        method,
        url: url.replace(/\d+/g, ":id"), // Remove IDs for privacy
        route,
        limit,
        timeToReset,
        global,
        timestamp: new Date().toISOString(),
      },
    });

    // Alert administrators if this is a global rate limit
    if (global) {
      logger.error("GLOBAL RATE LIMIT HIT - This affects all requests!", {
        timeToReset,
        route,
      });

      // You could send alerts to admin channels here
      // await alertAdministrators(client, rateLimitData);
    }

    // If timeout is very high, consider pausing certain operations
    if (timeToReset > 60000) {
      // 1 minute
      logger.error(`High timeout rate limit: ${timeToReset}ms on ${route}`);
    }
  } catch (error) {
    logger.error("Error handling rate limit event:", error);
  }
});

// Uncomment and implement if you want admin alerts
// async function alertAdministrators(client: Client, rateLimitData: RateLimitData): Promise<void> {
//   // Implementation for alerting admins about rate limits
// }
