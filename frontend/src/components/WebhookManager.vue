<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Webhook Management</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Webhook
      </button>
    </div>

    <!-- Webhooks List -->
    <div class="space-y-4">
      <div v-if="webhooks.length === 0" class="text-center py-12">
        <div class="text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M16 6l-4-4-4 4"/>
            <path d="M12 2v15"/>
          </svg>
          <p class="text-lg font-medium">No webhooks configured</p>
          <p class="text-sm">Create your first webhook to get started</p>
        </div>
      </div>

      <div v-for="webhook in webhooks" :key="webhook.id" class="bg-card border border-border rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <path d="M16 6l-4-4-4 4"/>
                <path d="M12 2v15"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-foreground">{{ webhook.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ webhook.description }}</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <span :class="webhook.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'" 
                  class="px-2 py-1 rounded-full text-xs font-medium">
              {{ webhook.enabled ? 'Active' : 'Inactive' }}
            </span>
            <button @click="toggleWebhook(webhook.id)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
            <button @click="editWebhook(webhook)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button @click="deleteWebhook(webhook.id)" class="text-muted-foreground hover:text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">Channel:</span>
            <span class="ml-2 text-foreground">#{{ webhook.channelName }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Events:</span>
            <span class="ml-2 text-foreground">{{ webhook.events.length }} configured</span>
          </div>
          <div>
            <span class="text-muted-foreground">Last Used:</span>
            <span class="ml-2 text-foreground">{{ formatDate(webhook.lastUsed) }}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Total Calls:</span>
            <span class="ml-2 text-foreground">{{ webhook.totalCalls }}</span>
          </div>
        </div>
        
        <div class="mt-4 flex gap-2">
          <button @click="testWebhook(webhook)" class="text-primary hover:text-primary/80 text-sm">
            Test Webhook
          </button>
          <button @click="viewLogs(webhook)" class="text-muted-foreground hover:text-foreground text-sm">
            View Logs
          </button>
          <button @click="copyUrl(webhook)" class="text-muted-foreground hover:text-foreground text-sm">
            Copy URL
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <h3 class="text-lg font-semibold text-foreground">
            {{ editingWebhook ? 'Edit Webhook' : 'Create New Webhook' }}
          </h3>
        </div>
        
        <form @submit.prevent="saveWebhook" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Name</label>
            <input v-model="webhookForm.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Description</label>
            <input v-model="webhookForm.description" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Channel</label>
            <select v-model="webhookForm.channelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a channel</option>
              <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                #{{ channel.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Avatar URL (optional)</label>
            <input v-model="webhookForm.avatarUrl" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Events to Send</label>
            <div class="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
              <label v-for="event in availableEvents" :key="event" class="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  :value="event" 
                  v-model="webhookForm.events"
                  class="rounded border-border text-primary focus:ring-primary"
                >
                <span class="text-sm text-foreground">{{ formatEventName(event) }}</span>
              </label>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="webhookForm.enabled" id="enabled" class="rounded border-border text-primary focus:ring-primary">
            <label for="enabled" class="text-sm font-medium text-foreground">Enable webhook</label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeModal" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingWebhook ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface Webhook {
  id: string
  name: string
  description: string
  url: string
  channelId: string
  channelName: string
  avatarUrl?: string
  events: string[]
  enabled: boolean
  lastUsed: Date
  totalCalls: number
}

const showCreateModal = ref(false)
const editingWebhook = ref<Webhook | null>(null)

const webhooks = ref<Webhook[]>([
  {
    id: '1',
    name: 'Moderation Alerts',
    description: 'Sends alerts for moderation actions',
    url: 'https://discord.com/api/webhooks/123456789/abcdef',
    channelId: 'moderation',
    channelName: 'moderation',
    events: ['MEMBER_BAN', 'MEMBER_KICK', 'MESSAGE_DELETE'],
    enabled: true,
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
    totalCalls: 156
  },
  {
    id: '2',
    name: 'Welcome Messages',
    description: 'Sends welcome messages for new members',
    url: 'https://discord.com/api/webhooks/987654321/fedcba',
    channelId: 'welcome',
    channelName: 'welcome',
    events: ['MEMBER_JOIN'],
    enabled: true,
    lastUsed: new Date(Date.now() - 30 * 60 * 1000),
    totalCalls: 89
  }
])

