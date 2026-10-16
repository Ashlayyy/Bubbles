<template>
  <div class="space-y-6">
    <!-- Widget Controls -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-foreground">Dashboard Widgets</h2>
      <div class="flex items-center gap-2">
        <button @click="toggleEditMode" :class="[
          'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          editMode ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        ]">
          {{ editMode ? 'Done Editing' : 'Customize' }}
        </button>
        <button @click="resetLayout" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          Reset Layout
        </button>
      </div>
    </div>

    <!-- Available Widgets (shown in edit mode) -->
    <div v-if="editMode" class="bg-card border border-border rounded-lg p-4">
      <h3 class="font-medium text-foreground mb-3">Available Widgets</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          v-for="widget in availableWidgets"
          :key="widget.id"
          @click="addWidget(widget)"
          :disabled="isWidgetActive(widget.id)"
          class="p-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div class="font-medium text-foreground">{{ widget.title }}</div>
          <div class="text-sm text-muted-foreground">{{ widget.description }}</div>
        </button>
      </div>
    </div>

    <!-- Widget Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref="widgetContainer">
      <div
        v-for="widget in activeWidgets"
        :key="widget.id"
        :class="[
          'bg-card border border-border rounded-lg overflow-hidden transition-all duration-200',
          editMode ? 'cursor-move hover:shadow-lg' : '',
          widget.size === 'large' ? 'md:col-span-2' : '',
          widget.size === 'full' ? 'md:col-span-3' : ''
        ]"
        :draggable="editMode"
        @dragstart="handleDragStart($event, widget)"
        @dragover="handleDragOver"
        @drop="handleDrop($event, widget)"
      >
        <!-- Widget Header -->
        <div class="p-4 border-b border-border flex items-center justify-between">
          <h3 class="font-semibold text-foreground">{{ widget.title }}</h3>
          <div v-if="editMode" class="flex items-center gap-2">
            <select
              v-model="widget.size"
              @change="updateWidget(widget)"
              class="text-xs bg-background border border-border rounded px-2 py-1"
            >
              <option value="small">Small</option>
              <option value="large">Large</option>
              <option value="full">Full Width</option>
            </select>
            <button @click="removeWidget(widget.id)" class="text-destructive hover:text-destructive/80">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Widget Content -->
        <div class="p-4">
          <component :is="getWidgetComponent(widget.type)" :widget="widget" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="activeWidgets.length === 0" class="text-center py-12">
      <div class="text-muted-foreground mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
          <rect width="7" height="9" x="3" y="3" rx="1"/>
          <rect width="7" height="5" x="14" y="3" rx="1"/>
          <rect width="7" height="9" x="14" y="12" rx="1"/>
          <rect width="7" height="5" x="3" y="16" rx="1"/>
        </svg>
        <p class="text-lg font-medium">No widgets configured</p>
        <p class="text-sm">Click "Customize" to add widgets to your dashboard</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface Widget {
  id: string
  type: string
  title: string
  description: string
  size: 'small' | 'large' | 'full'
  order: number
  config?: any
}

const editMode = ref(false)
const draggedWidget = ref<Widget | null>(null)

const availableWidgets = ref([
  { id: 'server-stats', type: 'ServerStats', title: 'Server Statistics', description: 'Member count, online users, channels' },
  { id: 'recent-activity', type: 'RecentActivity', title: 'Recent Activity', description: 'Latest server events and actions' },
  { id: 'member-growth', type: 'MemberGrowth', title: 'Member Growth', description: 'Growth chart over time' },
  { id: 'mod-actions', type: 'ModActions', title: 'Moderation Actions', description: 'Recent moderation activity' },
  { id: 'top-channels', type: 'TopChannels', title: 'Top Channels', description: 'Most active channels' },
  { id: 'system-health', type: 'SystemHealth', title: 'System Health', description: 'Bot performance metrics' },
  { id: 'quick-actions', type: 'QuickActions', title: 'Quick Actions', description: 'Common moderation tools' },
  { id: 'announcements', type: 'Announcements', title: 'Announcements', description: 'Important server updates' }
])

