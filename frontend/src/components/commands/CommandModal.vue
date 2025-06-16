
<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-card rounded-lg border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
      <div class="p-6 border-b border-border">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-foreground">
            {{ isEdit ? 'Edit Command' : 'Create New Command' }}
          </h2>
          <button
            @click="$emit('close')"
            class="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m18 6-12 12"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
        <!-- Basic Settings -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-foreground">Basic Settings</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Command Name *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g., welcome"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Aliases</label>
              <input
                v-model="aliasInput"
                type="text"
                class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g., hi, hello (comma-separated)"
              >
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Description *</label>
            <input
              v-model="form.description"
              type="text"
              required
              class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
              placeholder="Brief description of what this command does"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Content *</label>
            <textarea
              v-model="form.content"
              required
              rows="4"
              class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
              placeholder="The message content when the command is used. You can use variables like [[.USER]] and [[.SERVER.NAME]]"
            ></textarea>
          </div>
        </div>

        <!-- Embed Settings -->
        <div class="space-y-4">
          <div class="flex items-center space-x-2">
            <input
              v-model="form.embedEnabled"
              type="checkbox"
              id="embedEnabled"
              class="rounded border-border text-primary focus:ring-primary"
            >
            <label for="embedEnabled" class="text-sm font-medium text-foreground">Enable Rich Embed</label>
          </div>

          <div v-if="form.embedEnabled" class="space-y-4 pl-6 border-l-2 border-primary/20">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Embed Title</label>
                <input
                  v-model="form.embedTitle"
                  type="text"
                  class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Embed title"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Embed Color</label>
                <input
                  v-model="form.embedColor"
                  type="color"
                  class="w-full h-10 bg-input border border-border rounded-md focus:ring-2 focus:ring-primary outline-none"
                >
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Embed Description</label>
              <textarea
                v-model="form.embedDescription"
                rows="3"
                class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                placeholder="Embed description text"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Footer Text</label>
                <input
                  v-model="form.embedFooter"
                  type="text"
                  class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Footer text"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-foreground mb-2">Thumbnail URL</label>
                <input
                  v-model="form.embedThumbnail"
                  type="url"
                  class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                  placeholder="https://example.com/image.png"
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Permissions & Restrictions -->
        <div class="space-y-4">
          <h3 class="text-lg font-medium text-foreground">Permissions & Restrictions</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">Cooldown (seconds)</label>
              <input
                v-model.number="form.cooldown"
                type="number"
                min="0"
                class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
              >
            </div>
            
            <div class="flex items-center space-x-2 pt-6">
              <input
                v-model="form.deleteInvoke"
                type="checkbox"
                id="deleteInvoke"
                class="rounded border-border text-primary focus:ring-primary"
              >
              <label for="deleteInvoke" class="text-sm font-medium text-foreground">Delete invoking message</label>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-6 border-t border-border">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {{ isEdit ? 'Update Command' : 'Create Command' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCommandsStore, type CustomCommand } from '@/stores/commands'
import { useToastStore } from '@/stores/toast'

interface Props {
  isOpen: boolean
  command?: CustomCommand | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const commandsStore = useCommandsStore()
const toastStore = useToastStore()

const isEdit = computed(() => !!props.command)

const form = ref({
  name: '',
  description: '',
  content: '',
  aliases: [] as string[],
  enabled: true,
  embedEnabled: false,
  embedTitle: '',
  embedColor: '#5865F2',
  embedDescription: '',
  embedFooter: '',
  embedThumbnail: '',
  embedImage: '',
  permissions: ['@everyone'],
  channels: [] as string[],
  roles: [] as string[],
  cooldown: 0,
  deleteInvoke: false
})

const aliasInput = ref('')

// Watch for alias input changes
watch(aliasInput, (newValue) => {
  form.value.aliases = newValue.split(',').map(alias => alias.trim()).filter(alias => alias.length > 0)
})

// Watch for command prop changes
watch(() => props.command, (newCommand) => {
  if (newCommand) {
    form.value = {
      name: newCommand.name,
      description: newCommand.description,
      content: newCommand.content,
      aliases: [...newCommand.aliases],
      enabled: newCommand.enabled,
      embedEnabled: newCommand.embedEnabled,
      embedTitle: newCommand.embedTitle || '',
      embedColor: newCommand.embedColor || '#5865F2',
      embedDescription: newCommand.embedDescription || '',
      embedFooter: newCommand.embedFooter || '',
      embedThumbnail: newCommand.embedThumbnail || '',
      embedImage: newCommand.embedImage || '',
      permissions: [...newCommand.permissions],
      channels: [...newCommand.channels],
      roles: [...newCommand.roles],
      cooldown: newCommand.cooldown,
      deleteInvoke: newCommand.deleteInvoke
    }
    aliasInput.value = newCommand.aliases.join(', ')
  } else {
    // Reset form for new command
    form.value = {
      name: '',
      description: '',
      content: '',
      aliases: [],
      enabled: true,
      embedEnabled: false,
      embedTitle: '',
      embedColor: '#5865F2',
      embedDescription: '',
      embedFooter: '',
      embedThumbnail: '',
      embedImage: '',
      permissions: ['@everyone'],
      channels: [],
      roles: [],
      cooldown: 0,
      deleteInvoke: false
    }
    aliasInput.value = ''
  }
}, { immediate: true })

const handleSubmit = () => {
  if (isEdit.value && props.command) {
    commandsStore.updateCommand(props.command.id, form.value)
    toastStore.addToast({
      message: `Command "${form.value.name}" updated successfully!`,
      type: 'success'
    })
  } else {
    commandsStore.addCommand(form.value)
    toastStore.addToast({
      message: `Command "${form.value.name}" created successfully!`,
      type: 'success'
    })
  }
  emit('close')
}
</script>
