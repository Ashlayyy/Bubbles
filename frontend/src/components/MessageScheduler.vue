<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Message Scheduler</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Schedule Message
      </button>
    </div>

    <!-- Scheduled Messages List -->
    <div class="space-y-4">
      <div v-if="scheduledMessages.length === 0" class="text-center py-12">
        <div class="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <p class="text-lg font-medium">No scheduled messages</p>
          <p class="text-sm">Schedule your first message to get started</p>
        </div>
      </div>

      <div v-for="message in scheduledMessages" :key="message.id" class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h3 class="font-semibold text-foreground mb-2">{{ message.title }}</h3>
            <div class="text-sm text-muted-foreground space-y-1">
              <div>Channel: #{{ message.channelName }}</div>
              <div>Scheduled: {{ formatDateTime(message.scheduledAt) }}</div>
              <div v-if="message.recurring">Recurring: {{ message.recurring.interval }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span :class="getStatusColor(message.status)" class="px-2 py-1 rounded-full text-xs font-medium">
              {{ message.status }}
            </span>
            <button @click="editMessage(message)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button @click="deleteMessage(message.id)" class="text-muted-foreground hover:text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-3">
          <div class="text-sm text-foreground whitespace-pre-wrap">{{ message.content }}</div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <h3 class="text-lg font-semibold text-foreground">
            {{ editingMessage ? 'Edit Scheduled Message' : 'Schedule New Message' }}
          </h3>
        </div>
        
        <form @submit.prevent="saveMessage" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Title</label>
            <input v-model="messageForm.title" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Channel</label>
            <select v-model="messageForm.channelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a channel</option>
              <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                #{{ channel.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Message Content</label>
            <textarea v-model="messageForm.content" rows="4" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Date</label>
              <input v-model="messageForm.date" type="date" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Time</label>
              <input v-model="messageForm.time" type="time" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="messageForm.recurring.enabled" id="recurring" class="rounded border-border text-primary focus:ring-primary">
            <label for="recurring" class="text-sm font-medium text-foreground">Recurring message</label>
          </div>
          
          <div v-if="messageForm.recurring.enabled" class="space-y-4 pl-6 border-l-2 border-primary">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Repeat every</label>
              <select v-model="messageForm.recurring.interval" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">End after (optional)</label>
              <input v-model.number="messageForm.recurring.endAfter" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Number of occurrences">
            </div>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeModal" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingMessage ? 'Update' : 'Schedule' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface ScheduledMessage {
  id: string
  title: string
  content: string
  channelId: string
  channelName: string
  scheduledAt: Date
  status: 'pending' | 'sent' | 'failed'
  recurring?: {
    enabled: boolean
    interval: 'daily' | 'weekly' | 'monthly'
    endAfter?: number
    count?: number
  }
}

const showCreateModal = ref(false)
const editingMessage = ref<ScheduledMessage | null>(null)

const scheduledMessages = ref<ScheduledMessage[]>([
  {
    id: '1',
    title: 'Daily Announcements',
    content: 'Good morning everyone! Don\'t forget to check out today\'s events in #events.',
    channelId: 'general',
    channelName: 'general',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'pending',
    recurring: {
      enabled: true,
      interval: 'daily'
    }
  },
  {
    id: '2',
    title: 'Weekly Server Update',
    content: 'Weekly server statistics and updates will be posted here.',
    channelId: 'announcements',
    channelName: 'announcements',
    scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending',
    recurring: {
      enabled: true,
      interval: 'weekly'
    }
  }
])

const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'announcements', name: 'announcements' },
  { id: 'events', name: 'events' },
  { id: 'updates', name: 'updates' }
])

const messageForm = ref({
  title: '',
  content: '',
  channelId: '',
  date: '',
  time: '',
  recurring: {
    enabled: false,
    interval: 'daily' as 'daily' | 'weekly' | 'monthly',
    endAfter: undefined as number | undefined
  }
})

const formatDateTime = (date: Date) => {
  return date.toLocaleString()
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'sent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const editMessage = (message: ScheduledMessage) => {
  editingMessage.value = message
  messageForm.value = {
    title: message.title,
    content: message.content,
    channelId: message.channelId,
    date: message.scheduledAt.toISOString().split('T')[0],
    time: message.scheduledAt.toTimeString().slice(0, 5),
    recurring: {
      enabled: message.recurring?.enabled || false,
      interval: message.recurring?.interval || 'daily',
      endAfter: message.recurring?.endAfter
    }
  }
  showCreateModal.value = true
}

const deleteMessage = (messageId: string) => {
  if (confirm('Are you sure you want to delete this scheduled message?')) {
    const index = scheduledMessages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      scheduledMessages.value.splice(index, 1)
      toastStore.addToast('Scheduled message deleted', 'success')
    }
  }
}

const saveMessage = () => {
  const channel = channels.value.find(c => c.id === messageForm.value.channelId)
  if (!channel) return

  const scheduledAt = new Date(`${messageForm.value.date}T${messageForm.value.time}`)
  
  if (editingMessage.value) {
    // Update existing message
    const index = scheduledMessages.value.findIndex(m => m.id === editingMessage.value!.id)
    if (index !== -1) {
      scheduledMessages.value[index] = {
        ...scheduledMessages.value[index],
        title: messageForm.value.title,
        content: messageForm.value.content,
        channelId: messageForm.value.channelId,
        channelName: channel.name,
        scheduledAt,
        recurring: messageForm.value.recurring.enabled ? messageForm.value.recurring : undefined
      }
      toastStore.addToast('Scheduled message updated', 'success')
    }
  } else {
    // Create new message
    const newMessage: ScheduledMessage = {
      id: Date.now().toString(),
      title: messageForm.value.title,
      content: messageForm.value.content,
      channelId: messageForm.value.channelId,
      channelName: channel.name,
      scheduledAt,
      status: 'pending',
      recurring: messageForm.value.recurring.enabled ? messageForm.value.recurring : undefined
    }
    scheduledMessages.value.push(newMessage)
    toastStore.addToast('Message scheduled successfully', 'success')
  }
  
  closeModal()
}

const closeModal = () => {
  showCreateModal.value = false
  editingMessage.value = null
  messageForm.value = {
    title: '',
    content: '',
    channelId: '',
    date: '',
    time: '',
    recurring: {
      enabled: false,
      interval: 'daily',
      endAfter: undefined
    }
  }
}
</script>