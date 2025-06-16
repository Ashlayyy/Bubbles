<template>
  <div class="p-8 text-white">
    <LoggingHeader />

    <div class="space-y-8">
      <LoggingPresets
        v-model:masterEnabled="masterEnabled"
        :active-preset="activePreset"
        :presets="LOGGING_PRESETS"
        @apply-preset="applyPreset"
      />

      <LoggingDestination
        v-model:channelMode="channelMode"
        v-model:singleLogChannel="singleLogChannel"
        :available-channels="availableChannels"
      />

      <LoggingCategory
        v-for="(category, key) in logEvents"
        :key="key"
        :category="category"
        :category-key="String(key)"
        :channel-mode="channelMode"
        :available-channels="availableChannels"
        @update:category-channel="updateCategoryChannel"
        @update:event-value="updateEventValue"
      />
      
      <LoggingIgnoredItems
        :all-roles="allRoles"
        :all-channels="availableChannels"
        v-model:ignored-roles="ignoredRoles"
        v-model:ignored-channels="ignoredChannels"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import LoggingHeader from '@/components/logging/LoggingHeader.vue';
import LoggingPresets from '@/components/logging/LoggingPresets.vue';
import LoggingDestination from '@/components/logging/LoggingDestination.vue';
import LoggingCategory from '@/components/logging/LoggingCategory.vue';
import LoggingIgnoredItems from '@/components/logging/LoggingIgnoredItems.vue';
import type { DiscordItem } from '@/types/discord';

const channelMode = ref<'single' | 'multiple'>('single')
const singleLogChannel = ref<string | null>(null)

const masterEnabled = ref(true)

const availableChannels = ref<DiscordItem[]>([
  { id: 'c1', name: 'general' },
  { id: 'c2', name: 'moderation-log' },
  { id: 'c3', name: 'server-events' },
  { id: 'c4', name: 'welcome' },
])

const allRoles = ref<DiscordItem[]>([
  { id: 'r1', name: 'Member' },
  { id: 'r2', name: 'Moderator' },
  { id: 'r3', name: 'Admin' },
  { id: 'r4', name: 'Muted' },
  { id: 'r5', name: 'Bot' },
]);

const ignoredRoles = ref<string[]>(['r5']); // Ignore bots by default
const ignoredChannels = ref<string[]>([]);

