<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">System Health Monitoring</h2>
      <div class="flex items-center gap-2">
        <select v-model="timeRange" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          <option value="1h">Last hour</option>
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

    <!-- System Status -->
    <div class="bg-card border border-border rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-foreground">System Status</h3>
        <div class="flex items-center gap-2">
          <span :class="getStatusColor(systemStatus)" class="px-3 py-1 rounded-full text-xs font-medium">
            {{ systemStatus }}
          </span>
          <span class="text-sm text-muted-foreground">Last updated: {{ formatTime(lastUpdated) }}</span>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-foreground">Uptime</h4>
            <span class="text-green-500">{{ uptimePercentage }}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-2.5">
            <div class="bg-green-500 h-2.5 rounded-full" :style="{ width: `${uptimePercentage}%` }"></div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">{{ formatUptime(uptime) }}</p>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-foreground">Memory</h4>
            <span :class="getResourceColor(memoryUsage)">{{ memoryUsage }}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-2.5">
            <div :class="getResourceBarColor(memoryUsage)" class="h-2.5 rounded-full" :style="{ width: `${memoryUsage}%` }"></div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">{{ formatMemory(memoryUsed) }} / {{ formatMemory(memoryTotal) }}</p>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-foreground">CPU</h4>
            <span :class="getResourceColor(cpuUsage)">{{ cpuUsage }}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-2.5">
            <div :class="getResourceBarColor(cpuUsage)" class="h-2.5 rounded-full" :style="{ width: `${cpuUsage}%` }"></div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">{{ cpuCores }} cores</p>
        </div>
        
        <div class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-foreground">API Rate Limit</h4>
            <span :class="getResourceColor(apiUsage)">{{ apiUsage }}%</span>
          </div>
          <div class="w-full bg-muted rounded-full h-2.5">
            <div :class="getResourceBarColor(apiUsage)" class="h-2.5 rounded-full" :style="{ width: `${apiUsage}%` }"></div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">{{ apiRequests }} / {{ apiLimit }} requests</p>
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Response Time Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="font-semibold text-foreground mb-4">Response Time</h3>
        <div class="h-64">
          <canvas ref="responseTimeChart"></canvas>
        </div>
      </div>
      
      <!-- Command Usage Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="font-semibold text-foreground mb-4">Command Usage</h3>
        <div class="h-64">
          <canvas ref="commandUsageChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Recent Incidents -->
    <div class="bg-card border border-border rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-foreground">Recent Incidents</h3>
        <button @click="showAllIncidents = !showAllIncidents" class="text-sm text-primary hover:text-primary/80">
          {{ showAllIncidents ? 'Show Recent' : 'Show All' }}
        </button>
      </div>
      
      <div v-if="incidents.length === 0" class="text-center py-8">
        <p class="text-muted-foreground">No incidents reported</p>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="incident in filteredIncidents" :key="incident.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-start justify-between">
            <div>
              <h4 class="font-medium text-foreground">{{ incident.title }}</h4>
              <p class="text-sm text-muted-foreground">{{ formatDate(incident.timestamp) }}</p>
            </div>
            <span :class="getIncidentSeverityColor(incident.severity)" class="px-3 py-1 rounded-full text-xs font-medium">
              {{ incident.severity }}
            </span>
          </div>
          <p class="text-sm text-foreground mt-2">{{ incident.description }}</p>
          <div v-if="incident.resolution" class="mt-2 pt-2 border-t border-border">
            <p class="text-sm text-foreground">
              <span class="font-medium">Resolution:</span> {{ incident.resolution }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Notifications Settings -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Notification Settings</h3>
      
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Email Notifications</label>
            <p class="text-sm text-muted-foreground">Receive email alerts for critical incidents</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="notificationSettings.email" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Discord Notifications</label>
            <p class="text-sm text-muted-foreground">Send alerts to a Discord channel</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="notificationSettings.discord" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div v-if="notificationSettings.discord" class="pl-6 border-l-2 border-primary">
          <label class="block text-sm font-medium text-foreground mb-2">Discord Channel</label>
          <select v-model="notificationSettings.discordChannel" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">Select a channel</option>
            <option v-for="channel in channels" :key="channel.id" :value="channel.id">
              #{{ channel.name }}
            </option>
          </select>
        </div>
        
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Webhook Notifications</label>
            <p class="text-sm text-muted-foreground">Send alerts to a custom webhook</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="notificationSettings.webhook" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div v-if="notificationSettings.webhook" class="pl-6 border-l-2 border-primary">
          <label class="block text-sm font-medium text-foreground mb-2">Webhook URL</label>
          <input v-model="notificationSettings.webhookUrl" type="url" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="https://example.com/webhook">
        </div>
        
        <div class="pt-4 border-t border-border">
          <h4 class="font-medium text-foreground mb-2">Notification Severity</h4>
          <div class="space-y-2">
            <label class="flex items-center space-x-2">
              <input type="checkbox" v-model="notificationSettings.severities.critical" class="rounded border-border text-primary focus:ring-primary">
              <span class="text-sm text-foreground">Critical</span>
            </label>
            <label class="flex items-center space-x-2">
              <input type="checkbox" v-model="notificationSettings.severities.high" class="rounded border-border text-primary focus:ring-primary">
              <span class="text-sm text-foreground">High</span>
            </label>
            <label class="flex items-center space-x-2">
              <input type="checkbox" v-model="notificationSettings.severities.medium" class="rounded border-border text-primary focus:ring-primary">
              <span class="text-sm text-foreground">Medium</span>
            </label>
            <label class="flex items-center space-x-2">
              <input type="checkbox" v-model="notificationSettings.severities.low" class="rounded border-border text-primary focus:ring-primary">
              <span class="text-sm text-foreground">Low</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end mt-6">
        <button @click="saveNotificationSettings" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Save Settings
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

// Chart references
const responseTimeChart = ref<HTMLCanvasElement>()
const commandUsageChart = ref<HTMLCanvasElement>()

// System status
const systemStatus = ref('Operational')
const lastUpdated = ref(new Date())
const uptimePercentage = ref(99.98)
const uptime = ref(1000 * 60 * 60 * 24 * 30) // 30 days in milliseconds
const memoryUsage = ref(45)
const memoryUsed = ref(512 * 1024 * 1024) // 512 MB
const memoryTotal = ref(1024 * 1024 * 1024) // 1 GB
const cpuUsage = ref(35)
const cpuCores = ref(4)
const apiUsage = ref(28)
const apiRequests = ref(280)
const apiLimit = ref(1000)

// Time range
const timeRange = ref('24h')

// Incidents
const showAllIncidents = ref(false)
const incidents = ref([
  {
    id: '1',
    title: 'API Rate Limit Exceeded',
    description: 'The bot temporarily exceeded Discord API rate limits due to high message volume.',
    severity: 'Medium',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    resolution: 'Implemented request throttling to prevent future occurrences.'
  },
  {
    id: '2',
    title: 'High Memory Usage',
    description: 'Memory usage spiked to 85% due to a memory leak in the command handler.',
    severity: 'High',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    resolution: 'Fixed memory leak and implemented better garbage collection.'
  },
  {
    id: '3',
    title: 'Discord Gateway Disconnection',
    description: 'Bot disconnected from Discord gateway due to network issues.',
    severity: 'Critical',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    resolution: 'Implemented automatic reconnection with exponential backoff.'
  }
])

// Notification settings
const notificationSettings = ref({
  email: true,
  discord: true,
  discordChannel: 'bot-logs',
  webhook: false,
  webhookUrl: '',
  severities: {
    critical: true,
    high: true,
    medium: false,
    low: false
  }
})

// Channels for notification settings
const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'bot-logs', name: 'bot-logs' },
  { id: 'alerts', name: 'alerts' }
])

