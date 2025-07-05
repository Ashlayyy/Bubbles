
import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  const addToast = (message: string | { message: string; type: 'success' | 'error' | 'info' }, type: 'success' | 'error' | 'info' = 'info') => {
    let toastMessage: string
    let toastType: 'success' | 'error' | 'info'
    
    if (typeof message === 'string') {
      toastMessage = message
      toastType = type
    } else {
      toastMessage = message.message
      toastType = message.type
    }
    
    const id = Math.random().toString(36).substr(2, 9)
    const toast: Toast = { id, message: toastMessage, type: toastType }
    toasts.value.push(toast)
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    addToast,
    removeToast
  }
})
