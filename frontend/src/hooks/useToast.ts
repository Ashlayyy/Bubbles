import { useToastStore } from '@/stores/toast'

export function useToast() {
  const toastStore = useToastStore()
  
  const toast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    toastStore.addToast(message, type)
  }
  
  const success = (message: string) => {
    toast(message, 'success')
  }
  
  const error = (message: string) => {
    toast(message, 'error')
  }
  
  const info = (message: string) => {
    toast(message, 'info')
  }
  
  return {
    toast,
    success,
    error,
    info
  }
}