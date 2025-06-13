import type { GuildMember, GuildMembersChunk } from "discord.js";
import { Events } from "discord.js";

import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(
  Events.GuildMembersChunk,
  async (members: ReadonlyMap<string, GuildMember>, guild: import("discord.js").Guild, chunk: GuildMembersChunk) => {
    const client = guild.client as import("../../structures/Client.js").default;

    try {
      await client.logManager.log(guild.id, "GUILD_MEMBERS_CHUNK", {
        metadata: {
          chunkIndex: chunk.index,
          chunkCount: chunk.count,
          membersReceived: members.size,
          notFoundCount: chunk.notFound.length,
          nonce: chunk.nonce,
          totalMembers: guild.memberCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error logging guild members chunk:", error);
    }
  }
);
