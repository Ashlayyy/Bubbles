import type { ApplicationCommandPermissionsUpdateData } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  "applicationCommandPermissionsUpdate",
  async (data: ApplicationCommandPermissionsUpdateData) => {
    if (!data.guildId) return;

    // Get client from global instance since data doesn't have guild object
    const Client = (await import("../../structures/Client.js")).default;
    const client = await Client.get();

    // Log the application command permissions update
    await client.logManager.log(data.guildId, "APPLICATION_COMMAND_PERMISSIONS_UPDATE", {
      executorId: undefined, // Discord doesn't provide who made the change
      metadata: {
        applicationId: data.applicationId,
        commandId: data.id,
        guildId: data.guildId,
        permissions: data.permissions.map((perm) => ({
          id: perm.id,
          type: perm.type,
          permission: perm.permission,
        })),
        timestamp: new Date().toISOString(),
      },
    });
  }
);
