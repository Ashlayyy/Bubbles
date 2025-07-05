import { ref } from 'vue'

interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'destructive' | 'primary'
}

export function useConfirmDialog() {
  const isOpen = ref(false)
  const options = ref<ConfirmDialogOptions>({
    title: 'Confirm Action',
    message: 'Are you sure you want to continue?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'primary'
  })
  
  let resolvePromise: (value: boolean) => void
  
  const confirm = (dialogOptions: ConfirmDialogOptions): Promise<boolean> => {
    options.value = { ...options.value, ...dialogOptions }
    isOpen.value = true
    
    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }
  
  const handleConfirm = () => {
    isOpen.value = false
    resolvePromise(true)
  }
  
  const handleCancel = () => {
    isOpen.value = false
    resolvePromise(false)
  }
  
  return {
    isOpen,
    options,
    confirm,
    handleConfirm,
    handleCancel
  }
}