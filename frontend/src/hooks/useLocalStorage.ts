import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Get from local storage then parse stored json or return initialValue
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  }
  
  // State to store our value
  const storedValue = ref<T>(readValue())
  
  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T) => {
    if (typeof window === 'undefined') {
      console.warn(`Tried setting localStorage key "${key}" even though environment is not a client`)
    }
    
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue.value) : value
      
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
      
      // Save state
      storedValue.value = valueToStore
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }
  
  // Watch for changes to the stored value and update localStorage
  watch(
    () => storedValue.value,
    (newValue) => {
      setValue(newValue)
    },
    { deep: true }
  )
  
  return [storedValue, setValue] as const
}