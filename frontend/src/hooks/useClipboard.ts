import { ref } from 'vue'

export function useClipboard() {
  const copied = ref(false)
  const copyError = ref<Error | null>(null)
  
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      copyError.value = null
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        copied.value = false
      }, 2000)
      
      return true
    } catch (error) {
      copied.value = false
      copyError.value = error as Error
      return false
    }
  }
  
  return {
    copied,
    copyError,
    copy
  }
}