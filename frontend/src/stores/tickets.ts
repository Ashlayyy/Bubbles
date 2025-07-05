
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TicketCategory {
  id: string
  name: string
  description: string
  emoji: string
  staffRoles: string[]
  channelPrefix: string
  autoClose: boolean
  autoCloseTime: number
}

export interface Ticket {
  id: string
  categoryId: string
  categoryName: string
  userId: string
  username: string
  channelId: string
  status: 'open' | 'closed' | 'archived'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  subject: string
  createdAt: string
  closedAt?: string
  closedBy?: string
  messages: number
  assignedStaff: string[]
}

export interface TicketSettings {
  enabled: boolean
  supportChannelId: string
  supportChannelName: string
  archiveChannelId: string
  archiveChannelName: string
  transcriptChannelId: string
  transcriptChannelName: string
  maxTicketsPerUser: number
  closeInactiveAfter: number
  pingRoleOnCreate: string[]
}

export const useTicketsStore = defineStore('tickets', () => {
  const settings = ref<TicketSettings>({
    enabled: true,
    supportChannelId: '123456789',
    supportChannelName: 'ticket-support',
    archiveChannelId: '987654321',
    archiveChannelName: 'ticket-archive',
    transcriptChannelId: '555555555',
    transcriptChannelName: 'ticket-logs',
    maxTicketsPerUser: 3,
    closeInactiveAfter: 72,
    pingRoleOnCreate: ['Support Staff'],
    requireCloseReason: false,
    autoAssignStaff: true
  })

  const categories = ref<TicketCategory[]>([
    {
      id: '1',
      name: 'General Support',
      description: 'General questions and support',
      emoji: '🎫',
      staffRoles: ['Support Staff', 'Moderator'],
      channelPrefix: 'ticket',
      autoClose: true,
      autoCloseTime: 24
    },
    {
      id: '2',
      name: 'Report User',
      description: 'Report a user for breaking rules',
      emoji: '🚨',
      staffRoles: ['Moderator', 'Admin'],
      channelPrefix: 'report',
      autoClose: false,
      autoCloseTime: 0
    }
  ])

  const tickets = ref<Ticket[]>([
    {
      id: '1',
      categoryId: '1',
      categoryName: 'General Support',
      userId: '111111111',
      username: 'UserNeedingHelp',
      channelId: '222222222',
      status: 'open',
      priority: 'medium',
      subject: 'Cannot access certain channels',
      createdAt: '2024-01-16T10:30:00Z',
      messages: 12,
      assignedStaff: ['ModeratorUser']
    }
  ])

  const openTickets = computed(() => 
    tickets.value.filter(t => t.status === 'open')
  )

  const closedTickets = computed(() => 
    tickets.value.filter(t => t.status === 'closed')
  )

  const addCategory = (category: Omit<TicketCategory, 'id'>) => {
    const newCategory: TicketCategory = {
      ...category,
      id: Date.now().toString()
    }
    categories.value.push(newCategory)
  }

  const updateSettings = (newSettings: Partial<TicketSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
  }
  
  const updateCategory = (id: string, updates: Partial<TicketCategory>) => {
    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categories.value[index] = { ...categories.value[index], ...updates }
    }
  }
  
  const deleteCategory = (id: string) => {
    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categories.value.splice(index, 1)
    }
  }
  
  const closeTicket = (id: string, reason?: string) => {
    const index = tickets.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tickets.value[index] = {
        ...tickets.value[index],
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: 'Current User'
      }
    }
  }

  return {
    settings,
    categories,
    tickets,
    openTickets,
    closedTickets,
    addCategory,
    updateSettings,
    updateCategory,
    deleteCategory,
    closeTicket
  }
})
