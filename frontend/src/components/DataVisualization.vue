<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Data Visualization</h2>
      <div class="flex items-center gap-2">
        <select v-model="selectedTimeRange" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
        <button @click="exportData" class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-lg transition-colors">
          Export
        </button>
      </div>
    </div>

    <!-- Chart Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Member Growth Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">Member Growth</h3>
        <div class="h-64">
          <canvas ref="memberGrowthChart"></canvas>
        </div>
      </div>
      
      <!-- Message Activity Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">Message Activity</h3>
        <div class="h-64">
          <canvas ref="messageActivityChart"></canvas>
        </div>
      </div>
      
      <!-- Channel Activity Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">Channel Activity</h3>
        <div class="h-64">
          <canvas ref="channelActivityChart"></canvas>
        </div>
      </div>
      
      <!-- User Engagement Chart -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">User Engagement</h3>
        <div class="h-64">
          <canvas ref="userEngagementChart"></canvas>
        </div>
      </div>
    </div>
    
    <!-- Heatmap -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="text-lg font-semibold text-foreground mb-4">Activity Heatmap</h3>
      <div class="h-64 overflow-x-auto">
        <div class="min-w-[800px] h-full" ref="heatmapContainer"></div>
      </div>
    </div>
    
    <!-- Top Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Top Channels -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">Top Channels</h3>
        <div class="space-y-3">
          <div v-for="(channel, index) in topChannels" :key="channel.id" class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {{ index + 1 }}
              </div>
              <span class="font-medium text-foreground">#{{ channel.name }}</span>
            </div>
            <div class="text-right">
              <p class="font-semibold text-foreground">{{ formatNumber(channel.messages) }}</p>
              <p class="text-xs text-muted-foreground">messages</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Top Users -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-foreground mb-4">Top Users</h3>
        <div class="space-y-3">
          <div v-for="(user, index) in topUsers" :key="user.id" class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {{ index + 1 }}
              </div>
              <span class="font-medium text-foreground">{{ user.name }}</span>
            </div>
            <div class="text-right">
              <p class="font-semibold text-foreground">{{ formatNumber(user.messages) }}</p>
              <p class="text-xs text-muted-foreground">messages</p>
            </div>
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

const selectedTimeRange = ref('7d')

// Chart references
const memberGrowthChart = ref<HTMLCanvasElement>()
const messageActivityChart = ref<HTMLCanvasElement>()
const channelActivityChart = ref<HTMLCanvasElement>()
const userEngagementChart = ref<HTMLCanvasElement>()
const heatmapContainer = ref<HTMLDivElement>()

// Sample data
const topChannels = ref([
  { id: '1', name: 'general', messages: 12450 },
  { id: '2', name: 'memes', messages: 8932 },
  { id: '3', name: 'gaming', messages: 6721 },
  { id: '4', name: 'music', messages: 4532 },
  { id: '5', name: 'art', messages: 3421 }
])

const topUsers = ref([
  { id: '1', name: 'SuperActive', messages: 2341 },
  { id: '2', name: 'ChatMaster', messages: 1987 },
  { id: '3', name: 'MemeLord', messages: 1654 },
  { id: '4', name: 'Gamer123', messages: 1432 },
  { id: '5', name: 'ArtisticSoul', messages: 1298 }
])

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num)
}

const exportData = () => {
  toastStore.addToast('Exporting data...', 'info')
  // Simulate export
  setTimeout(() => {
    toastStore.addToast('Data exported successfully!', 'success')
  }, 1000)
}

// Simple chart drawing functions
const drawMemberGrowthChart = () => {
  const canvas = memberGrowthChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [1200, 1250, 1300, 1450, 1500, 1550, 1600]
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  
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
  
  labels.forEach((label, index) => {
    const x = padding + (chartWidth / (data.length - 1)) * index
    ctx.fillText(label, x, rect.height - 10)
  })
}

const drawMessageActivityChart = () => {
  const canvas = messageActivityChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [1200, 1900, 3000, 5000, 2000, 3000, 4500]
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  
  // Chart dimensions
  const padding = 40
  const chartWidth = rect.width - padding * 2
  const chartHeight = rect.height - padding * 2
  
  // Draw bars
  const barWidth = chartWidth / data.length * 0.8
  const barSpacing = chartWidth / data.length * 0.2
  const maxValue = Math.max(...data)
  
  ctx.fillStyle = '#3b82f6'
  
  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight
    const x = padding + (barWidth + barSpacing) * index
    const y = padding + chartHeight - barHeight
    
    ctx.fillRect(x, y, barWidth, barHeight)
  })
  
  // Draw labels
  ctx.fillStyle = '#64748b'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  
  labels.forEach((label, index) => {
    const x = padding + (barWidth + barSpacing) * index + barWidth / 2
    ctx.fillText(label, x, rect.height - 10)
  })
}