const LOG_CATEGORIES = {
  HIGH_VOLUME: [ "MESSAGE_CREATE", "VOICE_SELF_MUTE", "VOICE_SELF_UNMUTE", "VOICE_SELF_DEAFEN", "VOICE_SELF_UNDEAFEN", "VOICE_START_STREAM", "VOICE_STOP_STREAM", "VOICE_START_VIDEO", "VOICE_STOP_VIDEO", "MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE", "MEMBER_STATUS_CHANGE", "MEMBER_COME_ONLINE", "MEMBER_GO_OFFLINE", "MESSAGE_ATTACHMENT_DELETE", "MESSAGE_EMBED_UPDATE", "MESSAGE_CROSSPOST", "MESSAGE_SUPPRESS_EMBEDS", "STICKER_USAGE", "VOICE_STAGE_SPEAKER_CHANGE" ],
  MESSAGE: [ "MESSAGE_DELETE", "MESSAGE_EDIT", "MESSAGE_BULK_DELETE", "MESSAGE_PIN", "MESSAGE_REACTION_CLEAR", "MESSAGE_THREAD_CREATE", "MESSAGE_AUTOMOD_TRIGGER", "MESSAGE_SPAM_DETECTED", "MESSAGE_LINK_FILTER", "REACTION_ADD", "REACTION_REMOVE", "REACTION_EMOJI_REMOVE", "REACTION_REMOVE_ALL" ],
  MEMBER: [ "MEMBER_JOIN", "MEMBER_LEAVE", "MEMBER_UPDATE", "MEMBER_TIMEOUT", "MEMBER_TIMEOUT_REMOVE", "MEMBER_KICK", "MEMBER_BAN", "MEMBER_UNBAN", "MEMBER_NICKNAME_CHANGE", "MEMBER_AVATAR_CHANGE", "MEMBER_BOOST_START", "MEMBER_BOOST_STOP", "MEMBER_PENDING_UPDATE", "MEMBER_FLAGS_UPDATE", "MEMBER_ROLE_ADD", "MEMBER_ROLE_REMOVE", "MEMBER_ROLE_UPDATE", "MEMBER_COMMUNICATION_DISABLED", "MEMBER_MOVE", "MEMBER_MENTION_SPAM" ],
  ROLE: [ "ROLE_CREATE", "ROLE_DELETE", "ROLE_UPDATE", "ROLE_PERMISSIONS_UPDATE", "ROLE_NAME_CHANGE", "ROLE_COLOR_CHANGE", "ROLE_POSITION_CHANGE", "ROLE_MENTIONABLE_CHANGE", "ROLE_HOIST_CHANGE", "ROLE_ICON_CHANGE", "ROLE_UNICODE_EMOJI_CHANGE", "ROLE_MASS_ASSIGNMENT" ],
  CHANNEL: [ "CHANNEL_CREATE", "CHANNEL_DELETE", "CHANNEL_UPDATE", "CHANNEL_NAME_CHANGE", "CHANNEL_TOPIC_CHANGE", "CHANNEL_PERMISSION_UPDATE", "CHANNEL_SLOWMODE_CHANGE", "CHANNEL_NSFW_CHANGE", "CHANNEL_POSITION_CHANGE", "CHANNEL_CATEGORY_CHANGE", "CHANNEL_RATE_LIMIT_CHANGE", "CHANNEL_THREAD_CREATE", "CHANNEL_THREAD_DELETE", "CHANNEL_THREAD_UPDATE", "CHANNEL_THREAD_ARCHIVE", "CHANNEL_THREAD_UNARCHIVE", "CHANNEL_THREAD_LOCK", "CHANNEL_FORUM_TAG_UPDATE" ],
  VOICE: [ "VOICE_JOIN", "VOICE_LEAVE", "VOICE_MOVE", "VOICE_MUTE", "VOICE_UNMUTE", "VOICE_DEAFEN", "VOICE_UNDEAFEN", "VOICE_STREAM_START", "VOICE_STREAM_STOP", "VOICE_SERVER_MUTE", "VOICE_SERVER_UNMUTE", "VOICE_SERVER_DEAFEN", "VOICE_SERVER_UNDEAFEN" ],
  SERVER: [ "SERVER_UPDATE", "SERVER_NAME_CHANGE", "SERVER_ICON_CHANGE", "SERVER_BANNER_CHANGE", "SERVER_SPLASH_CHANGE", "SERVER_DISCOVERY_SPLASH_CHANGE", "SERVER_AFK_CHANNEL_CHANGE", "SERVER_AFK_TIMEOUT_CHANGE", "SERVER_WIDGET_CHANGE", "SERVER_VERIFICATION_LEVEL_CHANGE", "SERVER_EXPLICIT_CONTENT_FILTER_CHANGE", "SERVER_MFA_LEVEL_CHANGE", "SERVER_SYSTEM_CHANNEL_CHANGE", "SERVER_RULES_CHANNEL_CHANGE", "SERVER_PUBLIC_UPDATES_CHANNEL_CHANGE", "GUILD_UPDATE", "GUILD_UNAVAILABLE" ],
  MODERATION: [ "MOD_CASE_CREATE", "MOD_CASE_UPDATE", "MOD_CASE_NOTE_ADD", "MOD_WARN_ISSUED", "MOD_MUTE_ISSUED", "MOD_UNMUTE_ISSUED", "MOD_APPEAL_SUBMITTED", "MOD_APPEAL_APPROVED", "MOD_APPEAL_DENIED", "MOD_AUTOMOD_ACTION", "MOD_MASS_BAN", "MOD_RAID_DETECTED", "MOD_ESCALATION_TRIGGERED", "MOD_SCHEDULED_ACTION", "MOD_MANUAL_ACTION" ],
  INVITE: ["INVITE_CREATE", "INVITE_DELETE", "INVITE_USE", "INVITE_EXPIRE", "INVITE_VANITY_UPDATE", "INVITE_TRACKING"],
  EMOJI: [ "EMOJI_CREATE", "EMOJI_DELETE", "EMOJI_UPDATE", "EMOJI_NAME_CHANGE", "STICKER_CREATE", "STICKER_DELETE", "STICKER_UPDATE" ],
  WEBHOOK: ["WEBHOOK_CREATE", "WEBHOOK_DELETE", "WEBHOOK_UPDATE", "WEBHOOK_MESSAGE", "WEBHOOK_TOKEN_RESET"],
  BOT: [ "BOT_ADD", "BOT_REMOVE", "BOT_PERMISSIONS_UPDATE", "BOT_GUILD_JOIN", "BOT_GUILD_LEAVE", "APPLICATION_COMMAND_CREATE", "APPLICATION_COMMAND_DELETE", "APPLICATION_COMMAND_UPDATE", "APPLICATION_COMMAND_USE", "APPLICATION_COMMAND_PERMISSIONS_UPDATE", "INTEGRATION_UPDATE", "INTEGRATION_DETAILS" ],
  REACTION_ROLE: [ "REACTION_ROLE_ADDED", "REACTION_ROLE_REMOVED", "REACTION_ROLE_CONFIG_ADD", "REACTION_ROLE_CONFIG_REMOVE", "REACTION_ROLE_MESSAGE_CREATE", "REACTION_ROLE_MESSAGE_UPDATE", "REACTION_ROLE_MESSAGE_DELETE", "REACTION_ROLE_ERROR" ],
  AUTOMOD: [ "AUTOMOD_RULE_CREATE", "AUTOMOD_RULE_DELETE", "AUTOMOD_RULE_UPDATE", "AUTOMOD_RULE_TRIGGER", "AUTOMOD_ACTION_EXECUTE", "AUTOMOD_BYPASS", "AUTOMOD_RULE_TOGGLE" ],
  SYSTEM: [ "RATE_LIMIT_HIT", "INVALID_REQUEST_WARNING", "WEBHOOKS_UPDATE", "GUILD_MEMBERS_CHUNK", "CLIENT_INVALIDATED", "GUILD_MEMBER_AVAILABLE", "SHARD_DISCONNECT", "SHARD_ERROR", "SHARD_READY", "SHARD_RECONNECTING", "SHARD_RESUME" ],
  TICKET: ["TICKET_CREATE", "TICKET_CLOSE", "TICKET_CLAIM", "TICKET_CONFIG_CHANGE", "TICKET_PANEL_CREATE"],
  COMMAND: ["COMMAND_USERINFO", "COMMAND_SERVERINFO", "COMMAND_AVATAR"],
  POLL: ["POLL_CREATE", "POLL_END"],
  THREAD: ["THREAD_CREATE", "THREAD_DELETE", "THREAD_UPDATE", "THREAD_LIST_SYNC", "THREAD_MEMBERS_UPDATE"],
  SCHEDULED_EVENT: [ "SCHEDULED_EVENT_CREATE", "SCHEDULED_EVENT_UPDATE", "SCHEDULED_EVENT_DELETE", "SCHEDULED_EVENT_USER_ADD", "SCHEDULED_EVENT_USER_REMOVE" ],
  USER: ["USER_UPDATE"],
  WELCOME: ["WELCOME_CONFIG"],
  CHANNEL_PINS: ["CHANNEL_PINS_UPDATE"],
} as const;

