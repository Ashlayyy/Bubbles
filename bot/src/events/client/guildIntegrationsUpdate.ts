import type { Guild } from "discord.js";
import { Events } from "discord.js";

import logger from "../../logger.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.GuildIntegrationsUpdate, async (guild: Guild) => {
  const client = guild.client as import("../../structures/Client.js").default;

  try {
    logger.info(`Guild integrations updated in ${guild.name} (${guild.id})`);

    // Log the integration update
    await client.logManager.log(guild.id, "INTEGRATION_UPDATE", {
      executorId: client.user?.id ?? "SYSTEM",
      metadata: {
        guildName: guild.name,
        guildId: guild.id,
        memberCount: guild.memberCount,
        timestamp: new Date().toISOString(),
      },
    });

    // Optional: Check for new bots/integrations and alert administrators
    try {
      const integrations = await guild.fetchIntegrations();

      // Log integration details for monitoring
      await client.logManager.log(guild.id, "INTEGRATION_DETAILS", {
        executorId: client.user?.id ?? "SYSTEM",
        metadata: {
          integrationCount: integrations.size,
          integrationTypes: integrations.map((integration) => integration.type),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (fetchError) {
      logger.warn(`Could not fetch integrations for ${guild.name}:`, fetchError);
    }
  } catch (error) {
    logger.error("Error handling guild integrations update:", error);
  }
});