const drawChannelActivityChart = () => {
  const canvas = channelActivityChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [
    { name: 'general', value: 35 },
    { name: 'memes', value: 25 },
    { name: 'gaming', value: 20 },
    { name: 'music', value: 10 },
    { name: 'art', value: 10 }
  ]
  
  // Chart dimensions
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const radius = Math.min(centerX, centerY) - 40
  
  // Colors
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
  ]
  
  // Draw pie chart
  let startAngle = 0
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI
    
    ctx.fillStyle = colors[index % colors.length]
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle)
    ctx.closePath()
    ctx.fill()
    
    // Draw label
    const labelAngle = startAngle + sliceAngle / 2
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7)
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.value}%`, labelX, labelY)
    
    startAngle += sliceAngle
  })
  
  // Draw legend
  const legendX = rect.width - 100
  const legendY = 20
  
  data.forEach((item, index) => {
    const y = legendY + index * 20
    
    ctx.fillStyle = colors[index % colors.length]
    ctx.fillRect(legendX, y, 12, 12)
    
    ctx.fillStyle = '#64748b'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(item.name, legendX + 20, y + 10)
  })
}

const drawUserEngagementChart = () => {
  const canvas = userEngagementChart.value!
  const ctx = canvas.getContext('2d')!
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  // Sample data
  const data = [
    { name: 'Active', value: 45 },
    { name: 'Lurkers', value: 25 },
    { name: 'New', value: 20 },
    { name: 'Inactive', value: 10 }
  ]
  
  // Chart dimensions
  const padding = 40
  const chartWidth = rect.width - padding * 2
  const chartHeight = rect.height - padding * 2
  
  // Colors
  const colors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#94a3b8'
  ]
  
  // Draw bars
  const barWidth = chartWidth / data.length * 0.8
  const barSpacing = chartWidth / data.length * 0.2
  const maxValue = 100 // Percentage
  
  data.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight
    const x = padding + (barWidth + barSpacing) * index
    const y = padding + chartHeight - barHeight
    
    ctx.fillStyle = colors[index % colors.length]
    ctx.fillRect(x, y, barWidth, barHeight)
    
    // Draw percentage
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${item.value}%`, x + barWidth / 2, y + barHeight / 2)
    
    // Draw label
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    ctx.fillText(item.name, x + barWidth / 2, rect.height - 10)
  })
}

const drawHeatmap = () => {
  const container = heatmapContainer.value!
  container.innerHTML = ''
  
  // Sample data - activity by hour and day
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  // Create heatmap grid
  const grid = document.createElement('div')
  grid.className = 'grid grid-cols-25 gap-1'
  container.appendChild(grid)
  
  // Add empty cell for top-left corner
  const cornerCell = document.createElement('div')
  cornerCell.className = 'text-xs text-muted-foreground'
  grid.appendChild(cornerCell)
  
  // Add hour labels
  hours.forEach(hour => {
    const hourLabel = document.createElement('div')
    hourLabel.className = 'text-xs text-muted-foreground text-center'
    hourLabel.textContent = hour.toString()
    grid.appendChild(hourLabel)
  })
  
  // Add day rows with cells
  days.forEach(day => {
    // Day label
    const dayLabel = document.createElement('div')
    dayLabel.className = 'text-xs text-muted-foreground'
    dayLabel.textContent = day
    grid.appendChild(dayLabel)
    
    // Hour cells
    hours.forEach(hour => {
      const cell = document.createElement('div')
      
      // Random activity level for demo
      const activity = Math.floor(Math.random() * 5)
      let bgClass = 'bg-muted'
      
      if (activity === 1) bgClass = 'bg-blue-200'
      else if (activity === 2) bgClass = 'bg-blue-400'
      else if (activity === 3) bgClass = 'bg-blue-600'
      else if (activity === 4) bgClass = 'bg-blue-800'
      
      cell.className = `w-4 h-4 rounded-sm ${bgClass}`
      cell.title = `${day} at ${hour}:00 - Activity level: ${activity}`
      grid.appendChild(cell)
    })
  })
  
  // Add legend
  const legend = document.createElement('div')
  legend.className = 'flex items-center gap-2 text-xs text-muted-foreground mt-4'
  legend.innerHTML = `
    <span>Less</span>
    <div class="flex gap-1">
      <div class="w-3 h-3 bg-muted rounded-sm"></div>
      <div class="w-3 h-3 bg-blue-200 rounded-sm"></div>
      <div class="w-3 h-3 bg-blue-400 rounded-sm"></div>
      <div class="w-3 h-3 bg-blue-600 rounded-sm"></div>
      <div class="w-3 h-3 bg-blue-800 rounded-sm"></div>
    </div>
    <span>More</span>
  `
  container.appendChild(legend)
}

// Draw charts when component mounts
onMounted(async () => {
  await nextTick()
  drawMemberGrowthChart()
  drawMessageActivityChart()
  drawChannelActivityChart()
  drawUserEngagementChart()
  drawHeatmap()
})

// Redraw charts when time range changes
watch(selectedTimeRange, async () => {
  await nextTick()
  drawMemberGrowthChart()
  drawMessageActivityChart()
  drawChannelActivityChart()
  drawUserEngagementChart()
  drawHeatmap()
})
</script>