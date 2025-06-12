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

    // Handle music player voice events
    await handleMusicPlayerEvents(client, oldState, newState);

    // Log voice state changes for moderation
    await logVoiceStateChange(client, oldState, newState, guild.id, member.id);
  } catch (error) {
    logger.error("Error in voiceStateUpdate event:", error);
  }
});

async function handleMusicPlayerEvents(client: Client, oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    const { useMainPlayer } = await import("discord-player");
    const player = useMainPlayer();

    const guild = newState.guild;

    const queue = player.queues.get(guild.id);
    if (!queue?.connection) return;

    const botVoiceChannel = queue.connection.joinConfig.channelId;
    if (!botVoiceChannel) return;

    // Check if bot is alone in voice channel
    const voiceChannel = guild.channels.cache.get(botVoiceChannel);
    if (!voiceChannel?.isVoiceBased()) return;

    const members = voiceChannel.members.filter((member) => !member.user.bot);

    if (members.size === 0) {
      // Bot is alone - pause and set timeout
      if (queue.isPlaying()) {
        queue.node.pause();
        logger.info(`Music paused in ${guild.name} - bot alone in voice channel`);
      }

      // Set timeout to leave after 5 minutes
      setTimeout(
        () => {
          const currentQueue = player.queues.get(guild.id);
          if (currentQueue) {
            const currentChannel = guild.channels.cache.get(botVoiceChannel);
            if (currentChannel?.isVoiceBased()) {
              const currentMembers = currentChannel.members.filter((m) => !m.user.bot);
              if (currentMembers.size === 0) {
                currentQueue.delete();
                logger.info(`Left voice channel in ${guild.name} due to inactivity`);
              }
            }
          }
        },
        5 * 60 * 1000
      ); // 5 minutes
    } else if (queue.node.isPaused() && !queue.isEmpty()) {
      // Resume if someone joins and music was paused due to emptiness
      queue.node.resume();
      logger.info(`Music resumed in ${guild.name} - member joined voice channel`);
    }
  } catch (error) {
    logger.error("Error handling music player voice events:", error);
  }
}

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
