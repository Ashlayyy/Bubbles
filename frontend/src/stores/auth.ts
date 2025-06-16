import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  email?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const loading = ref(false)

  const avatarUrl = computed(() => {
    if (!user.value) return null
    if (!user.value.avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.value.discriminator) % 5}.png`
    return `https://cdn.discordapp.com/avatars/${user.value.id}/${user.value.avatar}.png?size=128`
  })

  const login = () => {
    loading.value = true
    // Redirect to Discord OAuth
    window.location.href = '/api/auth/discord/login'
  }

  const loginAsDemoUser = () => {
    loading.value = true
    user.value = {
      id: 'demo-user',
      username: 'Demo User',
      discriminator: '0000',
      avatar: null
    }
    isAuthenticated.value = true
    loading.value = false
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed, logging out locally:', error)
    } finally {
      user.value = null
      isAuthenticated.value = false
    }
  }

  const checkAuth = async () => {
    if (isAuthenticated.value) return

    loading.value = true
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
        throw new Error('Not authenticated')
      }
      const userData = await response.json()
      user.value = userData
      isAuthenticated.value = true
    } catch (error) {
      user.value = null
      isAuthenticated.value = false
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    isAuthenticated,
    loading,
    avatarUrl,
    login,
    loginAsDemoUser,
    logout,
    checkAuth
  }
})
