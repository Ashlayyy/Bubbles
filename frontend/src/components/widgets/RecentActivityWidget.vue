<template>
  <div class="space-y-3">
    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
    <p v-else-if="activities.length === 0" class="text-sm text-muted-foreground">No recent activity yet.</p>
    <div v-for="activity in activities" :key="activity.id" class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm" :class="getActivityColor(activity.type)">
        {{ getActivityIcon(activity.type) }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm text-foreground">{{ activity.description }}</div>
        <div class="text-xs text-muted-foreground">{{ formatTime(activity.timestamp) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { auditEndpoints } from '@/lib/endpoints/audit'

const route = useRoute()
const error = ref('')
const activities = ref<Array<{ id: string; type: string; description: string; timestamp: Date }>>([])

const getActivityIcon = (type: string) => {
  const value = type.toLowerCase()
  if (value.includes('join')) return '✓'
  if (value.includes('ticket')) return '🎫'
  if (value.includes('role')) return '👤'
  if (value.includes('ban') || value.includes('kick')) return '🔨'
  return '•'
}

const getActivityColor = (type: string) => {
  const value = type.toLowerCase()
  if (value.includes('join')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  if (value.includes('ticket')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
  if (value.includes('role')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  if (value.includes('ban') || value.includes('kick')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

const formatTime = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

onMounted(async () => {
  const guildId = String(route.params.guildId || '')
  if (!guildId) return
  try {
    const { data } = await auditEndpoints.getLogs(guildId, { limit: 8 })
    const payload = (data as any)?.data ?? data
    const logs = Array.isArray(payload) ? payload : payload?.logs ?? payload?.audit_log_entries ?? []
    activities.value = logs.slice(0, 8).map((log: any, index: number) => ({
      id: String(log.id ?? index),
      type: String(log.action ?? log.logType ?? log.action_type ?? 'event'),
      description: String(log.reason ?? log.content ?? log.action ?? log.logType ?? 'Server event'),
      timestamp: new Date(log.timestamp ?? log.createdAt ?? Date.now()),
    }))
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Could not load activity.'
  }
})
</script>
