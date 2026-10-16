<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Voice Activity Tracker</h2>
      <div class="flex items-center gap-2">
        <select v-model="timeRange" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <button @click="refreshData" class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Voice Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-2">Total Voice Time</h3>
        <p class="text-3xl font-bold text-primary">{{ formatDuration(totalVoiceTime) }}</p>
        <p class="text-sm text-muted-foreground">{{ voiceTimeChange > 0 ? '+' : ''}}{{ voiceTimeChange }}% from previous period</p>
      </div>
      
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-2">Active Users</h3>
        <p class="text-3xl font-bold text-foreground">{{ activeVoiceUsers }}</p>
        <p class="text-sm text-muted-foreground">{{ activeUsersChange > 0 ? '+' : ''}}{{ activeUsersChange }}% from previous period</p>
      </div>
      
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-2">Peak Concurrent</h3>
        <p class="text-3xl font-bold text-foreground">{{ peakConcurrentUsers }}</p>
        <p class="text-sm text-muted-foreground">users in voice channels</p>
      </div>
      
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-2">Most Active Hour</h3>
        <p class="text-3xl font-bold text-foreground">{{ mostActiveHour }}</p>
        <p class="text-sm text-muted-foreground">{{ mostActiveHourUsers }} average users</p>
      </div>
    </div>

    <!-- Voice Activity Chart -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Voice Activity Over Time</h3>
      <div class="h-64">
        <canvas ref="activityChart"></canvas>
      </div>
    </div>

    <!-- Voice Channels Stats -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Voice Channels</h3>
      
      <div class="space-y-4">
        <div v-for="channel in voiceChannels" :key="channel.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium text-foreground">{{ channel.name }}</h4>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">{{ channel.currentUsers }} / {{ channel.maxUsers }} users</span>
              <span :class="channel.currentUsers > 0 ? 'bg-green-500' : 'bg-muted'" class="w-2 h-2 rounded-full"></span>
            </div>
          </div>
          
          <div class="space-y-2">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-muted-foreground">Usage</span>
                <span class="text-foreground">{{ channel.usagePercentage }}%</span>
              </div>
              <div class="w-full bg-muted rounded-full h-2">
                <div class="bg-primary h-2 rounded-full" :style="{ width: `${channel.usagePercentage}%` }"></div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <span class="text-muted-foreground">Total Time:</span>
                <span class="ml-1 text-foreground">{{ formatDuration(channel.totalTime) }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Peak Users:</span>
                <span class="ml-1 text-foreground">{{ channel.peakUsers }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Avg. Session:</span>
                <span class="ml-1 text-foreground">{{ formatDuration(channel.avgSessionTime) }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Unique Users:</span>
                <span class="ml-1 text-foreground">{{ channel.uniqueUsers }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Top Voice Users -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Top Voice Users</h3>
      
      <div class="space-y-4">
        <div v-for="(user, index) in topVoiceUsers" :key="user.id" class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {{ index + 1 }}
            </div>
            <span class="font-medium text-foreground">{{ user.name }}</span>
          </div>
          <div class="text-right">
            <p class="font-semibold text-foreground">{{ formatDuration(user.totalTime) }}</p>
            <p class="text-xs text-muted-foreground">{{ user.sessions }} sessions</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import { voiceEndpoints } from '@/lib/endpoints/voice'

const toastStore = useToastStore()
const route = useRoute()

// Chart reference
const activityChart = ref<HTMLCanvasElement>()

// Time range
const timeRange = ref('7d')

// Voice stats
const totalVoiceTime = ref(0)
const voiceTimeChange = ref(0)
const activeVoiceUsers = ref(0)
const activeUsersChange = ref(0)
const peakConcurrentUsers = ref(0)
const mostActiveHour = ref('n/a')
const mostActiveHourUsers = ref(0)

const voiceChannels = ref<any[]>([])
const topVoiceUsers = ref<any[]>([])

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  
  return `${seconds}s`
}

const refreshData = async () => {
  const guildId = String(route.params.guildId || '')
  if (!guildId) return
  try {
    const { data } = await voiceEndpoints.activity(guildId, { period: timeRange.value })
    const payload = (data as any)?.data ?? data
    totalVoiceTime.value = Number(payload.totalVoiceTimeMs ?? 0)
    activeVoiceUsers.value = Number(payload.activeVoiceUsers ?? 0)
    peakConcurrentUsers.value = Number(payload.activeVoiceUsers ?? 0)
    mostActiveHourUsers.value = Number(payload.uniqueVoiceUsers ?? 0)
    voiceTimeChange.value = 0
    activeUsersChange.value = 0
    const live = payload.liveChannels ?? []
    const history = payload.channels ?? []
    voiceChannels.value = (live.length ? live : history).map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      currentUsers: channel.memberCount ?? 0,
      maxUsers: channel.userLimit || 99,
      usagePercentage: channel.memberCount ? Math.min(100, channel.memberCount * 10) : 0,
      totalTime: channel.durationMs ?? 0,
      peakUsers: channel.memberCount ?? 0,
      avgSessionTime: 0,
      uniqueUsers: channel.uniqueUsers ?? channel.memberCount ?? 0,
    }))
    topVoiceUsers.value = (payload.topUsers ?? []).map((user: any) => ({
      id: user.userId,
      name: user.userId,
      totalTime: user.durationMs,
      sessions: user.sessions,
    }))
    await nextTick()
    drawActivityChart()
  } catch (error: any) {
    toastStore.addToast(error.response?.data?.error || 'Could not load voice activity', 'error')
  }
}

