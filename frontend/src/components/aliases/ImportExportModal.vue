
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-card border border-border rounded-xl p-6 w-full max-w-2xl mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-card-foreground">Import/Export Reason Aliases</h3>
        <button @click="$emit('close')" class="text-muted-foreground hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        <!-- Export Section -->
        <div>
          <h4 class="text-md font-medium text-card-foreground mb-3">Export Configuration</h4>
          <div class="space-y-3">
            <p class="text-sm text-muted-foreground">
              Export your current reason alias configuration to backup or share with other servers.
            </p>
            <button
              @click="exportConfig"
              class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Download Configuration
            </button>
          </div>
        </div>

        <!-- Import Section -->
        <div>
          <h4 class="text-md font-medium text-card-foreground mb-3">Import Configuration</h4>
          <div class="space-y-3">
            <p class="text-sm text-muted-foreground">
              Import reason alias configuration from a previously exported file. This will overwrite your current settings.
            </p>
            <div>
              <textarea
                v-model="importData"
                placeholder="Paste your configuration JSON here..."
                class="w-full h-32 px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none font-mono text-sm"
              />
              <div v-if="importError" class="text-sm text-destructive mt-1">
                {{ importError }}
              </div>
            </div>
            <button
              @click="importConfig"
              :disabled="!importData.trim()"
              class="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import Configuration
            </button>
          </div>
        </div>

        <!-- File Upload -->
        <div>
          <h4 class="text-md font-medium text-card-foreground mb-3">Upload File</h4>
          <div class="space-y-3">
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileUpload"
              class="hidden"
            />
            <button
              @click="$refs.fileInput?.click()"
              class="w-full px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Choose Configuration File
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end mt-6">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAliasesStore } from '@/stores/aliases'
import { useToastStore } from '@/stores/toast'

defineEmits<{
  (e: 'close'): void
}>()

const aliasStore = useAliasesStore()
const toastStore = useToastStore()

const importData = ref('')
const importError = ref('')

function exportConfig() {
  try {
    const config = aliasStore.exportReasonAliases()
    const blob = new Blob([config], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `reason-aliases-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toastStore.addToast('Configuration exported successfully', 'success')
  } catch (error) {
    toastStore.addToast('Failed to export configuration', 'error')
  }
}

function importConfig() {
  try {
    importError.value = ''
    aliasStore.importReasonAliases(importData.value)
    toastStore.addToast('Configuration imported successfully', 'success')
    importData.value = ''
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Invalid configuration format'
  }
}

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    importData.value = e.target?.result as string
  }
  reader.readAsText(file)
}
</script>
