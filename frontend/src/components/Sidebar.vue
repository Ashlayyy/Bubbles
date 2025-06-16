
<template>
  <div class="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-40 flex flex-col">
    <!-- Logo -->
    <div class="p-6 border-b border-border flex-shrink-0">
      <router-link to="/" class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span class="text-white font-bold text-lg">B</span>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-card-foreground">Bubbles</h2>
          <p class="text-sm text-muted-foreground">Dashboard</p>
        </div>
      </router-link>
    </div>

    <!-- Server Info -->
    <div v-if="currentGuild" class="p-4 border-b border-border flex-shrink-0">
      <div class="bg-secondary rounded-lg p-3">
        <div class="flex items-center space-x-3">
          <img v-if="currentGuildIconUrl" :src="currentGuildIconUrl" :alt="currentGuild.name" class="w-8 h-8 rounded-lg">
          <div v-else class="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <span class="text-white font-medium text-sm">{{ currentGuild.name.charAt(0) }}</span>
          </div>
          <div>
            <p class="text-secondary-foreground font-medium text-sm">{{ currentGuild.name }}</p>
            <p class="text-muted-foreground text-xs">{{ formatCount(currentGuild.memberCount) }} members</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="p-4 space-y-1 flex-1 overflow-y-auto">
      <router-link
        v-for="item in menuItems"
        :key="item.name"
        :to="item.path"
        class="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-secondary"
        active-class="bg-primary text-primary-foreground"
      >
        <span class="text-lg">{{ item.icon }}</span>
        <span class="font-medium">{{ item.name }}</span>
      </router-link>
    </nav>

    <!-- User Info -->
    <div v-if="authStore.user" class="p-4 border-t border-border flex-shrink-0">
      <div class="flex items-center space-x-2">
        <img v-if="authStore.avatarUrl" :src="authStore.avatarUrl" alt="User Avatar" class="w-8 h-8 rounded-lg">
        <div v-else class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
          <span class="text-white font-medium text-sm">{{ authStore.user.username.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="flex-1 ml-1">
          <p class="text-foreground font-medium text-sm">{{ authStore.user.username }}</p>
          <p v-if="authStore.user.discriminator !== '0'" class="text-muted-foreground text-xs">#{{ authStore.user.discriminator }}</p>
        </div>
        <ThemeToggle />
        <button
          @click="handleLogout"
          class="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors duration-200"
          aria-label="Logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGuildsStore } from '@/stores/guilds'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()
const router = useRouter()

const guildId = computed(() => route.params.guildId as string)

const guildsStore = useGuildsStore()
const { currentGuild, guilds } = storeToRefs(guildsStore)
const authStore = useAuthStore()

const updateCurrentGuild = async (id: string) => {
  if (guilds.value.length === 0) {
    await guildsStore.fetchGuilds()
  }
  const guild = guilds.value.find(g => g.id === id)
  if (guild) {
    guildsStore.setCurrentGuild(guild)
  }
}

onMounted(() => {
  // Auth is handled by the navigation guard in main.ts
  if (guildId.value) {
    updateCurrentGuild(guildId.value)
  }
})

watch(guildId, (newId) => {
  if (newId) {
    updateCurrentGuild(newId)
  }
})

const currentGuildIconUrl = computed(() => {
  if (currentGuild.value) {
    return guildsStore.getGuildIconUrl(currentGuild.value)
  }
  return null
})

const menuItems = computed(() => {
  const id = guildId.value || 'demo'
  return [
    { name: 'Dashboard', icon: '📊', path: `/server/${id}/dashboard` },
    { name: 'Moderation', icon: '🛡️', path: `/server/${id}/moderation` },
    { name: 'Appeals', icon: '⚖️', path: `/server/${id}/appeals` },
    { name: 'Tickets', icon: '🎫', path: `/server/${id}/tickets` },
    { name: 'Auto Roles', icon: '⚡', path: `/server/${id}/autoroles` },
    { name: 'Reaction Roles', icon: '👍', path: `/server/${id}/reaction-roles` },
    { name: 'Custom Commands', icon: '💬', path: `/server/${id}/custom-commands` },
    { name: 'Leveling', icon: '📈', path: `/server/${id}/leveling` },
    { name: 'Welcome & Leave', icon: '👋', path: `/server/${id}/welcome` },
    { name: 'Reminders', icon: '⏰', path: `/server/${id}/reminders` },
    { name: 'Starboard', icon: '⭐', path: `/server/${id}/starboard` },
    { name: 'Audit Log', icon: '📋', path: `/server/${id}/audit-log` },
    { name: 'Logging', icon: '📜', path: `/server/${id}/logging` },
    { name: 'Settings', icon: '⚙️', path: `/server/${id}/settings` }
  ]
})

const formatCount = (count: number | undefined) => {
  if (count === undefined) return 'N/A'
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return count.toString()
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>
