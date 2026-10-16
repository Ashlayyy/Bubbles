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
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

// Chart reference
const activityChart = ref<HTMLCanvasElement>()

// Time range
const timeRange = ref('7d')

// Voice stats
const totalVoiceTime = ref(1000 * 60 * 60 * 120) // 120 hours in milliseconds
const voiceTimeChange = ref(15)
const activeVoiceUsers = ref(45)
const activeUsersChange = ref(8)
const peakConcurrentUsers = ref(12)
const mostActiveHour = ref('8:00 PM')
const mostActiveHourUsers = ref(10)

// Voice channels
const voiceChannels = ref([
  {
    id: '1',
    name: 'General Voice',
    currentUsers: 3,
    maxUsers: 99,
    usagePercentage: 65,
    totalTime: 1000 * 60 * 60 * 50, // 50 hours
    peakUsers: 8,
    avgSessionTime: 1000 * 60 * 45, // 45 minutes
    uniqueUsers: 25
  },
  {
    id: '2',
    name: 'Gaming',
    currentUsers: 2,
    maxUsers: 99,
    usagePercentage: 45,
    totalTime: 1000 * 60 * 60 * 35, // 35 hours
    peakUsers: 6,
    avgSessionTime: 1000 * 60 * 60, // 60 minutes
    uniqueUsers: 18
  },
  {
    id: '3',
    name: 'Music',
    currentUsers: 0,
    maxUsers: 99,
    usagePercentage: 25,
    totalTime: 1000 * 60 * 60 * 20, // 20 hours
    peakUsers: 4,
    avgSessionTime: 1000 * 60 * 30, // 30 minutes
    uniqueUsers: 12
  },
  {
    id: '4',
    name: 'AFK',
    currentUsers: 1,
    maxUsers: 99,
    usagePercentage: 15,
    totalTime: 1000 * 60 * 60 * 15, // 15 hours
    peakUsers: 3,
    avgSessionTime: 1000 * 60 * 90, // 90 minutes
    uniqueUsers: 8
  }
])

// Top voice users
const topVoiceUsers = ref([
  {
    id: '1',
    name: 'VoiceKing',
    totalTime: 1000 * 60 * 60 * 25, // 25 hours
    sessions: 45
  },
  {
    id: '2',
    name: 'ChattyUser',
    totalTime: 1000 * 60 * 60 * 18, // 18 hours
    sessions: 32
  },
  {
    id: '3',
    name: 'GamerPro',
    totalTime: 1000 * 60 * 60 * 15, // 15 hours
    sessions: 28
  },
  {
    id: '4',
    name: 'MusicLover',
    totalTime: 1000 * 60 * 60 * 12, // 12 hours
    sessions: 20
  },
  {
    id: '5',
    name: 'NightOwl',
    totalTime: 1000 * 60 * 60 * 10, // 10 hours
    sessions: 15
  }
])

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

const refreshData = () => {
  // Simulate data refresh
  toastStore.addToast('Refreshing voice activity data...', 'info')
  
  setTimeout(() => {
    // Update random values for demo
    totalVoiceTime.value = 1000 * 60 * 60 * (100 + Math.floor(Math.random() * 50)) // 100-150 hours
    voiceTimeChange.value = Math.floor(Math.random() * 30) - 10 // -10 to +20%
    activeVoiceUsers.value = 40 + Math.floor(Math.random() * 20) // 40-60 users
    activeUsersChange.value = Math.floor(Math.random() * 20) - 5 // -5 to +15%
    
    // Redraw chart
    drawActivityChart()
    
    toastStore.addToast('Voice activity data refreshed', 'success')
  }, 1000)
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
  await nextTick()
  drawActivityChart()
})

// Redraw chart when time range changes
watch(timeRange, async () => {
  await nextTick()
  drawActivityChart()
})
</script>