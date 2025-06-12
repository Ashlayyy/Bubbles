import type { Presence } from "discord.js";
import { ActivityType, Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.PresenceUpdate, async (oldPresence: Presence | null, newPresence: Presence) => {
  const client = newPresence.client as import("../../structures/Client.js").default;

  try {
    if (!newPresence.guild) return;

    const user = newPresence.user;
    if (!user || user.bot) return; // Skip bots to reduce noise

    const oldStatus = oldPresence?.status ?? "offline";
    const newStatus = newPresence.status;

    // Only log significant status changes (not just activity changes)
    if (oldStatus !== newStatus) {
      // Log status changes for monitoring
      await client.logManager.log(newPresence.guild.id, "MEMBER_STATUS_CHANGE", {
        userId: user.id,
        metadata: {
          username: user.username,
          discriminator: user.discriminator,
          oldStatus,
          newStatus,
          timestamp: new Date().toISOString(),
        },
      });

      // Log going online/offline for activity tracking
      if (oldStatus === "offline" && newStatus !== "offline") {
        await client.logManager.log(newPresence.guild.id, "MEMBER_COME_ONLINE", {
          userId: user.id,
          metadata: {
            username: user.username,
            newStatus,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (oldStatus !== "offline" && newStatus === "offline") {
        await client.logManager.log(newPresence.guild.id, "MEMBER_GO_OFFLINE", {
          userId: user.id,
          metadata: {
            username: user.username,
            oldStatus,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Track activity changes (games, streaming, etc.) - but only for significant changes
    const oldActivity = oldPresence?.activities[0];

    if (newPresence.activities.length > 0) {
      const newActivity = newPresence.activities[0];

      if (oldActivity?.name !== newActivity.name) {
        // Only log if it's a streaming activity
        if (newActivity.type === ActivityType.Streaming) {
          await client.logManager.log(newPresence.guild.id, "MEMBER_START_STREAMING", {
            userId: user.id,
            metadata: {
              username: user.username,
              activityName: newActivity.name,
              activityDetails: newActivity.details,
              streamUrl: newActivity.url,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error("Error handling presence update:", error);
  }
});
