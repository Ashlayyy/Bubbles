
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface WelcomeSettings {
  enabled: boolean
  channelId: string
  channelName: string
  messages: string[]
  embedEnabled: boolean
  embedTitle: string
  embedDescription: string
  embedColor: string
  embedThumbnail: string
  embedImage: string
  embedFooter: string
  pingUser: boolean
  deleteAfter: number
  dmUser: boolean
  dmMessage: string
  autoRole: string[]
}

export interface LeaveSettings {
  enabled: boolean
  channelId: string
  channelName: string
  messages: string[]
  embedEnabled: boolean
  embedTitle: string
  embedDescription: string
  embedColor: string
  embedFooter: string
}

export const useWelcomeStore = defineStore('welcome', () => {
  const welcomeSettings = ref<WelcomeSettings>({
    enabled: true,
    channelId: '123456789',
    channelName: 'welcome',
    messages: ['Welcome to [[.SERVER.NAME]], [[.USER]]! 🎉'],
    embedEnabled: true,
    embedTitle: 'Welcome!',
    embedDescription: 'Welcome to [[.SERVER.NAME]], [[.USER]]! Please read the rules and enjoy your stay!',
    embedColor: '#5865F2',
    embedThumbnail: '',
    embedImage: '',
    embedFooter: 'Member #[[.MEMBER.COUNT]]',
    pingUser: true,
    deleteAfter: 0,
    dmUser: false,
    dmMessage: 'Welcome to [[.SERVER.NAME]]! Please read the rules.',
    autoRole: []
  })

  const leaveSettings = ref<LeaveSettings>({
    enabled: true,
    channelId: '123456789',
    channelName: 'welcome',
    messages: ['[[.USER]] has left the server.'],
    embedEnabled: true,
    embedTitle: 'Goodbye!',
    embedDescription: '[[.USER]] has left [[.SERVER.NAME]].',
    embedColor: '#FF5733',
    embedFooter: 'We now have [[.MEMBER.COUNT]] members'
  })

  const updateWelcomeSettings = (settings: Partial<WelcomeSettings>) => {
    welcomeSettings.value = { ...welcomeSettings.value, ...settings }
  }

  const updateLeaveSettings = (settings: Partial<LeaveSettings>) => {
    leaveSettings.value = { ...leaveSettings.value, ...settings }
  }

  return {
    welcomeSettings,
    leaveSettings,
    updateWelcomeSettings,
    updateLeaveSettings
  }
})