const activeWidgets = ref<Widget[]>([
  { id: 'server-stats', type: 'ServerStats', title: 'Server Statistics', description: '', size: 'small', order: 0 },
  { id: 'recent-activity', type: 'RecentActivity', title: 'Recent Activity', description: '', size: 'large', order: 1 },
  { id: 'member-growth', type: 'MemberGrowth', title: 'Member Growth', description: '', size: 'full', order: 2 }
])

const isWidgetActive = (widgetId: string) => {
  return activeWidgets.value.some(w => w.id === widgetId)
}

const addWidget = (widget: any) => {
  const newWidget: Widget = {
    ...widget,
    size: 'small',
    order: activeWidgets.value.length
  }
  activeWidgets.value.push(newWidget)
  toastStore.addToast(`Added ${widget.title} widget`, 'success')
}

const removeWidget = (widgetId: string) => {
  const index = activeWidgets.value.findIndex(w => w.id === widgetId)
  if (index !== -1) {
    const widget = activeWidgets.value[index]
    activeWidgets.value.splice(index, 1)
    toastStore.addToast(`Removed ${widget.title} widget`, 'success')
  }
}

const updateWidget = (widget: Widget) => {
  // Widget updated, could save to backend here
}

const toggleEditMode = () => {
  editMode.value = !editMode.value
  if (!editMode.value) {
    // Save layout
    toastStore.addToast('Dashboard layout saved', 'success')
  }
}

const resetLayout = () => {
  if (confirm('Reset dashboard to default layout?')) {
    activeWidgets.value = [
      { id: 'server-stats', type: 'ServerStats', title: 'Server Statistics', description: '', size: 'small', order: 0 },
      { id: 'recent-activity', type: 'RecentActivity', title: 'Recent Activity', description: '', size: 'large', order: 1 },
      { id: 'member-growth', type: 'MemberGrowth', title: 'Member Growth', description: '', size: 'full', order: 2 }
    ]
    toastStore.addToast('Dashboard reset to default layout', 'success')
  }
}

// Drag and drop functionality
const handleDragStart = (e: DragEvent, widget: Widget) => {
  if (!editMode.value) return
  draggedWidget.value = widget
  e.dataTransfer!.effectAllowed = 'move'
}

const handleDragOver = (e: DragEvent) => {
  if (!editMode.value) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
}

const handleDrop = (e: DragEvent, targetWidget: Widget) => {
  if (!editMode.value || !draggedWidget.value) return
  e.preventDefault()
  
  const draggedIndex = activeWidgets.value.findIndex(w => w.id === draggedWidget.value!.id)
  const targetIndex = activeWidgets.value.findIndex(w => w.id === targetWidget.id)
  
  if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
    // Swap widgets
    const temp = activeWidgets.value[draggedIndex]
    activeWidgets.value[draggedIndex] = activeWidgets.value[targetIndex]
    activeWidgets.value[targetIndex] = temp
    
    // Update order
    activeWidgets.value.forEach((widget, index) => {
      widget.order = index
    })
  }
  
  draggedWidget.value = null
}

const getWidgetComponent = (type: string) => {
  // Return the appropriate widget component based on type
  switch (type) {
    case 'ServerStats':
      return 'ServerStatsWidget'
    case 'RecentActivity':
      return 'RecentActivityWidget'
    case 'MemberGrowth':
      return 'MemberGrowthWidget'
    case 'ModActions':
      return 'ModActionsWidget'
    case 'TopChannels':
      return 'TopChannelsWidget'
    case 'SystemHealth':
      return 'SystemHealthWidget'
    case 'QuickActions':
      return 'QuickActionsWidget'
    case 'Announcements':
      return 'AnnouncementsWidget'
    default:
      return 'DefaultWidget'
  }
}

// Load saved layout on mount
onMounted(() => {
  // Load from localStorage or API
  const savedLayout = localStorage.getItem('dashboard-layout')
  if (savedLayout) {
    try {
      activeWidgets.value = JSON.parse(savedLayout)
    } catch (e) {
      console.error('Failed to load saved layout:', e)
    }
  }
})

// Save layout when widgets change
const saveLayout = () => {
  localStorage.setItem('dashboard-layout', JSON.stringify(activeWidgets.value))
}
</script>