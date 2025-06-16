import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface CustomCommand {
  id: string
  name: string
  description: string
  content: string
  aliases: string[]
  enabled: boolean
  embedEnabled: boolean
  embedTitle?: string
  embedColor?: string
  embedDescription?: string
  embedFooter?: string
  embedThumbnail?: string
  embedImage?: string
  permissions: string[]
  channels: string[]
  roles: string[]
  cooldown: number
  deleteInvoke: boolean
  createdAt: string
  updatedAt: string
  usageCount: number
}

export const useCommandsStore = defineStore('commands', () => {
  const commands = ref<CustomCommand[]>([
    {
      id: '1',
      name: 'welcome',
      description: 'Welcome new members to the server',
      content: 'Welcome to [[.SERVER.NAME]], [[.USER]]! Please read the rules and enjoy your stay! 🎉',
      aliases: ['hi', 'hello'],
      enabled: true,
      embedEnabled: true,
      embedTitle: 'Welcome!',
      embedColor: '#5865F2',
      embedDescription: 'Welcome to [[.SERVER.NAME]], [[.USER]]! Please read the rules and enjoy your stay!',
      embedFooter: 'Server Rules • #rules',
      embedThumbnail: '',
      embedImage: '',
      permissions: ['@everyone'],
      channels: ['general', 'welcome'],
      roles: [],
      cooldown: 5,
      deleteInvoke: false,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:22:00Z',
      usageCount: 127
    },
    {
      id: '2',
      name: 'rules',
      description: 'Display server rules',
      content: 'Here are our server rules:\n\n1. Be respectful to all members\n2. No spam or excessive caps\n3. Keep discussions in appropriate channels\n4. No NSFW content\n5. Follow Discord ToS',
      aliases: ['rule'],
      enabled: true,
      embedEnabled: true,
      embedTitle: 'Server Rules',
      embedColor: '#FF5733',
      embedDescription: '1. Be respectful to all members\n2. No spam or excessive caps\n3. Keep discussions in appropriate channels\n4. No NSFW content\n5. Follow Discord ToS',
      embedFooter: 'Last updated: January 2024',
      embedThumbnail: '',
      embedImage: '',
      permissions: ['@everyone'],
      channels: [],
      roles: [],
      cooldown: 10,
      deleteInvoke: true,
      createdAt: '2024-01-10T09:15:00Z',
      updatedAt: '2024-01-15T16:45:00Z',
      usageCount: 89
    },
    {
      id: '3',
      name: 'support',
      description: 'Get support information',
      content: 'Need help? Contact our support team!',
      aliases: ['help', 'ticket'],
      enabled: false,
      embedEnabled: false,
      embedTitle: '',
      embedColor: '#00FF00',
      embedDescription: '',
      embedFooter: '',
      embedThumbnail: '',
      embedImage: '',
      permissions: ['Moderator', 'Admin'],
      channels: ['support'],
      roles: ['Member'],
      cooldown: 0,
      deleteInvoke: false,
      createdAt: '2024-01-05T14:20:00Z',
      updatedAt: '2024-01-08T11:30:00Z',
      usageCount: 23
    }
  ])

  const searchQuery = ref('')
  const selectedStatus = ref<'all' | 'enabled' | 'disabled'>('all')

  const filteredCommands = computed(() => {
    return commands.value.filter(command => {
      const matchesSearch = command.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           command.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           command.aliases.some(alias => alias.toLowerCase().includes(searchQuery.value.toLowerCase()))
      
      const matchesStatus = selectedStatus.value === 'all' ||
                           (selectedStatus.value === 'enabled' && command.enabled) ||
                           (selectedStatus.value === 'disabled' && !command.enabled)
      
      return matchesSearch && matchesStatus
    })
  })

  const addCommand = (command: Omit<CustomCommand, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    const newCommand: CustomCommand = {
      ...command,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    }
    commands.value.push(newCommand)
  }

  const updateCommand = (id: string, updates: Partial<CustomCommand>) => {
    const index = commands.value.findIndex(cmd => cmd.id === id)
    if (index !== -1) {
      commands.value[index] = {
        ...commands.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
    }
  }

  const deleteCommand = (id: string) => {
    const index = commands.value.findIndex(cmd => cmd.id === id)
    if (index !== -1) {
      commands.value.splice(index, 1)
    }
  }

  const toggleCommand = (id: string) => {
    const command = commands.value.find(cmd => cmd.id === id)
    if (command) {
      command.enabled = !command.enabled
      command.updatedAt = new Date().toISOString()
    }
  }

  return {
    commands,
    searchQuery,
    selectedStatus,
    filteredCommands,
    addCommand,
    updateCommand,
    deleteCommand,
    toggleCommand
  }
})
