
<template>
  <div class="flex items-center gap-2">
    <button @click="$emit('action', 'warn')" class="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-500/20 dark:hover:bg-yellow-500/30 dark:text-yellow-300 font-semibold px-3 py-1.5 rounded-lg text-sm transition-colors">Warn</button>
    <button @click="$emit('action', 'mute')" class="bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-300 font-semibold px-3 py-1.5 rounded-lg text-sm transition-colors">Mute</button>
    <button @click="$emit('action', 'kick')" class="bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-300 font-semibold px-3 py-1.5 rounded-lg text-sm transition-colors">Kick</button>
    <button @click="$emit('action', 'ban')" class="bg-red-200 hover:bg-red-300 text-red-900 dark:bg-red-700/50 dark:hover:bg-red-700/70 dark:text-red-200 font-semibold px-3 py-1.5 rounded-lg text-sm transition-colors">Ban</button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'action', action: 'warn' | 'mute' | 'kick' | 'ban'): void
}>()
</script>
