
<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Dashboard</h1>
      <p class="text-slate-400">Overview of your server activity and statistics</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Column -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Member Growth Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Member Growth (7 days)</h2>
            <div class="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <span class="text-indigo-400 text-xl">📈</span>
            </div>
          </div>
          <div class="h-72">
            <MemberGrowthChart />
          </div>
        </div>
        
        <!-- Recent Activity Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Recent Activity</h2>
            <div class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span class="text-green-400 text-xl">⚡</span>
            </div>
          </div>
          <div class="space-y-4">
            <div class="flex items-start space-x-3">
              <div class="text-green-400 mt-1 text-lg">✓</div>
              <div class="text-sm">
                <p class="text-white font-medium">New member joined: <span class="font-normal text-slate-300">@user123</span></p>
                <p class="text-slate-400">2 minutes ago</p>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <div class="text-blue-400 mt-1 text-lg">🎫</div>
              <div class="text-sm">
                <p class="text-white font-medium">Ticket created: <span class="font-normal text-slate-300">#5821 - "Login Issue"</span></p>
                <p class="text-slate-400">15 minutes ago</p>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <div class="text-purple-400 mt-1 text-lg">👤</div>
              <div class="text-sm">
                <p class="text-white font-medium">Role assigned: <span class="font-normal text-slate-300">"VIP" to @anotheruser</span></p>
                <p class="text-slate-400">1 hour ago</p>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <div class="text-red-400 mt-1 text-lg">🔨</div>
              <div class="text-sm">
                <p class="text-white font-medium">Member banned: <span class="font-normal text-slate-300">@spammer</span></p>
                <p class="text-slate-400">3 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Side Column -->
      <div class="space-y-6">
        <!-- Server Stats Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Server Stats</h2>
            <div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span class="text-blue-400 text-xl">📊</span>
            </div>
          </div>
          <div v-if="loadingStats" class="space-y-3 animate-pulse">
              <div class="flex justify-between items-center" v-for="i in 3" :key="i">
                <div class="h-4 bg-slate-700 rounded w-1/3"></div>
                <div class="h-4 bg-slate-700 rounded w-1/4"></div>
              </div>
          </div>
          <div v-else-if="stats" class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-slate-400">Total Members</span>
              <span class="text-white font-medium">{{ formatNumber(stats.memberCount) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-400">Online</span>
              <span class="text-green-400 font-medium">{{ formatNumber(stats.onlineMembers) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-400">Channels</span>
              <span class="text-white font-medium">{{ stats.channelCount }}</span>
            </div>
          </div>
          <div v-else class="text-slate-400 text-sm">
            Could not load server statistics.
          </div>
        </div>
        
        <!-- Active Modules Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Active Modules</h2>
            <div class="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <span class="text-yellow-400 text-xl">📦</span>
            </div>
          </div>
          <div v-if="stats && stats.activeModules.length > 0" class="flex flex-wrap gap-2">
            <span v-for="module in stats.activeModules" :key="module" class="bg-slate-800 text-slate-300 text-sm font-medium px-3 py-1 rounded-full">
              {{ module }}
            </span>
          </div>
          <div v-else class="text-slate-400 text-sm">
            No active modules found.
          </div>
        </div>
        
        <!-- Quick Actions Card -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white">Quick Actions</h2>
            <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span class="text-purple-400 text-xl">🚀</span>
            </div>
          </div>
          <div class="space-y-2">
            <router-link
              :to="`/server/${guildId}/tickets`"
              class="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
            >
              Create Ticket
            </router-link>
            <router-link
              :to="`/server/${guildId}/moderation`"
              class="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
            >
              Moderation Tools
            </router-link>
            <router-link
              :to="`/server/${guildId}/settings`"
              class="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200"
            >
              Server Settings
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGuildsStore } from '@/stores/guilds'
import { storeToRefs } from 'pinia'
import MemberGrowthChart from '@/components/charts/MemberGrowthChart.vue'

const route = useRoute()
const guildId = computed(() => route.params.guildId as string || 'demo')

const guildsStore = useGuildsStore()
const { currentGuildStats: stats } = storeToRefs(guildsStore)
const loadingStats = ref(false)

const fetchStats = async (id: string) => {
  if (!id) return;
  loadingStats.value = true
  await guildsStore.fetchGuildStats(id)
  loadingStats.value = false
}

onMounted(() => {
  fetchStats(guildId.value)
})

watch(guildId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchStats(newId)
  }
})

const formatNumber = (num: number | undefined) => {
  if (num === undefined) return 'N/A'
  return new Intl.NumberFormat().format(num)
}
</script>
