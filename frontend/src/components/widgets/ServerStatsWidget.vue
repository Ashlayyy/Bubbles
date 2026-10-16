<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="text-center">
        <div class="text-2xl font-bold text-foreground">{{ formatNumber(stats.memberCount) }}</div>
        <div class="text-sm text-muted-foreground">Total Members</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-green-500">{{ formatNumber(stats.onlineMembers) }}</div>
        <div class="text-sm text-muted-foreground">Online</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="text-center">
        <div class="text-2xl font-bold text-foreground">{{ stats.channelCount }}</div>
        <div class="text-sm text-muted-foreground">Channels</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-foreground">{{ stats.roleCount }}</div>
        <div class="text-sm text-muted-foreground">Roles</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useGuildsStore } from '@/stores/guilds';

const guildsStore = useGuildsStore();
const { currentGuildStats } = storeToRefs(guildsStore);

const stats = computed(() => ({
  memberCount: currentGuildStats.value?.memberCount ?? 0,
  onlineMembers: currentGuildStats.value?.onlineMembers ?? 0,
  channelCount: currentGuildStats.value?.channelCount ?? 0,
  roleCount: currentGuildStats.value?.roleCount ?? 0,
}));

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};
</script>
