
<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-foreground">Reminders</h1>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
        Create Reminder
      </button>
    </div>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'active'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'active'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Active ({{ activeReminders.length }})
        </button>
        <button
          @click="activeTab = 'completed'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'completed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Completed ({{ completedReminders.length }})
        </button>
      </nav>
    </div>

    <!-- Reminders List -->
    <div class="space-y-4">
      <div v-if="currentReminders.length === 0" class="text-center py-12">
        <p class="text-muted-foreground">No {{ activeTab }} reminders found.</p>
      </div>
      
      <div v-for="reminder in currentReminders" :key="reminder.id" class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-sm font-medium text-card-foreground">{{ reminder.username }}</span>
              <span class="text-xs text-muted-foreground">#{{ reminder.channelName }}</span>
              <span v-if="reminder.recurring?.enabled" class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {{ reminder.recurring.interval }}
              </span>
            </div>
            <p class="text-card-foreground mb-2">{{ reminder.message }}</p>
            <div class="text-xs text-muted-foreground">
              <span>Remind at: {{ formatDate(reminder.remindAt) }}</span>
              <span class="mx-2">•</span>
              <span>Created: {{ formatDate(reminder.createdAt) }}</span>
            </div>
          </div>
          <div class="flex space-x-2">
            <button v-if="!reminder.completed" @click="completeReminder(reminder.id)" class="text-green-600 hover:text-green-700 p-1">
              ✓
            </button>
            <button @click="deleteReminder(reminder.id)" class="text-red-600 hover:text-red-700 p-1">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Reminder Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Create Reminder</h2>
        <form @submit.prevent="createReminder" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Message</label>
            <textarea v-model="newReminder.message" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="3" required></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Remind At</label>
            <input v-model="newReminder.remindAt" type="datetime-local" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRemindersStore } from '@/stores/reminders'

const remindersStore = useRemindersStore()
const { activeReminders, completedReminders, addReminder, completeReminder, deleteReminder } = remindersStore

const activeTab = ref<'active' | 'completed'>('active')
const showCreateModal = ref(false)

const newReminder = ref({
  userId: '123456789',
  username: 'CurrentUser',
  channelId: '987654321',
  channelName: 'general',
  message: '',
  remindAt: ''
})

const currentReminders = computed(() => {
  return activeTab.value === 'active' ? activeReminders : completedReminders
})

const createReminder = () => {
  addReminder(newReminder.value)
  showCreateModal.value = false
  newReminder.value.message = ''
  newReminder.value.remindAt = ''
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}
</script>
