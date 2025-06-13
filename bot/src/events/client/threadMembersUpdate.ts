import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.ThreadMembersUpdate, async (addedMembers, removedMembers, thread) => {
  const client = thread.client as import("../../structures/Client.js").default;

  try {
    if (addedMembers.size > 0 || removedMembers.size > 0) {
      const addedArray = Array.from(addedMembers.values());
      const removedArray = Array.from(removedMembers.values());

      await client.logManager.log(thread.guild.id, "THREAD_MEMBERS_UPDATE", {
        channelId: thread.id,
        metadata: {
          threadName: thread.name,
          threadId: thread.id,
          addedMembers: addedArray.map((member) => member.user?.id ?? member.id),
          removedMembers: removedArray.map((member) => member.user?.id ?? member.id),
          addedCount: addedMembers.size,
          removedCount: removedMembers.size,
          totalMembers: thread.memberCount,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error("Error logging thread members update:", error);
  }
});
