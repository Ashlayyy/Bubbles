<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-8">Leveling System</h1>

    <div class="space-y-8 max-w-4xl">
      <LevelingGeneral
        v-model:leveling-enabled="levelingEnabled"
        v-model:xp-per-message="xpPerMessage"
        v-model:xp-cooldown="xpCooldown"
      />

      <LevelingMessage
        :leveling-enabled="levelingEnabled"
        v-model:level-up-message-enabled="levelUpMessageEnabled"
        v-model:level-up-message-destination="levelUpMessageDestination"
        v-model:level-up-channel-id="levelUpChannelId"
        v-model:level-up-message="levelUpMessage"
      />
      
      <LevelingIgnoredItems
        :leveling-enabled="levelingEnabled"
        v-model:ignored-roles="ignoredRoles"
        v-model:ignored-channels="ignoredChannels"
        :all-roles="allRoles"
        :all-channels="allChannels"
      />

      <LevelingMultipliers
        :leveling-enabled="levelingEnabled"
        v-model:xp-multipliers="xpMultipliers"
        :all-roles="allRoles"
        :all-channels="allChannels"
      />

      <LevelingRoleRewards
        :leveling-enabled="levelingEnabled"
        v-model:role-rewards="roleRewards"
        :all-roles="allRoles"
      />

      <LevelingPrestige
        :leveling-enabled="levelingEnabled"
        v-model:prestige-enabled="prestigeEnabled"
        v-model:prestige-level="prestigeLevel"
        v-model:prestige-reward-role-id="prestigeRewardRoleId"
        :all-roles="allRoles"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { DiscordItem } from '@/types/discord';
import LevelingGeneral from '@/components/leveling/LevelingGeneral.vue';
import LevelingMessage from '@/components/leveling/LevelingMessage.vue';
import LevelingMultipliers from '@/components/leveling/LevelingMultipliers.vue';
import LevelingRoleRewards from '@/components/leveling/LevelingRoleRewards.vue';
import LevelingPrestige from '@/components/leveling/LevelingPrestige.vue';
import LevelingIgnoredItems from '@/components/leveling/LevelingIgnoredItems.vue';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const levelingEnabled = ref(true);
const xpPerMessage = ref(15);
const xpCooldown = ref(60);

const levelUpMessageEnabled = ref(true);
const levelUpMessageDestination = ref('current');
const levelUpChannelId = ref('');
const levelUpMessage = ref('GG {user}, you reached level {level}!');

interface RoleReward {
  level: number;
  roleId: string;
  roleName: string; // For display purposes
}

const roleRewards = ref<RoleReward[]>([
  { level: 5, roleId: '123', roleName: 'Active Member' },
  { level: 10, roleId: '456', roleName: 'Regular' },
  { level: 25, roleId: '789', roleName: 'Enthusiast' },
]);

interface XPMultiplier {
  uid: string;
  type: 'role' | 'channel';
  id: string;
  name: string; // for display
  multiplier: number;
}

const xpMultipliers = ref<XPMultiplier[]>([
  { uid: 'mult-1', type: 'role', id: 'role-booster', name: 'Server Booster', multiplier: 2 },
  { uid: 'mult-2', type: 'channel', id: 'channel-events', name: 'events', multiplier: 1.5 },
]);

const ignoredRoles = ref<string[]>(['role-admin', 'role-bot']);
const ignoredChannels = ref<string[]>(['channel-staff-chat']);

const prestigeEnabled = ref(false);
const prestigeLevel = ref(100);
const prestigeRewardRoleId = ref('');

// --- Mock Data for Selectors ---
const allRoles = ref<DiscordItem[]>([
  { id: 'role-admin', name: 'Admin' },
  { id: 'role-moderator', name: 'Moderator' },
  { id: 'role-bot', name: 'Bot' },
  { id: 'role-member', name: 'Member' },
  { id: 'role-nitro-booster', name: 'Nitro Booster' },
  { id: 'role-level-5', name: 'Level 5+' },
  { id: 'role-level-10', name: 'Level 10+' },
  { id: 'role-level-25', name: 'Level 25+' },
]);

const allChannels = ref<DiscordItem[]>([
  { id: 'channel-general', name: 'general' },
  { id: 'channel-announcements', name: 'announcements' },
  { id: 'channel-off-topic', name: 'off-topic' },
  { id: 'channel-bot-commands', name: 'bot-commands' },
  { id: 'channel-staff-chat', name: 'staff-chat' },
  { id: 'channel-memes', name: 'memes' },
  { id: 'channel-art', name: 'art' },
]);

// Watch for changes and show save confirmations
const saveAllSettings = () => {
  // In a real app, this would save all settings to the backend
  toastStore.addToast('All leveling settings saved successfully!', 'success');
};
</script>