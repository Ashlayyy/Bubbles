<template>
  <div v-if="channels.length === 0" class="text-sm text-muted-foreground">
    No heatmap data yet.
  </div>
  <div v-else class="space-y-4">
    <div class="grid grid-cols-25 gap-1">
      <div class="text-xs text-muted-foreground"></div>
      <div v-for="hour in 24" :key="hour" class="text-xs text-muted-foreground text-center">
        {{ hour - 1 }}
      </div>
      
      <div v-for="channel in channels" :key="channel" class="space-y-1">
        <div class="text-xs text-muted-foreground truncate w-16">{{ channel }}</div>
        <div v-for="hour in 24" :key="`${channel}-${hour}`" 
             :class="getHeatmapColor(getMessageCount(channel, hour - 1))"
             class="w-4 h-4 rounded-sm"
             :title="`${channel} at ${hour - 1}:00 - ${getMessageCount(channel, hour - 1)} messages`">
        </div>
      </div>
    </div>
    
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Less</span>
      <div class="flex gap-1">
        <div class="w-3 h-3 bg-muted rounded-sm dark:bg-slate-700"></div>
        <div class="w-3 h-3 bg-blue-200 dark:bg-blue-900 rounded-sm"></div>
        <div class="w-3 h-3 bg-blue-400 dark:bg-blue-700 rounded-sm"></div>
        <div class="w-3 h-3 bg-blue-600 dark:bg-blue-500 rounded-sm"></div>
        <div class="w-3 h-3 bg-blue-800 dark:bg-blue-300 rounded-sm"></div>
      </div>
      <span>More</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: Array<{ channel: string; hour: number; messages: number }>
}>()

const channels = computed(() => [...new Set((props.data ?? []).map((entry) => entry.channel))])

const getMessageCount = (channel: string, hour: number) => {
  return (props.data ?? []).find((entry) => entry.channel === channel && entry.hour === hour)?.messages ?? 0
}

const getHeatmapColor = (count: number) => {
  if (count === 0) return 'bg-muted dark:bg-slate-700'
  if (count < 20) return 'bg-blue-200 dark:bg-blue-900'
  if (count < 40) return 'bg-blue-400 dark:bg-blue-700'
  if (count < 60) return 'bg-blue-600 dark:bg-blue-500'
  return 'bg-blue-800 dark:bg-blue-300'
}
</script>
