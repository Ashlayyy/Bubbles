<template>
  <div>
    <h1 class="text-3xl font-bold text-foreground mb-6">Tickets</h1>

    <!-- Tabs -->
    <div class="mb-6 border-b border-border">
      <nav class="-mb-px flex space-x-6">
        <button
          @click="activeTab = 'overview'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'open'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'open'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Open Tickets ({{ openTickets.length }})
        </button>
        <button
          @click="activeTab = 'closed'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'closed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Closed Tickets ({{ closedTickets.length }})
        </button>
        <button
          @click="activeTab = 'categories'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Categories
        </button>
        <button
          @click="activeTab = 'panels'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'panels'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Ticket Panels
        </button>
        <button
          @click="activeTab = 'settings'"
          :class="[
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
            activeTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          ]"
        >
          Settings
        </button>
      </nav>
    </div>

    <!-- Overview -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Open Tickets</h3>
          <p class="text-3xl font-bold text-primary">{{ openTickets.length }}</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Total Categories</h3>
          <p class="text-3xl font-bold text-green-600">{{ categories.length }}</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Closed Today</h3>
          <p class="text-3xl font-bold text-blue-600">{{ closedTickets.length }}</p>
        </div>
        <div class="bg-card border border-border rounded-lg p-6">
          <h3 class="text-lg font-semibold text-card-foreground mb-2">Avg Response Time</h3>
          <p class="text-3xl font-bold text-purple-600">2.5h</p>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-card border border-border rounded-lg p-6">
        <h3 class="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
        <div class="flex gap-4">
          <button @click="showCreateTicketModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
            Create Ticket
          </button>
          <button @click="showBulkActionsModal = true" class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors">
            Bulk Actions
          </button>
          <button @click="exportTickets" class="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg transition-colors">
            Export Data
          </button>
        </div>
      </div>
    </div>

    <!-- Open/Closed Tickets -->
    <div v-if="activeTab === 'open' || activeTab === 'closed'" class="space-y-4">
      <div class="flex justify-between items-center">
        <div class="flex gap-4">
          <input v-model="ticketSearchQuery" type="text" placeholder="Search tickets..." class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          <select v-model="selectedPriorityFilter" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select v-model="selectedCategoryFilter" class="bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
        <button v-if="activeTab === 'open'" @click="showCreateTicketModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">
          Create Ticket
        </button>
      </div>

      <div v-if="filteredTickets.length === 0" class="text-center py-12">
        <p class="text-muted-foreground">No {{ activeTab }} tickets found.</p>
      </div>
      
      <div v-for="ticket in filteredTickets" :key="ticket.id" class="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer" @click="openTicketDetails(ticket)">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <span class="font-medium text-card-foreground">{{ ticket.subject }}</span>
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {{ ticket.categoryName }}
              </span>
              <span :class="getPriorityColor(ticket.priority)" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium">
                {{ ticket.priority }}
              </span>
              <span v-if="ticket.assignedStaff.length > 0" class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Assigned
              </span>
            </div>
            <div class="text-sm text-muted-foreground mb-2">
              <span>By: {{ ticket.username }}</span>
              <span class="mx-2">•</span>
              <span>{{ ticket.messages }} messages</span>
              <span class="mx-2">•</span>
              <span>Created: {{ formatDate(ticket.createdAt) }}</span>
              <span v-if="ticket.closedAt" class="mx-2">•</span>
              <span v-if="ticket.closedAt">Closed: {{ formatDate(ticket.closedAt) }}</span>
            </div>
            <div v-if="ticket.assignedStaff.length > 0" class="text-sm text-muted-foreground">
              Assigned to: {{ ticket.assignedStaff.join(', ') }}
            </div>
          </div>
          <div class="text-sm text-muted-foreground">
            #{{ ticket.id }}
          </div>
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div v-if="activeTab === 'categories'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-card-foreground">Ticket Categories</h2>
        <button @click="showCategoryModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
          Add Category
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="category in categories" :key="category.id" class="bg-card border border-border rounded-lg p-4">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">{{ category.emoji }}</span>
              <div>
                <h3 class="font-semibold text-card-foreground">{{ category.name }}</h3>
                <p class="text-sm text-muted-foreground">{{ category.description }}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="editCategory(category)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button @click="deleteCategory(category.id)" class="text-muted-foreground hover:text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Staff Roles:</span>
              <span class="text-foreground">{{ category.staffRoles.join(', ') }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Channel Prefix:</span>
              <span class="text-foreground">{{ category.channelPrefix }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Auto Close:</span>
              <span class="text-foreground">{{ category.autoClose ? `${category.autoCloseTime}h` : 'Disabled' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ticket Panels -->
    <div v-if="activeTab === 'panels'" class="space-y-4">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold text-card-foreground">Ticket Panels</h2>
        <button @click="showPanelModal = true" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
          Create Panel
        </button>
      </div>
      
      <div class="space-y-4">
        <div v-for="panel in ticketPanels" :key="panel.id" class="bg-card border border-border rounded-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-card-foreground text-lg">{{ panel.title }}</h3>
              <p class="text-muted-foreground">{{ panel.description }}</p>
              <p class="text-sm text-muted-foreground mt-1">Channel: #{{ panel.channelName }}</p>
            </div>
            <div class="flex gap-2">
              <button @click="editPanel(panel)" class="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button @click="deletePanel(panel.id)" class="text-muted-foreground hover:text-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="bg-secondary/50 rounded-lg p-4 mb-4">
            <h4 class="font-medium text-foreground mb-2">{{ panel.embedTitle }}</h4>
            <p class="text-foreground text-sm">{{ panel.embedDescription }}</p>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <div v-for="category in panel.categories" :key="category.id" class="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
              <span>{{ category.emoji }}</span>
              <span>{{ category.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div v-if="activeTab === 'settings'" class="max-w-2xl space-y-6">
      <div class="bg-card border border-border rounded-lg p-6">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Ticket Settings</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Enable Tickets</label>
              <p class="text-sm text-muted-foreground">Allow users to create support tickets</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.enabled" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Support Channel</label>
            <input v-model="settings.supportChannelName" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="#ticket-support">
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Max Tickets Per User</label>
            <input v-model="settings.maxTicketsPerUser" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>

          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Close Inactive After (hours)</label>
            <input v-model="settings.closeInactiveAfter" type="number" min="0" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
            <p class="text-xs text-muted-foreground mt-1">Set to 0 to disable auto-closing</p>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Require Reason for Closing</label>
              <p class="text-sm text-muted-foreground">Staff must provide a reason when closing tickets</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.requireCloseReason" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="font-medium text-card-foreground">Auto-assign Staff</label>
              <p class="text-sm text-muted-foreground">Automatically assign available staff to new tickets</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settings.autoAssignStaff" class="sr-only peer">
              <div class="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button @click="saveSettings" class="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Create Ticket Modal -->
    <div v-if="showCreateTicketModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Create New Ticket</h2>
        <form @submit.prevent="createTicket" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">User (Discord ID or Username)</label>
            <input v-model="newTicket.userId" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="123456789012345678 or @username" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Category</label>
            <select v-model="newTicket.categoryId" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
              <option value="">Select a category</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.emoji }} {{ category.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Subject</label>
            <input v-model="newTicket.subject" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Priority</label>
            <select v-model="newTicket.priority" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Initial Message (Optional)</label>
            <textarea v-model="newTicket.initialMessage" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" rows="3" placeholder="Initial message for the ticket..."></textarea>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCreateTicketModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">
          {{ editingCategory ? 'Edit Category' : 'Add Category' }}
        </h2>
        <form @submit.prevent="saveCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Name</label>
            <input v-model="categoryForm.name" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Description</label>
            <input v-model="categoryForm.description" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Emoji</label>
            <input v-model="categoryForm.emoji" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="🎫" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Channel Prefix</label>
            <input v-model="categoryForm.channelPrefix" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="ticket" required>
          </div>
          <div class="flex items-center space-x-2">
            <input type="checkbox" v-model="categoryForm.autoClose" id="autoClose" class="rounded border-border text-primary focus:ring-primary">
            <label for="autoClose" class="text-sm font-medium text-card-foreground">Auto-close inactive tickets</label>
          </div>
          <div v-if="categoryForm.autoClose">
            <label class="block text-sm font-medium text-card-foreground mb-2">Auto-close after (hours)</label>
            <input v-model.number="categoryForm.autoCloseTime" type="number" min="1" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground">
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showCategoryModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              {{ editingCategory ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Panel Modal -->
    <div v-if="showPanelModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold text-card-foreground mb-4">Create Ticket Panel</h2>
        <form @submit.prevent="savePanel" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Title</label>
            <input v-model="panelForm.title" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Description</label>
            <input v-model="panelForm.description" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Channel</label>
            <input v-model="panelForm.channelName" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" placeholder="support" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Embed Title</label>
            <input v-model="panelForm.embedTitle" type="text" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Embed Description</label>
            <textarea v-model="panelForm.embedDescription" rows="3" class="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground" required></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-card-foreground mb-2">Categories</label>
            <div class="space-y-2">
              <div v-for="category in categories" :key="category.id" class="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  :id="`category-${category.id}`" 
                  :value="category.id" 
                  v-model="panelForm.selectedCategories"
                  class="rounded border-border text-primary focus:ring-primary"
                >
                <label :for="`category-${category.id}`" class="text-sm font-medium text-card-foreground">
                  {{ category.emoji }} {{ category.name }}
                </label>
              </div>
            </div>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" @click="showPanelModal = false" class="px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              Create Panel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTicketsStore } from '@/stores/tickets'
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast'

const ticketsStore = useTicketsStore()
const { settings, categories, tickets, openTickets, closedTickets } = storeToRefs(ticketsStore)
const toastStore = useToastStore()

const activeTab = ref<'overview' | 'open' | 'closed' | 'categories' | 'panels' | 'settings'>('overview')

// Modal states
const showCreateTicketModal = ref(false)
const showCategoryModal = ref(false)
const showPanelModal = ref(false)
const showBulkActionsModal = ref(false)

// Form states
const editingCategory = ref(false)
const categoryForm = ref({
  id: '',
  name: '',
  description: '',
  emoji: '🎫',
  staffRoles: ['Support Staff'],
  channelPrefix: 'ticket',
  autoClose: false,
  autoCloseTime: 24
})

const panelForm = ref({
  title: '',
  description: '',
  channelName: '',
  embedTitle: '',
  embedDescription: '',
  selectedCategories: [] as string[]
})

const newTicket = ref({
  userId: '',
  categoryId: '',
  subject: '',
  priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  initialMessage: ''
})

// Filter states
const ticketSearchQuery = ref('')
const selectedPriorityFilter = ref('')
const selectedCategoryFilter = ref('')

// Mock ticket panels data
const ticketPanels = ref([
  {
    id: '1',
    title: 'Support Panel',
    description: 'Get help from our support team',
    channelName: 'support',
    embedTitle: 'Need Help?',
    embedDescription: 'Click the buttons below to create a support ticket',
    categories: [
      { id: '1', name: 'General Support', emoji: '🎫' },
      { id: '2', name: 'Report User', emoji: '🚨' }
    ]
  }
])

const filteredTickets = computed(() => {
  let filtered = activeTab.value === 'open' ? openTickets.value : closedTickets.value
  
  if (ticketSearchQuery.value) {
    filtered = filtered.filter(ticket => 
      ticket.subject.toLowerCase().includes(ticketSearchQuery.value.toLowerCase()) ||
      ticket.username.toLowerCase().includes(ticketSearchQuery.value.toLowerCase())
    )
  }
  
  if (selectedPriorityFilter.value) {
    filtered = filtered.filter(ticket => ticket.priority === selectedPriorityFilter.value)
  }
  
  if (selectedCategoryFilter.value) {
    filtered = filtered.filter(ticket => ticket.categoryId === selectedCategoryFilter.value)
  }
  
  return filtered
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
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
  const category = categories.value.find(c => c.id === newTicket.value.categoryId)
  if (!category) return

  const ticket = {
    id: Date.now().toString(),
    categoryId: newTicket.value.categoryId,
    categoryName: category.name,
    userId: newTicket.value.userId,
    username: `User${newTicket.value.userId.slice(-4)}`,
    channelId: `channel-${Date.now()}`,
    status: 'open' as const,
    priority: newTicket.value.priority,
    subject: newTicket.value.subject,
    createdAt: new Date().toISOString(),
    messages: 1,
    assignedStaff: []
  }

  tickets.value.push(ticket)
  showCreateTicketModal.value = false
  
  // Reset form
  newTicket.value = {
    userId: '',
    categoryId: '',
    subject: '',
    priority: 'medium',
    initialMessage: ''
  }
  
  toastStore.addToast('Ticket created successfully!', 'success')
}

const editCategory = (category: any) => {
  editingCategory.value = true
  categoryForm.value = { ...category }
  showCategoryModal.value = true
}

const deleteCategory = (categoryId: string) => {
  if (confirm('Are you sure you want to delete this category?')) {
    ticketsStore.deleteCategory(categoryId)
    toastStore.addToast('Category deleted successfully!', 'success')
  }
}

const saveCategory = () => {
  if (editingCategory.value) {
    ticketsStore.updateCategory(categoryForm.value.id, categoryForm.value)
    toastStore.addToast('Category updated successfully!', 'success')
  } else {
    ticketsStore.addCategory(categoryForm.value)
    toastStore.addToast('Category created successfully!', 'success')
  }
  
  showCategoryModal.value = false
  editingCategory.value = false
  
  // Reset form
  categoryForm.value = {
    id: '',
    name: '',
    description: '',
    emoji: '🎫',
    staffRoles: ['Support Staff'],
    channelPrefix: 'ticket',
    autoClose: false,
    autoCloseTime: 24
  }
}

const editPanel = (panel: any) => {
  console.log('Edit panel:', panel)
  toastStore.addToast('Edit panel functionality would open here', 'info')
}

const deletePanel = (panelId: string) => {
  if (confirm('Are you sure you want to delete this panel?')) {
    const index = ticketPanels.value.findIndex(p => p.id === panelId)
    if (index !== -1) {
      ticketPanels.value.splice(index, 1)
      toastStore.addToast('Panel deleted successfully!', 'success')
    }
  }
}

const savePanel = () => {
  const selectedCats = categories.value.filter(c => panelForm.value.selectedCategories.includes(c.id))
  
  const newPanel = {
    id: Date.now().toString(),
    ...panelForm.value,
    categories: selectedCats
  }
  
  ticketPanels.value.push(newPanel)
  showPanelModal.value = false
  
  // Reset form
  panelForm.value = {
    title: '',
    description: '',
    channelName: '',
    embedTitle: '',
    embedDescription: '',
    selectedCategories: []
  }
  
  toastStore.addToast('Panel created successfully!', 'success')
}

const openTicketDetails = (ticket: any) => {
  console.log('Open ticket details:', ticket)
  toastStore.addToast('Ticket details would open here', 'info')
}

const exportTickets = () => {
  console.log('Export tickets')
  toastStore.addToast('Export functionality would be implemented here', 'info')
}

const saveSettings = () => {
  ticketsStore.updateSettings(settings.value)
  toastStore.addToast('Ticket settings saved successfully!', 'success')
}
</script>