
<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-card-foreground">{{ label }}</label>
      <button 
        @click="addMessage" 
        class="text-primary hover:text-primary/80 text-sm font-medium"
      >
        + Add Message
      </button>
    </div>
    
    <div class="space-y-2">
      <div 
        v-for="(message, index) in messages" 
        :key="index"
        class="flex gap-2"
      >
        <textarea 
          v-model="messages[index]" 
          @input="updateMessages"
          class="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground resize-none" 
          rows="2" 
          :placeholder="placeholder"
        ></textarea>
        <button 
          v-if="messages.length > 1"
          @click="removeMessage(index)"
          class="text-destructive hover:text-destructive/80 p-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
    
    <p class="text-xs text-muted-foreground">{{ helperText }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
  label: string
  placeholder: string
  helperText: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const messages = ref([...props.modelValue])

const updateMessages = () => {
  emit('update:modelValue', [...messages.value])
}

const addMessage = () => {
  messages.value.push('')
  updateMessages()
}

const removeMessage = (index: number) => {
  messages.value.splice(index, 1)
  updateMessages()
}

watch(() => props.modelValue, (newValue) => {
  messages.value = [...newValue]
}, { deep: true })
</script>
