<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-semibold text-foreground">Ticket System</h2>
      <button @click="showCreateModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
        Create Ticket
      </button>
    </div>

    <!-- Ticket Categories -->
    <div class="bg-card border border-border rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-foreground">Ticket Categories</h3>
        <button @click="showCategoryModal = true" class="text-sm text-primary hover:text-primary/80">
          + Add Category
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="category in categories" :key="category.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-center gap-3 mb-2">
            <div class="text-2xl">{{ category.emoji }}</div>
            <div>
              <h4 class="font-medium text-foreground">{{ category.name }}</h4>
              <p class="text-xs text-muted-foreground">{{ category.description }}</p>
            </div>
          </div>
          
          <div class="text-sm text-muted-foreground">
            <div>Staff Roles: {{ category.staffRoles.join(', ') }}</div>
            <div>Auto-close: {{ category.autoClose ? `${category.autoCloseTime}h` : 'Disabled' }}</div>
          </div>
          
          <div class="flex items-center justify-end gap-2 mt-3">
            <button @click="editCategory(category)" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button @click="deleteCategory(category.id)" class="text-muted-foreground hover:text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Tickets -->
    <div class="bg-card border border-border rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-foreground">Active Tickets</h3>
        <div class="flex items-center gap-2">
          <input
            v-model="ticketSearch"
            type="text"
            placeholder="Search tickets..."
            class="bg-background border border-border rounded-lg px-3 py-2 text-foreground"
          >
          <select v-model="ticketFilter" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="all">All Categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
      </div>
      
      <div v-if="filteredTickets.length === 0" class="text-center py-8">
        <p class="text-muted-foreground">No active tickets found</p>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="ticket in filteredTickets" :key="ticket.id" class="bg-secondary/50 rounded-lg p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-medium text-foreground">{{ ticket.subject }}</h4>
                <span :class="getPriorityColor(ticket.priority)" class="px-2 py-1 rounded-full text-xs font-medium">
                  {{ ticket.priority }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground">Opened by {{ ticket.username }} • {{ formatDate(ticket.createdAt) }}</p>
            </div>
            
            <div class="flex items-center gap-2">
              <button @click="viewTicket(ticket)" class="px-3 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                View
              </button>
              <button @click="closeTicket(ticket.id)" class="px-3 py-1 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Close
              </button>
            </div>
          </div>
          
          <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div>
              <span class="font-medium">Category:</span>
              <span class="ml-1">{{ ticket.categoryName }}</span>
            </div>
            <div>
              <span class="font-medium">Messages:</span>
              <span class="ml-1">{{ ticket.messages }}</span>
            </div>
            <div>
              <span class="font-medium">Last Activity:</span>
              <span class="ml-1">{{ formatTimeAgo(ticket.lastActivity) }}</span>
            </div>
            <div>
              <span class="font-medium">Status:</span>
              <span class="ml-1">{{ ticket.status }}</span>
            </div>
          </div>
          
          <div v-if="ticket.assignedStaff.length > 0" class="mt-2 pt-2 border-t border-border">
            <div class="text-xs text-muted-foreground">
              <span class="font-medium">Assigned to:</span>
              <span class="ml-1">{{ ticket.assignedStaff.join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ticket Settings -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="font-semibold text-foreground mb-4">Ticket Settings</h3>
      
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Enable Ticket System</label>
            <p class="text-sm text-muted-foreground">Allow users to create support tickets</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="ticketSettings.enabled" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Support Channel</label>
            <select v-model="ticketSettings.supportChannelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="">Select a channel</option>
              <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                #{{ channel.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Archive Channel</label>
            <select v-model="ticketSettings.archiveChannelId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="">Select a channel</option>
              <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                #{{ channel.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Max Tickets Per User</label>
            <input v-model.number="ticketSettings.maxTicketsPerUser" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Close Inactive After (hours)</label>
            <input v-model.number="ticketSettings.closeInactiveAfter" type="number" min="0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <p class="text-xs text-muted-foreground mt-1">Set to 0 to disable auto-closing</p>
          </div>
        </div>
        
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Require Close Reason</label>
            <p class="text-sm text-muted-foreground">Staff must provide a reason when closing tickets</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="ticketSettings.requireCloseReason" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div class="flex items-center justify-between">
          <div>
            <label class="font-medium text-foreground">Auto-assign Staff</label>
            <p class="text-sm text-muted-foreground">Automatically assign available staff to new tickets</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="ticketSettings.autoAssignStaff" class="sr-only peer">
            <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>
      
      <div class="flex justify-end mt-6">
        <button @click="saveSettings" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          Save Settings
        </button>
      </div>
    </div>

    <!-- Create Ticket Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold text-foreground mb-4">Create New Ticket</h3>
        
        <form @submit.prevent="createTicket" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">User</label>
            <input v-model="newTicket.userId" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="User ID or @username" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Category</label>
            <select v-model="newTicket.categoryId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.emoji }} {{ category.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Subject</label>
            <input v-model="newTicket.subject" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Priority</label>
            <select v-model="newTicket.priority" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Initial Message</label>
            <textarea v-model="newTicket.message" rows="3" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCreateModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold text-foreground mb-4">
          {{ editingCategory ? 'Edit Category' : 'Add Category' }}
        </h3>
        
        <form @submit.prevent="saveCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Name</label>
            <input v-model="categoryForm.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Description</label>
            <input v-model="categoryForm.description" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Emoji</label>
            <input v-model="categoryForm.emoji" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="🎫">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Staff Roles (comma separated)</label>
            <input v-model="categoryForm.staffRolesInput" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="Admin, Moderator">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Channel Prefix</label>
            <input v-model="categoryForm.channelPrefix" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="ticket">
          </div>
          
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="categoryForm.autoClose" id="autoClose" class="rounded border-border text-primary focus:ring-primary">
            <label for="autoClose" class="text-sm text-foreground">Auto-close inactive tickets</label>
          </div>
          
          <div v-if="categoryForm.autoClose">
            <label class="block text-sm font-medium text-foreground mb-2">Auto-close after (hours)</label>
            <input v-model.number="categoryForm.autoCloseTime" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCategoryModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingCategory ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Ticket View Modal -->
    <div v-if="showTicketModal && selectedTicket" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div class="p-6 border-b border-border">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-lg font-semibold text-foreground">{{ selectedTicket.subject }}</h3>
              <p class="text-sm text-muted-foreground">
                Ticket #{{ selectedTicket.id }} • {{ selectedTicket.categoryName }} • 
                <span :class="getPriorityColor(selectedTicket.priority)">{{ selectedTicket.priority }}</span>
              </p>
            </div>
            <button @click="showTicketModal = false" class="text-muted-foreground hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="p-6 space-y-6">
          <!-- Ticket Info -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">Opened by:</span>
              <span class="ml-2 text-foreground">{{ selectedTicket.username }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Created:</span>
              <span class="ml-2 text-foreground">{{ formatDate(selectedTicket.createdAt) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Status:</span>
              <span class="ml-2 text-foreground">{{ selectedTicket.status }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">Messages:</span>
              <span class="ml-2 text-foreground">{{ selectedTicket.messages }}</span>
            </div>
          </div>
          
          <!-- Ticket Messages -->
          <div class="space-y-4">
            <div class="bg-secondary/50 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span class="text-primary font-bold">{{ selectedTicket.username.charAt(0) }}</span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-foreground">{{ selectedTicket.username }}</span>
                    <span class="text-xs text-muted-foreground">{{ formatDate(selectedTicket.createdAt) }}</span>
                  </div>
                  <div class="mt-2 text-foreground">{{ newTicket.message || 'Initial ticket message would appear here.' }}</div>
                </div>
              </div>
            </div>
            
            <!-- More messages would be loaded here -->
            <div class="text-center text-muted-foreground py-4">
              <p>Previous messages would be loaded here</p>
            </div>
          </div>
          
          <!-- Reply Form -->
          <div class="bg-secondary/50 rounded-lg p-4">
            <textarea v-model="ticketReply" rows="3" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground mb-3" placeholder="Type your reply..."></textarea>
            <div class="flex justify-between">
              <div class="flex items-center gap-2">
                <button class="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </button>
                <button class="text-muted-foreground hover:text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>
              </div>
              <button @click="sendReply" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                Send Reply
              </button>
            </div>
          </div>
        </div>
        
        <div class="p-6 border-t border-border flex justify-between">
          <div class="flex items-center gap-2">
            <button @click="assignStaff" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Assign Staff
            </button>
            <button @click="transferTicket" class="px-3 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Transfer
            </button>
          </div>
          <button @click="closeSelectedTicket" class="px-3 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
            Close Ticket
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()

interface TicketCategory {
  id: string
  name: string
  description: string
  emoji: string
  staffRoles: string[]
  channelPrefix: string
  autoClose: boolean
  autoCloseTime: number
}

interface Ticket {
  id: string
  categoryId: string
  categoryName: string
  userId: string
  username: string
  subject: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'closed' | 'pending'
  createdAt: Date
  lastActivity: Date
  messages: number
  assignedStaff: string[]
}

// Modals
const showCreateModal = ref(false)
const showCategoryModal = ref(false)
const showTicketModal = ref(false)

// Form data
const newTicket = reactive({
  userId: '',
  categoryId: '',
  subject: '',
  priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  message: ''
})

const categoryForm = reactive({
  id: '',
  name: '',
  description: '',
  emoji: '🎫',
  staffRolesInput: '',
  channelPrefix: 'ticket',
  autoClose: false,
  autoCloseTime: 24
})

// Ticket reply
const ticketReply = ref('')

// Editing state
const editingCategory = ref<TicketCategory | null>(null)
const selectedTicket = ref<Ticket | null>(null)

// Filters
const ticketSearch = ref('')
const ticketFilter = ref('all')

// Sample data
const categories = ref<TicketCategory[]>([
  {
    id: '1',
    name: 'General Support',
    description: 'General questions and support',
    emoji: '🎫',
    staffRoles: ['Support Staff', 'Moderator'],
    channelPrefix: 'ticket',
    autoClose: true,
    autoCloseTime: 24
  },
  {
    id: '2',
    name: 'Report User',
    description: 'Report a user for breaking rules',
    emoji: '🚨',
    staffRoles: ['Moderator', 'Admin'],
    channelPrefix: 'report',
    autoClose: false,
    autoCloseTime: 0
  }
])

const tickets = ref<Ticket[]>([
  {
    id: '1001',
    categoryId: '1',
    categoryName: 'General Support',
    userId: '123456789',
    username: 'UserNeedingHelp',
    subject: 'Cannot access certain channels',
    priority: 'medium',
    status: 'open',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 30 * 60 * 1000),
    messages: 5,
    assignedStaff: ['ModeratorUser']
  },
  {
    id: '1002',
    categoryId: '2',
    categoryName: 'Report User',
    userId: '987654321',
    username: 'ReportingUser',
    subject: 'User spamming in general chat',
    priority: 'high',
    status: 'open',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000),
    messages: 8,
    assignedStaff: []
  }
])

const channels = ref([
  { id: 'general', name: 'general' },
  { id: 'support', name: 'support' },
  { id: 'ticket-logs', name: 'ticket-logs' },
  { id: 'ticket-archive', name: 'ticket-archive' }
])

const ticketSettings = reactive({
  enabled: true,
  supportChannelId: 'support',
  archiveChannelId: 'ticket-archive',
  maxTicketsPerUser: 3,
  closeInactiveAfter: 72,
  requireCloseReason: true,
  autoAssignStaff: true
})

// Computed properties
const filteredTickets = computed(() => {
  let filtered = tickets.value.filter(ticket => ticket.status === 'open')
  
  if (ticketSearch.value) {
    const search = ticketSearch.value.toLowerCase()
    filtered = filtered.filter(ticket => 
      ticket.subject.toLowerCase().includes(search) ||
      ticket.username.toLowerCase().includes(search) ||
      ticket.id.includes(search)
    )
  }
  
  if (ticketFilter.value !== 'all') {
    filtered = filtered.filter(ticket => ticket.categoryId === ticketFilter.value)
  }
  
  return filtered
})

// Methods
const formatDate = (date: Date) => {
  return date.toLocaleString()
}

const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

const createTicket = () => {
  const category = categories.value.find(c => c.id === newTicket.categoryId)
  if (!category) return
  
  const ticket: Ticket = {
    id: Math.floor(1000 + Math.random() * 9000).toString(),
    categoryId: newTicket.categoryId,
    categoryName: category.name,
    userId: newTicket.userId,
    username: newTicket.userId.includes('@') ? newTicket.userId : `User${newTicket.userId.slice(-4)}`,
    subject: newTicket.subject,
    priority: newTicket.priority,
    status: 'open',
    createdAt: new Date(),
    lastActivity: new Date(),
    messages: 1,
    assignedStaff: []
  }
  
  tickets.value.push(ticket)
  toastStore.addToast(`Ticket #${ticket.id} created successfully!`, 'success')
  showCreateModal.value = false
  
  // Reset form
  Object.assign(newTicket, {
    userId: '',
    categoryId: '',
    subject: '',
    priority: 'medium',
    message: ''
  })
}

const editCategory = (category: TicketCategory) => {
  editingCategory.value = category
  Object.assign(categoryForm, {
    id: category.id,
    name: category.name,
    description: category.description,
    emoji: category.emoji,
    staffRolesInput: category.staffRoles.join(', '),
    channelPrefix: category.channelPrefix,
    autoClose: category.autoClose,
    autoCloseTime: category.autoCloseTime
  })
  showCategoryModal.value = true
}

const deleteCategory = (categoryId: string) => {
  if (confirm('Are you sure you want to delete this category? This will not affect existing tickets.')) {
    const index = categories.value.findIndex(c => c.id === categoryId)
    if (index !== -1) {
      categories.value.splice(index, 1)
      toastStore.addToast('Category deleted successfully!', 'success')
    }
  }
}

const saveCategory = () => {
  const staffRoles = categoryForm.staffRolesInput
    .split(',')
    .map(role => role.trim())
    .filter(role => role.length > 0)
  
  if (editingCategory.value) {
    // Update existing category
    const index = categories.value.findIndex(c => c.id === categoryForm.id)
    if (index !== -1) {
      categories.value[index] = {
        ...categories.value[index],
        name: categoryForm.name,
        description: categoryForm.description,
        emoji: categoryForm.emoji,
        staffRoles,
        channelPrefix: categoryForm.channelPrefix,
        autoClose: categoryForm.autoClose,
        autoCloseTime: categoryForm.autoCloseTime
      }
      toastStore.addToast('Category updated successfully!', 'success')
    }
  } else {
    // Create new category
    const newCategory: TicketCategory = {
      id: Date.now().toString(),
      name: categoryForm.name,
      description: categoryForm.description,
      emoji: categoryForm.emoji,
      staffRoles,
      channelPrefix: categoryForm.channelPrefix,
      autoClose: categoryForm.autoClose,
      autoCloseTime: categoryForm.autoCloseTime
    }
    categories.value.push(newCategory)
    toastStore.addToast('Category created successfully!', 'success')
  }
  
  showCategoryModal.value = false
  editingCategory.value = null
  
  // Reset form
  Object.assign(categoryForm, {
    id: '',
    name: '',
    description: '',
    emoji: '🎫',
    staffRolesInput: '',
    channelPrefix: 'ticket',
    autoClose: false,
    autoCloseTime: 24
  })
}

const viewTicket = (ticket: Ticket) => {
  selectedTicket.value = ticket
  showTicketModal.value = true
}

const closeTicket = (ticketId: string) => {
  if (ticketSettings.requireCloseReason) {
    const reason = prompt('Please provide a reason for closing this ticket:')
    if (!reason) return
  }
  
  const index = tickets.value.findIndex(t => t.id === ticketId)
  if (index !== -1) {
    tickets.value[index].status = 'closed'
    toastStore.addToast(`Ticket #${ticketId} closed successfully!`, 'success')
  }
}

const closeSelectedTicket = () => {
  if (!selectedTicket.value) return
  
  if (ticketSettings.requireCloseReason) {
    const reason = prompt('Please provide a reason for closing this ticket:')
    if (!reason) return
  }
  
  const index = tickets.value.findIndex(t => t.id === selectedTicket.value!.id)
  if (index !== -1) {
    tickets.value[index].status = 'closed'
    toastStore.addToast(`Ticket #${selectedTicket.value.id} closed successfully!`, 'success')
    showTicketModal.value = false
    selectedTicket.value = null
  }
}

const sendReply = () => {
  if (!selectedTicket.value || !ticketReply.value.trim()) return
  
  // In a real app, this would send the reply to the API
  const index = tickets.value.findIndex(t => t.id === selectedTicket.value!.id)
  if (index !== -1) {
    tickets.value[index].messages++
    tickets.value[index].lastActivity = new Date()
    toastStore.addToast('Reply sent successfully!', 'success')
    ticketReply.value = ''
  }
}

const assignStaff = () => {
  if (!selectedTicket.value) return
  
  const staffMember = prompt('Enter staff member username:')
  if (!staffMember) return
  
  const index = tickets.value.findIndex(t => t.id === selectedTicket.value!.id)
  if (index !== -1) {
    if (!tickets.value[index].assignedStaff.includes(staffMember)) {
      tickets.value[index].assignedStaff.push(staffMember)
      toastStore.addToast(`${staffMember} assigned to ticket #${selectedTicket.value.id}`, 'success')
    } else {
      toastStore.addToast(`${staffMember} is already assigned to this ticket`, 'error')
    }
  }
}

const transferTicket = () => {
  if (!selectedTicket.value) return
  
  const categoryId = prompt('Enter category ID to transfer to:')
  if (!categoryId) return
  
  const category = categories.value.find(c => c.id === categoryId)
  if (!category) {
    toastStore.addToast('Invalid category ID', 'error')
    return
  }
  
  const index = tickets.value.findIndex(t => t.id === selectedTicket.value!.id)
  if (index !== -1) {
    tickets.value[index].categoryId = categoryId
    tickets.value[index].categoryName = category.name
    toastStore.addToast(`Ticket transferred to ${category.name}`, 'success')
  }
}

const saveSettings = () => {
  toastStore.addToast('Ticket settings saved successfully!', 'success')
}
</script>