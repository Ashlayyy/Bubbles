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
import { ref, onMounted } from 'vue'

const stats = ref({
  memberCount: 12346,
  onlineMembers: 3421,
  channelCount: 42,
  roleCount: 28
})

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num)
}

onMounted(() => {
  // Load real stats from API
})
</script>