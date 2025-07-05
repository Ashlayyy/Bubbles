import { ref } from 'vue'

export function useDisclosure(initialState = false) {
  const isOpen = ref(initialState)
  
  const onOpen = () => {
    isOpen.value = true
  }
  
  const onClose = () => {
    isOpen.value = false
  }
  
  const onToggle = () => {
    isOpen.value = !isOpen.value
  }
  
  return {
    isOpen,
    onOpen,
    onClose,
    onToggle
  }
}