import { onMounted, onUnmounted } from 'vue'

type KeyboardShortcut = {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  handler: () => void
}

export function useKeyboardShortcut(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey
      const altMatch = shortcut.altKey === undefined || event.altKey === shortcut.altKey
      const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey
      const metaMatch = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey
      
      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
        event.preventDefault()
        shortcut.handler()
        return
      }
    }
  }
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}