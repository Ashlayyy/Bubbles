import type { InvalidRequestWarningData } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  "invalidRequestWarning" as any,
  async (invalidRequestWarningData: InvalidRequestWarningData) => {
    const client = await import("../../structures/Client.js").then((m) => m.default.get());

    try {
      const { count, remainingTime } = invalidRequestWarningData;

      logger.error("Invalid request warning received!", {
        invalidRequests: count,
        remainingTime,
        threshold: 10000, // Discord bans at 10k invalid requests in 10 minutes
        percentageReached: (count / 10000) * 100,
      });

      // Log to database for critical monitoring
      await client.logManager.log("SYSTEM", "INVALID_REQUEST_WARNING", {
        executorId: client.user?.id ?? "SYSTEM",
        metadata: {
          count,
          remainingTime,
          timestamp: new Date().toISOString(),
          severity: count > 5000 ? "CRITICAL" : count > 2000 ? "HIGH" : "MEDIUM",
        },
      });

      // Critical alert if approaching ban threshold
      if (count > 5000) {
        logger.error(`🚨 CRITICAL: ${count}/10000 invalid requests! Risk of Discord API ban!`);

        // Here you could implement emergency measures:
        // - Temporarily disable certain commands
        // - Alert administrators via Discord/email
        // - Implement emergency rate limiting
      } else if (count > 2000) {
        logger.warn(`⚠️ WARNING: ${count}/10000 invalid requests approaching threshold`);
      }

      // Optional: Implement automatic slowdown
      if (count > 7500) {
        logger.error("Emergency slowdown activated to prevent API ban");
        // You could implement request queuing/delays here
      }
    } catch (error) {
      logger.error("Error handling invalid request warning:", error);
    }
  }
);
