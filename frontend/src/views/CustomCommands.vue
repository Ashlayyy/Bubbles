
<template>
  <div class="p-8">
    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-3xl font-bold text-foreground mb-2">Custom Commands</h1>
        <p class="text-muted-foreground">Create and manage custom bot commands for your server</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="text-right">
          <div class="text-2xl font-bold text-foreground">{{ commandsStore.commands.length }}</div>
          <div class="text-sm text-muted-foreground">Total Commands</div>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-green-500">{{ enabledCount }}</div>
          <div class="text-sm text-muted-foreground">Enabled</div>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">
              <path d="M16 18a4 4 0 0 0-8 0"/>
              <circle cx="12" cy="11" r="1"/>
              <rect x="8" y="4" width="8" height="6" rx="1"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-foreground">{{ commandsStore.commands.length }}</p>
            <p class="text-sm text-muted-foreground">Total Commands</p>
          </div>
        </div>
      </div>

      <div class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500">
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c.552 0 1-.449 1-1V8a2 2 0 0 0-2-2h-4l-2-2H8a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-3c0-.551-.448-1-1-1"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-foreground">{{ enabledCount }}</p>
            <p class="text-sm text-muted-foreground">Enabled</p>
          </div>
        </div>
      </div>

      <div class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-500/10 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="m7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-foreground">{{ embedCount }}</p>
            <p class="text-sm text-muted-foreground">With Embeds</p>
          </div>
        </div>
      </div>

      <div class="bg-card border border-border rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-purple-500/10 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
              <path d="M13.73 21a2 2 0 0 1-3.46 0l-1.05-1.82A2 2 0 0 1 8.5 17.5H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-.72 1.68L13.73 21z"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-foreground">{{ totalUsage }}</p>
            <p class="text-sm text-muted-foreground">Total Uses</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Variables Info -->
    <div class="bg-card border border-border rounded-lg p-4 mb-6">
      <h3 class="font-semibold text-foreground mb-3">Available Variables</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div class="flex items-center gap-2">
          <code class="bg-muted text-muted-foreground px-2 py-1 rounded">[[.USER]]</code>
          <span class="text-muted-foreground">User mention</span>
        </div>
        <div class="flex items-center gap-2">
          <code class="bg-muted text-muted-foreground px-2 py-1 rounded">[[.USER.NAME]]</code>
          <span class="text-muted-foreground">Username only</span>
        </div>
        <div class="flex items-center gap-2">
          <code class="bg-muted text-muted-foreground px-2 py-1 rounded">[[.USER.ID]]</code>
          <span class="text-muted-foreground">User ID</span>
        </div>
        <div class="flex items-center gap-2">
          <code class="bg-muted text-muted-foreground px-2 py-1 rounded">[[.SERVER.NAME]]</code>
          <span class="text-muted-foreground">Server name</span>
        </div>
      </div>
    </div>

    <!-- Commands List -->
    <div class="bg-card border border-border rounded-lg p-6">
      <CommandList
        @create-command="openCreateModal"
        @edit-command="openEditModal"
        @delete-command="openDeleteModal"
      />
    </div>

    <!-- Command Modal -->
    <CommandModal
      :is-open="isModalOpen"
      :command="selectedCommand"
      @close="closeModal"
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="isDeleteModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-card rounded-lg border border-border p-6 max-w-md mx-4">
        <h3 class="text-lg font-semibold text-foreground mb-4">Delete Command</h3>
        <p class="text-muted-foreground mb-6">
          Are you sure you want to delete the command "{{ commandToDelete?.name }}"? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="closeDeleteModal"
            class="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            @click="confirmDelete"
            class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCommandsStore, type CustomCommand } from '@/stores/commands'
import { useToastStore } from '@/stores/toast'
import CommandList from '@/components/commands/CommandList.vue'
import CommandModal from '@/components/commands/CommandModal.vue'

const commandsStore = useCommandsStore()
const toastStore = useToastStore()

const isModalOpen = ref(false)
const selectedCommand = ref<CustomCommand | null>(null)
const isDeleteModalOpen = ref(false)
const commandToDelete = ref<CustomCommand | null>(null)

const enabledCount = computed(() => commandsStore.commands.filter(cmd => cmd.enabled).length)
const embedCount = computed(() => commandsStore.commands.filter(cmd => cmd.embedEnabled).length)
const totalUsage = computed(() => commandsStore.commands.reduce((total, cmd) => total + cmd.usageCount, 0))

const openCreateModal = () => {
  selectedCommand.value = null
  isModalOpen.value = true
}

const openEditModal = (command: CustomCommand) => {
  selectedCommand.value = command
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  selectedCommand.value = null
}

const openDeleteModal = (command: CustomCommand) => {
  commandToDelete.value = command
  isDeleteModalOpen.value = true
}

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
  commandToDelete.value = null
}

const confirmDelete = () => {
  if (commandToDelete.value) {
    commandsStore.deleteCommand(commandToDelete.value.id)
    toastStore.addToast({
      message: `Command "${commandToDelete.value.name}" deleted successfully!`,
      type: 'success'
    })
  }
  closeDeleteModal()
}
</script>
