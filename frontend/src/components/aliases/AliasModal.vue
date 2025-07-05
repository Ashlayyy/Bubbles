
<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-card-foreground">
          {{ reasonAlias ? 'Edit Reason Alias' : 'Add Reason Alias' }}
        </h3>
        <button @click="$emit('close')" class="text-muted-foreground hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <!-- Action Info -->
        <div class="p-3 bg-muted/50 rounded-lg">
          <div class="text-sm text-muted-foreground">Moderation Action</div>
          <div class="font-medium text-card-foreground">{{ action?.name }}</div>
        </div>

        <!-- Alias Name -->
        <div>
          <label class="block text-sm font-medium text-card-foreground mb-2">
            Alias Name
          </label>
          <input
            v-model="aliasName"
            type="text"
            placeholder="e.g., spam, toxic, flood..."
            class="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none"
            @keydown.enter="save"
          />
          <div v-if="conflictError" class="text-sm text-destructive mt-1">
            {{ conflictError }}
          </div>
        </div>

        <!-- Reason Text -->
        <div>
          <label class="block text-sm font-medium text-card-foreground mb-2">
            Reason Text
          </label>
          <textarea
            v-model="reasonText"
            placeholder="Enter the full reason text that will be used..."
            rows="3"
            class="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
          />
        </div>

        <!-- Preview -->
        <div class="p-3 bg-muted/50 rounded-lg">
          <div class="text-sm text-muted-foreground mb-1">Preview</div>
          <div class="font-mono text-sm">
            /{{ action?.name }} @user {{ aliasName || 'alias' }}
          </div>
          <div class="text-xs text-muted-foreground mt-1">
            → "{{ reasonText || 'Reason text will appear here' }}"
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 mt-6">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          @click="save"
          :disabled="!aliasName.trim() || !reasonText.trim() || !!conflictError"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ reasonAlias ? 'Update' : 'Add' }} Alias
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAliasesStore, type ModerationAction, type ReasonAlias } from '@/stores/aliases'

const props = defineProps<{
  action: ModerationAction | null
  reasonAlias: ReasonAlias | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: { name: string; reason: string }): void
}>()

const aliasStore = useAliasesStore()

const aliasName = ref(props.reasonAlias?.name || '')
const reasonText = ref(props.reasonAlias?.reason || '')

const conflictError = computed(() => {
  if (!aliasName.value.trim() || !props.action) return null
  
  const hasConflict = aliasStore.hasReasonAliasConflict(aliasName.value, props.action.id)
  return hasConflict ? `Reason alias "${aliasName.value}" already exists for another action` : null
})

function save() {
  if (!aliasName.value.trim() || !reasonText.value.trim() || conflictError.value) return
  
  emit('save', {
    name: aliasName.value.trim(),
    reason: reasonText.value.trim()
  })
}
</script>
