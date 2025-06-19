<template>
  <div class="space-y-6">
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="text-lg font-semibold text-foreground mb-4">Advanced Log Filters</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- User Filter -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">User</label>
          <input
            v-model="filters.user"
            type="text"
            placeholder="Username or ID"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          >
        </div>
        
        <!-- Action Type Filter -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">Action Type</label>
          <select v-model="filters.actionType" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Actions</option>
            <option v-for="action in actionTypes" :key="action" :value="action">
              {{ formatActionType(action) }}
            </option>
          </select>
        </div>
        
        <!-- Severity Filter -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">Severity</label>
          <select v-model="filters.severity" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        
        <!-- Date Range -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">Start Date</label>
          <input
            v-model="filters.startDate"
            type="datetime-local"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">End Date</label>
          <input
            v-model="filters.endDate"
            type="datetime-local"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          >
        </div>
        
        <!-- Channel Filter -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">Channel</label>
          <select v-model="filters.channelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Channels</option>
            <option v-for="channel in channels" :key="channel.id" :value="channel.id">
              #{{ channel.name }}
            </option>
          </select>
        </div>
      </div>
      
      <!-- Advanced Options -->
      <div class="mt-6 space-y-4">
        <div class="flex items-center space-x-4">
          <label class="flex items-center space-x-2">
            <input type="checkbox" v-model="filters.includeBot" class="rounded border-border text-primary focus:ring-primary">
            <span class="text-sm text-foreground">Include bot actions</span>
          </label>
          
          <label class="flex items-center space-x-2">
            <input type="checkbox" v-model="filters.includeSystem" class="rounded border-border text-primary focus:ring-primary">
            <span class="text-sm text-foreground">Include system events</span>
          </label>
          
          <label class="flex items-center space-x-2">
            <input type="checkbox" v-model="filters.onlyFlagged" class="rounded border-border text-primary focus:ring-primary">
            <span class="text-sm text-foreground">Only flagged events</span>
          </label>
        </div>
        
        <!-- Custom Query -->
        <div>
          <label class="block text-sm font-medium text-foreground mb-2">Custom Query</label>
          <input
            v-model="filters.customQuery"
            type="text"
            placeholder="reason:spam OR action:ban"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          >
          <p class="text-xs text-muted-foreground mt-1">
            Use operators: AND, OR, NOT. Fields: reason, action, user, channel
          </p>
        </div>
      </div>
      
      <!-- Filter Actions -->
      <div class="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <div class="flex items-center space-x-2">
          <button @click="saveFilter" class="text-sm text-primary hover:text-primary/80">
            Save Filter
          </button>
          <button @click="loadFilter" class="text-sm text-muted-foreground hover:text-foreground">
            Load Saved
          </button>
        </div>
        
        <div class="flex items-center space-x-2">
          <button @click="clearFilters" class="px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground">
            Clear
          </button>
          <button @click="applyFilters" class="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
    
    <!-- Filter Results Summary -->
    <div v-if="resultsCount !== null" class="bg-card border border-border rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div class="text-sm text-foreground">
          Found <strong>{{ resultsCount }}</strong> log entries matching your filters
        </div>
        <button @click="exportResults" class="text-sm text-primary hover:text-primary/80">
          Export Results
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

const filters = reactive({
  user: '',
  actionType: '',
  severity: '',
  startDate: '',
  endDate: '',
  channelId: '',
  includeBot: true,
  includeSystem: true,
  onlyFlagged: false,
  customQuery: ''
})

const resultsCount = ref<number | null>(null)

const actionTypes = [
  'MEMBER_JOIN',
  'MEMBER_LEAVE',
  'MEMBER_BAN',
  'MEMBER_KICK',
  'MESSAGE_DELETE',
  'MESSAGE_EDIT',
  'ROLE_CREATE',
  'ROLE_DELETE',
  'CHANNEL_CREATE',
  'CHANNEL_DELETE'
]

const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'moderation', name: 'moderation' },
  { id: 'announcements', name: 'announcements' },
  { id: 'logs', name: 'logs' }
])

const formatActionType = (action: string) => {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const applyFilters = () => {
  // Simulate API call
  setTimeout(() => {
    resultsCount.value = Math.floor(Math.random() * 1000) + 50
    toastStore.addToast('Filters applied successfully', 'success')
  }, 500)
}

const clearFilters = () => {
  Object.keys(filters).forEach(key => {
    if (typeof filters[key] === 'boolean') {
      filters[key] = key === 'includeBot' || key === 'includeSystem'
    } else {
      filters[key] = ''
    }
  })
  resultsCount.value = null
  toastStore.addToast('Filters cleared', 'info')
}

const saveFilter = () => {
  const filterName = prompt('Enter a name for this filter:')
  if (filterName) {
    // Save to localStorage or API
    localStorage.setItem(`log-filter-${filterName}`, JSON.stringify(filters))
    toastStore.addToast(`Filter "${filterName}" saved`, 'success')
  }
}

const loadFilter = () => {
  // Show modal with saved filters or implement dropdown
  toastStore.addToast('Load filter functionality would open here', 'info')
}

const exportResults = () => {
  // Export filtered results
  toastStore.addToast('Exporting filtered results...', 'info')
}
</script>