
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Reminder {
  id: string
  userId: string
  username: string
  channelId: string
  channelName: string
  message: string
  createdAt: string
  remindAt: string
  completed: boolean
  recurring?: {
    enabled: boolean
    interval: 'daily' | 'weekly' | 'monthly'
    count?: number
  }
}

export const useRemindersStore = defineStore('reminders', () => {
  const reminders = ref<Reminder[]>([
    {
      id: '1',
      userId: '123456789',
      username: 'JohnDoe',
      channelId: '987654321',
      channelName: 'general',
      message: 'Check server analytics',
      createdAt: '2024-01-15T10:00:00Z',
      remindAt: '2024-01-22T10:00:00Z',
      completed: false,
      recurring: {
        enabled: true,
        interval: 'weekly'
      }
    },
    {
      id: '2',
      userId: '234567890',
      username: 'AdminUser',
      channelId: '876543210',
      channelName: 'staff',
      message: 'Review moderation cases',
      createdAt: '2024-01-16T14:30:00Z',
      remindAt: '2024-01-17T14:30:00Z',
      completed: true
    }
  ])

  const activeReminders = computed(() => 
    reminders.value.filter(r => !r.completed)
  )

  const completedReminders = computed(() => 
    reminders.value.filter(r => r.completed)
  )

  const addReminder = (reminder: Omit<Reminder, 'id' | 'createdAt' | 'completed'>) => {
    const newReminder: Reminder = {
      ...reminder,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      completed: false
    }
    reminders.value.push(newReminder)
  }

  const completeReminder = (id: string) => {
    const reminder = reminders.value.find(r => r.id === id)
    if (reminder) {
      reminder.completed = true
    }
  }

  const deleteReminder = (id: string) => {
    const index = reminders.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reminders.value.splice(index, 1)
    }
  }

  return {
    reminders,
    activeReminders,
    completedReminders,
    addReminder,
    completeReminder,
    deleteReminder
  }
})
