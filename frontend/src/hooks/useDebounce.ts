import { ref, watch } from 'vue'

export function useDebounce<T>(value: T, delay: number = 300) {
  const debouncedValue = ref<T>(value)
  let timeout: ReturnType<typeof setTimeout>
  
  watch(
    () => value,
    (newValue) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        debouncedValue.value = newValue
      }, delay)
    },
    { immediate: true }
  )
  
  return debouncedValue
}