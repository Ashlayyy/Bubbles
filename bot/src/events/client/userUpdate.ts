import type { PartialUser, User } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.UserUpdate, async (oldUser: User | PartialUser, newUser: User) => {
  const client = newUser.client as import("../../structures/Client.js").default;
  const startTime = Date.now();

  // Compare user changes
  const changes: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Check for username changes
  if (oldUser.username !== newUser.username) {
    changes.push("username");
    before.username = oldUser.username;
    after.username = newUser.username;
  }

  // Check for discriminator changes (legacy feature)
  if (oldUser.discriminator !== newUser.discriminator) {
    changes.push("discriminator");
    before.discriminator = oldUser.discriminator;
    after.discriminator = newUser.discriminator;
  }

  // Check for avatar changes
  if (oldUser.avatar !== newUser.avatar) {
    changes.push("avatar");
    before.avatar = oldUser.avatar;
    after.avatar = newUser.avatar;
  }

  // Check for banner changes
  if (oldUser.banner !== newUser.banner) {
    changes.push("banner");
    before.banner = oldUser.banner;
    after.banner = newUser.banner;
  }

  // Check for accent color changes
  if (oldUser.accentColor !== newUser.accentColor) {
    changes.push("accentColor");
    before.accentColor = oldUser.accentColor;
    after.accentColor = newUser.accentColor;
  }

  // Only log if there are changes and we can find guilds this user is in
  if (changes.length > 0) {
    // Get all guilds this user is in (from cache) - optimized
    const guilds = client.guilds.cache.filter((guild) => guild.members.cache.has(newUser.id));

    if (guilds.size > 0) {
      // Log to all guilds where this user is a member (async)
      const logPromises = guilds.map(async (guild) => {
        try {
          await client.logManager.log(guild.id, "USER_UPDATE", {
            userId: newUser.id,
            before: JSON.stringify(before),
            after: JSON.stringify(after),
            metadata: {
              username: newUser.username,
              displayName: newUser.displayName,
              changes,
              oldTag: `${oldUser.username}#${oldUser.discriminator}`,
              newTag: `${newUser.username}#${newUser.discriminator}`,
              oldAvatarURL: oldUser.displayAvatarURL(),
              newAvatarURL: newUser.displayAvatarURL(),
              timestamp: new Date().toISOString(),
              processingTime: Date.now() - startTime,
            },
          });
        } catch (error) {
          console.error(`Failed to log user update for guild ${guild.id}:`, error);
        }
      });

      // Wait for all logging operations to complete
      try {
        await Promise.allSettled(logPromises);
        const totalTime = Date.now() - startTime;

        // Log performance if it's slow
        if (totalTime > 1000) {
          console.warn(
            `Slow user update processing: ${totalTime}ms for user ${newUser.id} across ${guilds.size} guilds`
          );
        }
      } catch (error) {
        console.error("Error in user update event:", error);
      }
    }
  }
});