// Simple chart drawing function
const drawActivityChart = () => {
  const canvas = activityChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data - users in voice channels over time
  let data: number[]
  let labels: string[]
  
  if (timeRange.value === '24h') {
    data = [2, 3, 5, 8, 10, 7, 4, 2, 1, 0, 1, 3, 5, 7, 8, 10, 12, 9, 7, 5, 4, 3, 2, 1]
    labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  } else if (timeRange.value === '7d') {
    data = [25, 32, 28, 35, 42, 38, 30]
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    data = [120, 135, 110, 125, 145, 160, 150, 140, 130, 145, 155, 165, 175, 160, 150, 140, 130, 120, 110, 100, 90, 100, 110, 120, 130, 140, 150, 140, 130, 120]
    labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
  }
  
  // Chart dimensions
  const padding = 40
  const chartWidth = rect.width - padding * 2
  const chartHeight = rect.height - padding * 2
  
  // Find min/max values
  const maxValue = Math.max(...data)
  const minValue = 0 // Start from 0 for voice users
  const range = maxValue - minValue
  
  // Draw grid lines
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(rect.width - padding, y)
    ctx.stroke()
  }
  
  // Draw area
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.beginPath()
  ctx.moveTo(padding, padding + chartHeight)
  
  data.forEach((value, index) => {
    const x = padding + (chartWidth / (data.length - 1)) * index
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight
    ctx.lineTo(x, y)
  })
  
  ctx.lineTo(rect.width - padding, padding + chartHeight)
  ctx.closePath()
  ctx.fill()
  
  // Draw line
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  data.forEach((value, index) => {
    const x = padding + (chartWidth / (data.length - 1)) * index
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
  
  // Draw points
  ctx.fillStyle = '#3b82f6'
  data.forEach((value, index) => {
    const x = padding + (chartWidth / (data.length - 1)) * index
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  
  // Draw labels
  ctx.fillStyle = '#64748b'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  
  // Only show a subset of labels to avoid crowding
  const labelStep = Math.ceil(labels.length / 10)
  labels.forEach((label, index) => {
    if (index % labelStep === 0 || index === labels.length - 1) {
      const x = padding + (chartWidth / (data.length - 1)) * index
      ctx.fillText(label, x, rect.height - 10)
    }
  })
  
  // Draw y-axis labels
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i
    const value = Math.round(maxValue - (i * (maxValue - minValue) / 4))
    ctx.fillText(value.toString(), padding - 10, y + 4)
  }
}

// Draw chart when component mounts
onMounted(async () => {
  await refreshData()
  await nextTick()
  drawActivityChart()
})

watch(timeRange, async () => {
  await refreshData()
})
</script>