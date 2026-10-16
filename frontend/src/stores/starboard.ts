
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface StarboardMessage {
  id: string
  messageId: string
  channelId: string
  channel: string
  authorId: string
  author: {
    username: string
    avatar: string
  }
  content: string
  attachments: string[]
  starCount: number
  starboardMessageId?: string
  createdAt: string
  starredAt: string
  timestamp: string
  jumpUrl: string
}

export interface StarboardSettings {
  enabled: boolean
  channelId: string
  channelName: string
  minStars: number
  emoji: string
  allowSelfStar: boolean
  removeOnUnstar: boolean
  ignoredChannels: string[]
  ignoredRoles: string[]
  deleteInvalid: boolean
}

export const useStarboardStore = defineStore('starboard', () => {
  const settings = ref<StarboardSettings>({
    enabled: true,
    channelId: '123456789',
    channelName: 'starboard',
    minStars: 3,
    emoji: '⭐',
    allowSelfStar: false,
    removeOnUnstar: true,
    ignoredChannels: [],
    ignoredRoles: [],
    deleteInvalid: true
  })

  const starredMessages = ref<StarboardMessage[]>([
    {
      id: '1',
      messageId: '987654321',
      channelId: '111111111',
      channel: 'general',
      authorId: '222222222',
      author: {
        username: 'CoolUser',
        avatar: 'https://cdn.discordapp.com/avatars/222222222/avatar.png'
      },
      content: 'This is an amazing meme! 😂',
      attachments: ['https://example.com/meme.png'],
      starCount: 5,
      starboardMessageId: '333333333',
      createdAt: '2024-01-15T12:00:00Z',
      starredAt: '2024-01-15T12:15:00Z',
      timestamp: '2024-01-15T12:00:00Z',
      jumpUrl: 'https://discord.com/channels/123/111111111/987654321'
    },
    {
      id: '2',
      messageId: '987654322',
      channelId: '111111111',
      channel: 'memes',
      authorId: '222222223',
      author: {
        username: 'FunnyUser',
        avatar: 'https://cdn.discordapp.com/avatars/222222223/avatar2.png'
      },
      content: 'Check out this cool feature! 🚀',
      attachments: [],
      starCount: 8,
      starboardMessageId: '333333334',
      createdAt: '2024-01-16T10:30:00Z',
      starredAt: '2024-01-16T10:45:00Z',
      timestamp: '2024-01-16T10:30:00Z',
      jumpUrl: 'https://discord.com/channels/123/111111111/987654322'
    }
  ])

  const stats = ref({
    totalStars: 13,
    totalMessages: 2,
    topMessage: 8
  })

  const updateSettings = (newSettings: Partial<StarboardSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
  }

  return {
    settings,
    starredMessages,
    stats,
    updateSettings
  }
})
