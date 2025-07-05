
<template>
  <div class="space-y-4">
    <!-- Search and Filter Header -->
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div class="flex-1 max-w-md">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="commandsStore.searchQuery"
            type="text"
            placeholder="Search commands..."
            class="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
          >
        </div>
      </div>
      
      <div class="flex gap-2">
        <select
          v-model="commandsStore.selectedStatus"
          class="bg-input border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="all">All Commands</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
        
        <button
          @click="$emit('create-command')"
          class="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="M12 5v14"/>
          </svg>
          New Command
        </button>
      </div>
    </div>

    <!-- Commands Grid -->
    <div v-if="commandsStore.filteredCommands.length === 0" class="text-center py-12">
      <div class="text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 opacity-50">
          <path d="M16 18a4 4 0 0 0-8 0"/>
          <circle cx="12" cy="11" r="1"/>
          <rect x="8" y="4" width="8" height="6" rx="1"/>
        </svg>
        <p class="text-lg font-medium mb-2">No commands found</p>
        <p class="text-sm">{{ commandsStore.searchQuery ? 'Try adjusting your search criteria' : 'Create your first custom command to get started' }}</p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div
        v-for="command in commandsStore.filteredCommands"
        :key="command.id"
        class="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-foreground">{{ command.name }}</h3>
              <div class="flex gap-1">
                <span
                  v-if="command.enabled"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                >
                  Enabled
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                >
                  Disabled
                </span>
                <span
                  v-if="command.embedEnabled"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                >
                  Embed
                </span>
              </div>
            </div>
            <p class="text-sm text-muted-foreground mb-2">{{ command.description }}</p>
            <div v-if="command.aliases.length > 0" class="flex items-center gap-1 mb-2">
              <span class="text-xs text-muted-foreground">Aliases:</span>
              <div class="flex gap-1 flex-wrap">
                <code
                  v-for="alias in command.aliases"
                  :key="alias"
                  class="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs"
                >
                  {{ alias }}
                </code>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-1 ml-2">
            <button
              @click="$emit('edit-command', command)"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Edit command"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            
            <button
              @click="commandsStore.toggleCommand(command.id)"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              :title="command.enabled ? 'Disable command' : 'Enable command'"
            >
              <svg v-if="command.enabled" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 14V2"/>
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 10v12"/>
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 0 3 3.88Z"/>
              </svg>
            </button>
            
            <button
              @click="$emit('delete-command', command)"
              class="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete command"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" x2="10" y1="11" y2="17"/>
                <line x1="14" x2="14" y1="11" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="text-sm text-muted-foreground space-y-1">
          <div class="flex items-center justify-between">
            <span>Usage: {{ command.usageCount }} times</span>
            <span v-if="command.cooldown > 0">{{ command.cooldown }}s cooldown</span>
          </div>
          <div class="truncate">
            <strong>Content:</strong> {{ command.content.length > 60 ? command.content.substring(0, 60) + '...' : command.content }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCommandsStore, type CustomCommand } from '@/stores/commands'

interface Emits {
  (e: 'create-command'): void
  (e: 'edit-command', command: CustomCommand): void
  (e: 'delete-command', command: CustomCommand): void
}

defineEmits<Emits>()

const commandsStore = useCommandsStore()
</script>
