import type { Invite } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.InviteDelete, async (invite: Invite) => {
  // Only process guild invites
  if (!invite.guild) return;

  const client = invite.client as import("../../structures/Client.js").default;

  // Log the invite deletion
  await client.logManager.log(invite.guild.id, "INVITE_DELETE", {
    channelId: invite.channel?.id,
    executorId: invite.inviter?.id,
    reason: "No reason provided",
    metadata: {
      inviteCode: invite.code,
      inviterUsername: invite.inviter?.username,
      inviterId: invite.inviter?.id,
      channelName: invite.channel && "name" in invite.channel ? invite.channel.name : "Unknown",
      channelType: invite.channel?.type,
      uses: invite.uses,
      maxUses: invite.maxUses,
      temporary: invite.temporary,
      createdAt: invite.createdAt?.toISOString(),
      timestamp: new Date().toISOString(),
    },
  });
});
