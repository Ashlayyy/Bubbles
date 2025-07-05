import type { VoiceState } from "discord.js";
import { Events } from "discord.js";

import logger from "../../logger.js";
import type Client from "../../structures/Client.js";
import { ClientEvent } from "../../structures/Event.js";

export default new ClientEvent(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  const client = newState.client as Client;

  try {
    const guild = newState.guild;

    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    // Log voice state changes for moderation
    await logVoiceStateChange(client, oldState, newState, guild.id, member.id);
  } catch (error) {
    logger.error("Error in voiceStateUpdate event:", error);
  }
});

async function logVoiceStateChange(
  client: Client,
  oldState: VoiceState,
  newState: VoiceState,
  guildId: string,
  userId: string
): Promise<void> {
  try {
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    let logType: string;
    const metadata = {
      userId,
      oldChannelId: oldChannel?.id,
      newChannelId: newChannel?.id,
      oldChannelName: oldChannel?.name,
      newChannelName: newChannel?.name,
      mute: {
        old: oldState.mute,
        new: newState.mute,
      },
      deaf: {
        old: oldState.deaf,
        new: newState.deaf,
      },
      selfMute: {
        old: oldState.selfMute,
        new: newState.selfMute,
      },
      selfDeaf: {
        old: oldState.selfDeaf,
        new: newState.selfDeaf,
      },
      streaming: {
        old: oldState.streaming,
        new: newState.streaming,
      },
      selfVideo: {
        old: oldState.selfVideo,
        new: newState.selfVideo,
      },
    };

    if (!oldChannel && newChannel) {
      logType = "VOICE_JOIN";
    } else if (oldChannel && !newChannel) {
      logType = "VOICE_LEAVE";
    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      logType = "VOICE_MOVE";
    } else {
      // State changes (mute, deaf, etc.)
      if (oldState.mute !== newState.mute) {
        logType = newState.mute ? "VOICE_SERVER_MUTE" : "VOICE_SERVER_UNMUTE";
      } else if (oldState.deaf !== newState.deaf) {
        logType = newState.deaf ? "VOICE_SERVER_DEAFEN" : "VOICE_SERVER_UNDEAFEN";
      } else if (oldState.selfMute !== newState.selfMute) {
        logType = newState.selfMute ? "VOICE_SELF_MUTE" : "VOICE_SELF_UNMUTE";
      } else if (oldState.selfDeaf !== newState.selfDeaf) {
        logType = newState.selfDeaf ? "VOICE_SELF_DEAFEN" : "VOICE_SELF_UNDEAFEN";
      } else if (oldState.streaming !== newState.streaming) {
        logType = newState.streaming ? "VOICE_START_STREAM" : "VOICE_STOP_STREAM";
      } else if (oldState.selfVideo !== newState.selfVideo) {
        logType = newState.selfVideo ? "VOICE_START_VIDEO" : "VOICE_STOP_VIDEO";
      } else if (oldState.suppress !== newState.suppress) {
        logType = "VOICE_STAGE_SPEAKER_CHANGE";
      } else {
        return; // No significant change
      }
    }

    await client.logManager.log(guildId, logType, {
      userId,
      channelId: newChannel?.id ?? oldChannel?.id,
      metadata,
    });
  } catch (error) {
    logger.error("Error logging voice state change:", error);
  }
}
