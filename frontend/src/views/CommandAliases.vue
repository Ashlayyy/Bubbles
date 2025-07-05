
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-card-foreground">Reason Aliases</h1>
      <p class="text-muted-foreground mt-2">
        Manage quick reason aliases for moderation actions. Create shortcuts for common ban, kick, and mute reasons.
      </p>
    </div>

    <!-- Controls -->
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
        <!-- Search -->
        <div class="relative flex-1 max-w-md">
          <input
            v-model="aliasStore.searchQuery"
            type="text"
            placeholder="Search actions or aliases..."
            class="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
          />
          <svg
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <!-- Category Filter -->
        <select
          v-model="aliasStore.selectedCategory"
          class="px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary outline-none"
        >
          <option
            v-for="category in aliasStore.categories"
            :key="category.value"
            :value="category.value"
          >
            {{ category.label }} ({{ category.count }})
          </option>
        </select>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          @click="showImportExport = true"
          class="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Import/Export
        </button>
      </div>
    </div>

    <!-- Actions List -->
    <div class="grid gap-6">
      <div
        v-for="action in aliasStore.filteredActions"
        :key="action.id"
        class="bg-card border border-border rounded-xl p-6"
      >
        <!-- Action Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-primary/10 rounded-lg">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-card-foreground">{{ action.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ action.description }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="addAlias(action)"
              class="px-3 py-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Add Alias
            </button>
            <button
              @click="aliasStore.toggleAction(action.id)"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                action.enabled ? 'bg-primary' : 'bg-muted'
              ]"
            >
              <div :class="[
                'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                action.enabled ? 'translate-x-6' : 'translate-x-0.5'
              ]"></div>
            </button>
          </div>
        </div>

        <!-- Aliases -->
        <div v-if="action.reasonAliases.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium text-muted-foreground">Reason Aliases ({{ action.reasonAliases.length }})</h4>
          <div class="grid gap-2">
            <div
              v-for="alias in action.reasonAliases"
              :key="alias.id"
              class="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <code class="px-2 py-1 bg-background rounded text-sm font-mono">{{ alias.name }}</code>
                  <span class="text-xs text-muted-foreground">→</span>
                  <span class="text-sm text-card-foreground">{{ alias.reason }}</span>
                </div>
                <div class="flex items-center gap-4 mt-1">
                  <span class="text-xs text-muted-foreground">Used {{ alias.usageCount }} times</span>
                  <span :class="[
                    'text-xs px-2 py-0.5 rounded-full',
                    alias.category === 'moderation' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  ]">
                    {{ alias.category }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="editAlias(action, alias)"
                  class="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  @click="aliasStore.toggleReasonAlias(action.id, alias.id)"
                  :class="[
                    'w-8 h-4 rounded-full transition-colors relative',
                    alias.enabled ? 'bg-primary' : 'bg-muted'
                  ]"
                >
                  <div :class="[
                    'w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform',
                    alias.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  ]"></div>
                </button>
                <button
                  @click="removeAlias(action.id, alias.id)"
                  class="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- No Aliases -->
        <div v-else class="text-center py-8 text-muted-foreground">
          <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p class="text-sm">No reason aliases configured</p>
          <p class="text-xs">Click "Add Alias" to create your first reason shortcut</p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="aliasStore.filteredActions.length === 0" class="text-center py-12">
      <svg class="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h3 class="text-lg font-medium text-card-foreground mb-2">No actions found</h3>
      <p class="text-muted-foreground">Try adjusting your search or filter criteria.</p>
    </div>

    <!-- Modals -->
    <AliasModal
      v-if="showAliasModal"
      :action="selectedAction"
      :reason-alias="selectedAlias"
      @close="showAliasModal = false"
      @save="saveAlias"
    />

    <ImportExportModal
      v-if="showImportExport"
      @close="showImportExport = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAliasesStore, type ModerationAction, type ReasonAlias } from '@/stores/aliases'
import { useToastStore } from '@/stores/toast'
import AliasModal from '@/components/aliases/AliasModal.vue'
import ImportExportModal from '@/components/aliases/ImportExportModal.vue'

const aliasStore = useAliasesStore()
const toastStore = useToastStore()

const showAliasModal = ref(false)
const showImportExport = ref(false)
const selectedAction = ref<ModerationAction | null>(null)
const selectedAlias = ref<ReasonAlias | null>(null)

function addAlias(action: ModerationAction) {
  selectedAction.value = action
  selectedAlias.value = null
  showAliasModal.value = true
}

function editAlias(action: ModerationAction, alias: ReasonAlias) {
  selectedAction.value = action
  selectedAlias.value = alias
  showAliasModal.value = true
}

function saveAlias(data: { name: string; reason: string }) {
  if (!selectedAction.value) return

  try {
    if (selectedAlias.value) {
      // Update existing alias
      aliasStore.updateReasonAlias(selectedAction.value.id, selectedAlias.value.id, {
        name: data.name,
        reason: data.reason
      })
      toastStore.addToast('Reason alias updated successfully', 'success')
    } else {
      // Add new alias
      aliasStore.addReasonAlias(selectedAction.value.id, data.name, data.reason)
      toastStore.addToast('Reason alias added successfully', 'success')
    }
    
    showAliasModal.value = false
  } catch (error) {
    toastStore.addToast(error instanceof Error ? error.message : 'Failed to save alias', 'error')
  }
}

function removeAlias(actionId: string, aliasId: string) {
  aliasStore.removeReasonAlias(actionId, aliasId)
  toastStore.addToast('Reason alias removed', 'success')
}
</script>
