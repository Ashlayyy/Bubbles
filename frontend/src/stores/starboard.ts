import { defineStore } from 'pinia';
import { ref } from 'vue';
import { starboardEndpoints } from '@/lib/endpoints/starboard';

export interface StarboardMessage {
  id: string;
  messageId: string;
  channelId: string;
  channel: string;
  authorId: string;
  author: {
    username: string;
    avatar: string;
  };
  content: string;
  attachments: string[];
  starCount: number;
  starboardMessageId?: string;
  createdAt: string;
  starredAt: string;
  timestamp: string;
  jumpUrl: string;
}

export interface StarboardSettings {
  enabled: boolean;
  channelId: string;
  channelName: string;
  minStars: number;
  emoji: string;
  allowSelfStar: boolean;
  removeOnUnstar: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  deleteInvalid: boolean;
}

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

export const useStarboardStore = defineStore('starboard', () => {
  const settings = ref<StarboardSettings>({
    enabled: false,
    channelId: '',
    channelName: '',
    minStars: 3,
    emoji: '⭐',
    allowSelfStar: false,
    removeOnUnstar: true,
    ignoredChannels: [],
    ignoredRoles: [],
    deleteInvalid: true,
  });
  const starredMessages = ref<StarboardMessage[]>([]);
  const stats = ref({
    totalStars: 0,
    totalMessages: 0,
    topMessage: 0,
  });

  const load = async (guildId: string) => {
    const [settingsRes, messagesRes, statsRes] = await Promise.all([
      starboardEndpoints.getSettings(guildId),
      starboardEndpoints.getMessages(guildId),
      starboardEndpoints.stats(guildId),
    ]);
    const raw = unwrap<{
      isEnabled?: boolean;
      channelId?: string | null;
      threshold?: number;
      emoji?: string;
      selfStar?: boolean;
      ignoredChannels?: string[];
      ignoredRoles?: string[];
    }>(settingsRes.data);
    settings.value = {
      enabled: Boolean(raw.isEnabled),
      channelId: raw.channelId || '',
      channelName: '',
      minStars: raw.threshold ?? 3,
      emoji: raw.emoji || '⭐',
      allowSelfStar: Boolean(raw.selfStar),
      removeOnUnstar: true,
      ignoredChannels: raw.ignoredChannels || [],
      ignoredRoles: raw.ignoredRoles || [],
      deleteInvalid: true,
    };

    const messagePayload = unwrap<{ messages?: StarboardMessage[] } | StarboardMessage[]>(
      messagesRes.data
    );
    starredMessages.value = Array.isArray(messagePayload)
      ? messagePayload
      : messagePayload.messages ?? [];

    const statsPayload = unwrap<{
      totalStars?: number;
      totalMessages?: number;
      topMessage?: number;
    }>(statsRes.data);
    stats.value = {
      totalStars: statsPayload.totalStars ?? starredMessages.value.reduce((sum, msg) => sum + (msg.starCount || 0), 0),
      totalMessages: statsPayload.totalMessages ?? starredMessages.value.length,
      topMessage:
        statsPayload.topMessage ??
        starredMessages.value.reduce((max, msg) => Math.max(max, msg.starCount || 0), 0),
    };
  };

  const updateSettings = async (guildId: string, newSettings: Partial<StarboardSettings>) => {
    settings.value = { ...settings.value, ...newSettings };
    await starboardEndpoints.updateSettings(guildId, {
      enabled: settings.value.enabled,
      channelId: settings.value.channelId,
      minStars: settings.value.minStars,
      emoji: settings.value.emoji,
      allowSelfStar: settings.value.allowSelfStar,
      ignoredChannels: settings.value.ignoredChannels,
      ignoredRoles: settings.value.ignoredRoles,
    });
  };

  return {
    settings,
    starredMessages,
    stats,
    load,
    updateSettings,
  };
});
