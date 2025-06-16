
<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold text-foreground mb-6">Tickets</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'open'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'open'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Open Tickets ({{ openTickets.length }})
        </button>
        <button
          @click="activeTab = 'closed'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'closed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Closed Tickets ({{ closedTickets.length }})
        </button>
        <button
          @click="activeTab = 'categories'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Categories
        </button>
        <button
          @click="activeTab = 'settings'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Settings
        </button>
      </nav>
    </div>

    <!-- Overview -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Open Tickets</h3>
        <p class="text-3xl font-bold text-primary">{{ openTickets.length }}</p>
      </div>
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Total Categories</h3>
        <p class="text-3xl font-bold text-green-600">{{ categories.length }}</p>
      </div>
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-2">Closed Today</h3>
        <p class="text-3xl font-bold text-blue-600">{{ closedTickets.length }}</p>
      </div>
    </div>

    <!-- Open/Closed Tickets -->
    <div v-if="activeTab === 'open' || activeTab === 'closed'" class="space-y-4">
      <div v-if="currentTickets.length === 0" class="text-center py-12">
        <p class="text-muted-foreground">No {{ activeTab }} tickets found.</p>
      </div>
      
      <div v-for="ticket in currentTickets" :key="ticket.id" class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="font-medium text-card-foreground">{{ ticket.subject }}</span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {{ ticket.categoryName }}
              </span>
              <span :class="[
                'inline-flex items-center px-2 py-1 rounded-full text-xs',
                ticket.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                ticket.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              ]">
                {{ ticket.priority }}
              </span>
            </div>
            <div class="text-sm text-muted-foreground mb-2">
              <span>By: {{ ticket.username }}</span>
              <span class="mx-2">•</span>
              <span>{{ ticket.messages }} messages</span>
              <span class="mx-2">•</span>
              <span>Created: {{ formatDate(ticket.createdAt) }}</span>
            </div>
            <div v-if="ticket.assignedStaff.length > 0" class="text-sm text-muted-foreground">
              Assigned to: {{ ticket.assignedStaff.join(', ') }}
            </div>
          </div>
          <div class="text-sm text-muted-foreground">
            #{{ ticket.id }}
          </div>
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div v-if="activeTab === 'categories'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-card-foreground">Ticket Categories</h2>
        <button @click="showCategoryModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
          Add Category
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="category in categories" :key="category.id" class="bg-card border border-border rounded-lg p-4">
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">{{ category.emoji }}</span>
              <div>
                <h3 class="font-semibold text-card-foreground">{{ category.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ category.description }}</p>
                <p class="text-xs text-muted-foreground mt-1">Staff: {{ category.staffRoles.join(', ') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div v-if="activeTab === 'settings'" class="max-w-2xl space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Ticket Settings</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Enable Tickets</label>
              <p class="text-sm text-muted-foreground">Allow users to create support tickets</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Support Channel</label>
            <input v-model="settings.supportChannelName" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="#ticket-support">
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Max Tickets Per User</label>
            <input v-model="settings.maxTicketsPerUser" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Close Inactive After (hours)</label>
            <input v-model="settings.closeInactiveAfter" type="number" min="0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <p class="text-xs text-muted-foreground mt-1">Set to 0 to disable auto-closing</p>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="saveSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Add Category</h2>
        <form @submit.prevent="addNewCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Name</label>
            <input v-model="newCategory.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Description</label>
            <textarea v-model="newCategory.description" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="2" required></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Emoji</label>
            <input v-model="newCategory.emoji" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCategoryModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTicketsStore } from '@/stores/tickets'
import { storeToRefs } from 'pinia'

const ticketsStore = useTicketsStore()
const { settings, categories, openTickets, closedTickets, addCategory } = ticketsStore
const { tickets } = storeToRefs(ticketsStore)

const activeTab = ref<'overview' | 'open' | 'closed' | 'categories' | 'settings'>('overview')
const showCategoryModal = ref(false)

const newCategory = ref({
  name: '',
  description: '',
  emoji: '🎫',
  staffRoles: ['Support Staff'],
  channelPrefix: 'ticket',
  autoClose: false,
  autoCloseTime: 0
})

const currentTickets = computed(() => {
  return activeTab.value === 'open' ? openTickets : closedTickets
})

const addNewCategory = () => {
  addCategory(newCategory.value)
  showCategoryModal.value = false
  newCategory.value = {
    name: '',
    description: '',
    emoji: '🎫',
    staffRoles: ['Support Staff'],
    channelPrefix: 'ticket',
    autoClose: false,
    autoCloseTime: 0
  }
}

const saveSettings = () => {
  console.log('Ticket settings saved')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}
</script>
