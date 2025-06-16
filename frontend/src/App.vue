
<template>
  <div id="app" class="min-h-screen">
    <router-view />
    
    <!-- Toast Container -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <transition-group name="toast" tag="div">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'px-4 py-3 rounded-lg shadow-lg border max-w-sm',
            getToastClass(toast.type)
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ toast.message }}</span>
            <button @click="removeToast(toast.id)" class="ml-3 text-current opacity-70 hover:opacity-100">
              ×
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useToastStore } from './stores/toast'
import { useUIStore } from './stores/ui'

const toastStore = useToastStore()
const { toasts, removeToast } = toastStore
useUIStore()

const getToastClass = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-100 border-green-300 text-green-900 dark:bg-green-900 dark:border-green-700 dark:text-green-100'
    case 'error':
      return 'bg-red-100 border-red-300 text-red-900 dark:bg-red-900 dark:border-red-700 dark:text-red-100'
    default:
      return 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100'
  }
}

onMounted(() => {
  console.log('Bubbles Dashboard initialized')
})
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