const filteredIncidents = computed(() => {
  if (showAllIncidents.value) {
    return incidents.value
  }
  // Show only incidents from the last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return incidents.value.filter(incident => incident.timestamp > cutoff)
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Operational': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'Degraded': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'Partial Outage': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'Major Outage': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const getResourceColor = (percentage: number) => {
  if (percentage < 50) return 'text-green-500'
  if (percentage < 80) return 'text-yellow-500'
  return 'text-red-500'
}

const getResourceBarColor = (percentage: number) => {
  if (percentage < 50) return 'bg-green-500'
  if (percentage < 80) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getIncidentSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'Low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const formatUptime = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days} days, ${hours % 24} hours`
  if (hours > 0) return `${hours} hours, ${minutes % 60} minutes`
  return `${minutes} minutes, ${seconds % 60} seconds`
}

const formatMemory = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const refreshData = () => {
  // Simulate data refresh
  toastStore.addToast('Refreshing health data...', 'info')
  
  setTimeout(() => {
    // Update random values for demo
    memoryUsage.value = Math.floor(Math.random() * 30) + 30 // 30-60%
    cpuUsage.value = Math.floor(Math.random() * 40) + 20 // 20-60%
    apiUsage.value = Math.floor(Math.random() * 50) + 10 // 10-60%
    apiRequests.value = Math.floor(apiUsage.value * 10)
    lastUpdated.value = new Date()
    
    // Redraw charts
    drawResponseTimeChart()
    drawCommandUsageChart()
    
    toastStore.addToast('Health data refreshed', 'success')
  }, 1000)
}

const saveNotificationSettings = () => {
  toastStore.addToast('Notification settings saved', 'success')
}

// Simple chart drawing functions
const drawResponseTimeChart = () => {
  const canvas = responseTimeChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [120, 135, 110, 125, 115, 130, 145, 160, 150, 140, 130, 120]
  const labels = Array.from({ length: 12 }, (_, i) => `${i * 2}h`)
  
  // Chart dimensions
  const padding = 40
  const chartWidth = rect.width - padding * 2
  const chartHeight = rect.height - padding * 2
  
  // Find min/max values
  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
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
  
  labels.forEach((label, index) => {
    const x = padding + (chartWidth / (data.length - 1)) * index
    ctx.fillText(label, x, rect.height - 10)
  })
  
  // Draw y-axis labels
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i
    const value = Math.round(maxValue - (i * (maxValue - minValue) / 4))
    ctx.fillText(`${value}ms`, padding - 10, y + 4)
  }
}

