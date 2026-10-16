<template>
  <div class="space-y-3">
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

const activities = ref([
  {
    id: '1',
    type: 'member_join',
    description: 'New member @user123 joined the server',
    timestamp: new Date(Date.now() - 2 * 60 * 1000)
  },
  {
    id: '2',
    type: 'ticket_created',
    description: 'Support ticket #5821 created by @helpme',
    timestamp: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: '3',
    type: 'role_assigned',
    description: 'Role "VIP" assigned to @anotheruser',
    timestamp: new Date(Date.now() - 60 * 60 * 1000)
  },
  {
    id: '4',
    type: 'member_banned',
    description: 'Member @spammer was banned',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000)
  }
])

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'member_join': return '✓'
    case 'ticket_created': return '🎫'
    case 'role_assigned': return '👤'
    case 'member_banned': return '🔨'
    default: return '•'
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'member_join': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'ticket_created': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'role_assigned': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    case 'member_banned': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
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

onMounted(() => {
  // Load real activity from API
})
</script>