const STANDARD_LOG_TYPES = Object.entries(LOG_CATEGORIES)
  .filter(([category]) => category !== "HIGH_VOLUME")
  .flatMap(([, types]) => types)
  .filter((type) => {
    const excludeSpecific = [ "APPLICATION_COMMAND_USE", "COMMAND_USERINFO", "COMMAND_SERVERINFO", "COMMAND_AVATAR", "THREAD_LIST_SYNC", "THREAD_MEMBERS_UPDATE", "GUILD_MEMBERS_CHUNK", "CHANNEL_PINS_UPDATE" ];
    return !excludeSpecific.includes(type);
  });

const LOGGING_PRESETS = [
  {
    name: "Essential Logging",
    emoji: "📝",
    logTypes: ["MESSAGE_DELETE", "MESSAGE_EDIT", "MEMBER_JOIN", "MEMBER_LEAVE", "MEMBER_BAN", "MEMBER_KICK"],
  },
  {
    name: "Comprehensive Logging",
    emoji: "📊",
    logTypes: STANDARD_LOG_TYPES,
  },
  {
    name: "Security Focused",
    emoji: "🔒",
    logTypes: [
      ...LOG_CATEGORIES.MODERATION,
      ...LOG_CATEGORIES.MEMBER,
      ...LOG_CATEGORIES.ROLE,
      ...LOG_CATEGORIES.SERVER,
      ...LOG_CATEGORIES.BOT,
      ...LOG_CATEGORIES.WEBHOOK,
      ...LOG_CATEGORIES.AUTOMOD,
      ...LOG_CATEGORIES.REACTION_ROLE,
      "MESSAGE_DELETE",
      "MESSAGE_EDIT",
      "INVITE_CREATE",
      "INVITE_DELETE",
    ],
  },
  {
    name: "Community Server",
    emoji: "👥",
    logTypes: [
      ...LOG_CATEGORIES.MESSAGE.filter((type) => !["MESSAGE_CREATE"].includes(type)),
      ...LOG_CATEGORIES.MEMBER,
      ...LOG_CATEGORIES.VOICE.filter((type) => !type.startsWith("VOICE_SELF")),
      ...LOG_CATEGORIES.MODERATION,
      ...LOG_CATEGORIES.REACTION_ROLE,
      ...LOG_CATEGORIES.INVITE,
    ],
  },
];