const drawCommandUsageChart = () => {
  const canvas = commandUsageChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [
    { name: 'help', value: 120 },
    { name: 'ban', value: 45 },
    { name: 'kick', value: 30 },
    { name: 'mute', value: 60 },
    { name: 'play', value: 90 }
  ]
  
  // Chart dimensions
  const padding = 60
  const chartWidth = rect.width - padding * 2
  const chartHeight = rect.height - padding * 2
  
  // Find max value
  const maxValue = Math.max(...data.map(d => d.value))
  
  // Draw bars
  const barWidth = chartWidth / data.length * 0.8
  const barSpacing = chartWidth / data.length * 0.2
  
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight
    const x = padding + (barWidth + barSpacing) * index
    const y = padding + chartHeight - barHeight
    
    // Draw bar
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(x, y, barWidth, barHeight)
    
    // Draw label
    ctx.fillStyle = '#64748b'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(item.name, x + barWidth / 2, rect.height - 10)
    
    // Draw value
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    if (barHeight > 20) {
      ctx.fillText(item.value.toString(), x + barWidth / 2, y + barHeight / 2)
    }
  })
  
  // Draw y-axis labels
  ctx.fillStyle = '#64748b'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'right'
  
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i
    const value = Math.round(maxValue - (i * maxValue / 4))
    ctx.fillText(value.toString(), padding - 10, y + 4)
  }
}

// Draw charts when component mounts
onMounted(async () => {
  await nextTick()
  drawResponseTimeChart()
  drawCommandUsageChart()
})

// Redraw charts when time range changes
watch(timeRange, async () => {
  await nextTick()
  drawResponseTimeChart()
  drawCommandUsageChart()
})
</script>