const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'moderation', name: 'moderation' },
  { id: 'welcome', name: 'welcome' },
  { id: 'logs', name: 'logs' }
])

const availableEvents = [
  'MEMBER_JOIN',
  'MEMBER_LEAVE',
  'MEMBER_BAN',
  'MEMBER_KICK',
  'MESSAGE_DELETE',
  'MESSAGE_EDIT',
  'ROLE_CREATE',
  'ROLE_DELETE',
  'CHANNEL_CREATE',
  'CHANNEL_DELETE'
]

const webhookForm = reactive({
  name: '',
  description: '',
  channelId: '',
  avatarUrl: '',
  events: [] as string[],
  enabled: true
})

const formatEventName = (event: string) => {
  return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const toggleWebhook = (webhookId: string) => {
  const webhook = webhooks.value.find(w => w.id === webhookId)
  if (webhook) {
    webhook.enabled = !webhook.enabled
    toastStore.addToast(`Webhook "${webhook.name}" ${webhook.enabled ? 'enabled' : 'disabled'}`, 'success')
  }
}

const editWebhook = (webhook: Webhook) => {
  editingWebhook.value = webhook
  Object.assign(webhookForm, {
    name: webhook.name,
    description: webhook.description,
    channelId: webhook.channelId,
    avatarUrl: webhook.avatarUrl || '',
    events: [...webhook.events],
    enabled: webhook.enabled
  })
  showCreateModal.value = true
}

const deleteWebhook = (webhookId: string) => {
  if (confirm('Are you sure you want to delete this webhook?')) {
    const index = webhooks.value.findIndex(w => w.id === webhookId)
    if (index !== -1) {
      const webhook = webhooks.value[index]
      webhooks.value.splice(index, 1)
      toastStore.addToast(`Webhook "${webhook.name}" deleted`, 'success')
    }
  }
}

const testWebhook = (webhook: Webhook) => {
  toastStore.addToast(`Testing webhook "${webhook.name}"...`, 'info')
  // Simulate webhook test
  setTimeout(() => {
    toastStore.addToast(`Webhook test successful!`, 'success')
  }, 1000)
}

const viewLogs = (webhook: Webhook) => {
  toastStore.addToast('Webhook logs would open here', 'info')
}

const copyUrl = (webhook: Webhook) => {
  navigator.clipboard.writeText(webhook.url)
  toastStore.addToast('Webhook URL copied to clipboard', 'success')
}

const saveWebhook = () => {
  const channel = channels.value.find(c => c.id === webhookForm.channelId)
  if (!channel) return

  if (editingWebhook.value) {
    // Update existing webhook
    const index = webhooks.value.findIndex(w => w.id === editingWebhook.value!.id)
    if (index !== -1) {
      webhooks.value[index] = {
        ...webhooks.value[index],
        name: webhookForm.name,
        description: webhookForm.description,
        channelId: webhookForm.channelId,
        channelName: channel.name,
        avatarUrl: webhookForm.avatarUrl,
        events: [...webhookForm.events],
        enabled: webhookForm.enabled
      }
      toastStore.addToast(`Webhook "${webhookForm.name}" updated`, 'success')
    }
  } else {
    // Create new webhook
    const newWebhook: Webhook = {
      id: Date.now().toString(),
      name: webhookForm.name,
      description: webhookForm.description,
      url: `https://discord.com/api/webhooks/${Date.now()}/generated-token`,
      channelId: webhookForm.channelId,
      channelName: channel.name,
      avatarUrl: webhookForm.avatarUrl,
      events: [...webhookForm.events],
      enabled: webhookForm.enabled,
      lastUsed: new Date(),
      totalCalls: 0
    }
    webhooks.value.push(newWebhook)
    toastStore.addToast(`Webhook "${webhookForm.name}" created`, 'success')
  }
  
  closeModal()
}

const closeModal = () => {
  showCreateModal.value = false
  editingWebhook.value = null
  Object.assign(webhookForm, {
    name: '',
    description: '',
    channelId: '',
    avatarUrl: '',
    events: [],
    enabled: true
  })
}
</script>