const activePreset = ref<string | null>(null);

const formatLabel = (str: string) => {
  return str.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

type LogEvents = Record<string, { label: string; channel: string | null; events: Record<string, { label: string; value: boolean; recommended: boolean }>}>

const generateLogEvents = (): LogEvents => {
  const newLogEvents: LogEvents = {};
  
  for (const categoryKey in LOG_CATEGORIES) {
    const categoryData = LOG_CATEGORIES[categoryKey as keyof typeof LOG_CATEGORIES];
    const events: Record<string, { label: string; value: boolean; recommended: boolean }> = {};
    
    for (const eventType of categoryData) {
      const isRecommended = STANDARD_LOG_TYPES.includes(eventType as any);
      events[eventType] = {
        label: formatLabel(eventType),
        value: isRecommended,
        recommended: isRecommended,
      };
    }
    
    newLogEvents[categoryKey] = {
      label: formatLabel(categoryKey),
      channel: null,
      events: events,
    };
  }
  return newLogEvents;
};

const logEvents = ref(generateLogEvents());

const applyPreset = (presetName: string) => {
  activePreset.value = presetName;

  if (presetName === 'all') {
    for (const category of Object.values(logEvents.value)) {
      for (const event of Object.values(category.events)) {
        event.value = true;
      }
    }
    return;
  }

  if (presetName === 'none') {
    for (const category of Object.values(logEvents.value)) {
      for (const event of Object.values(category.events)) {
        event.value = false;
      }
    }
    return;
  }

  const preset = LOGGING_PRESETS.find(p => p.name === presetName);
  if (!preset) return;

  const enabledTypes = new Set(preset.logTypes);

  for (const category of Object.values(logEvents.value)) {
    for (const eventKey in category.events) {
      category.events[eventKey].value = enabledTypes.has(eventKey);
    }
  }
}

watch(masterEnabled, (newValue) => {
  if (!newValue) {
    applyPreset('none')
  }
})

// Set initial state to Comprehensive Logging
onMounted(() => {
  applyPreset('Comprehensive Logging');
});

const updateCategoryChannel = (categoryKey: string, channel: string | null) => {
  if (logEvents.value[categoryKey]) {
    logEvents.value[categoryKey].channel = channel;
  }
}

const updateEventValue = (categoryKey: string, eventKey: string, value: boolean) => {
  if (logEvents.value[categoryKey] && logEvents.value[categoryKey].events[eventKey]) {
    logEvents.value[categoryKey].events[eventKey].value = value;
  }
}
</script>
