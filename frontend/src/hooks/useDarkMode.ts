import { ref, watch, onMounted } from 'vue'
import { useLocalStorage } from './useLocalStorage'

export function useDarkMode() {
  const [storedTheme, setStoredTheme] = useLocalStorage<'light' | 'dark' | 'system'>('theme', 'system')
  const theme = ref(storedTheme.value)
  const isDarkMode = ref(false)
  
  const updateTheme = (newTheme: 'light' | 'dark' | 'system') => {
    theme.value = newTheme
    setStoredTheme(newTheme)
    
    if (newTheme === 'system') {
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      isDarkMode.value = newTheme === 'dark'
    }
    
    applyTheme()
  }
  
  const applyTheme = () => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // Watch for system preference changes
  onMounted(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme.value === 'system') {
        isDarkMode.value = mediaQuery.matches
        applyTheme()
      }
    }
    
    // Set initial value
    if (theme.value === 'system') {
      isDarkMode.value = mediaQuery.matches
      applyTheme()
    } else {
      isDarkMode.value = theme.value === 'dark'
      applyTheme()
    }
    
    // Add listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange)
    }
    
    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange)
      }
    }
  })
  
  // Watch for theme changes
  watch(theme, (newTheme) => {
    if (newTheme === 'system') {
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      isDarkMode.value = newTheme === 'dark'
    }
    
    applyTheme()
  })
  
  return {
    theme,
    isDarkMode,
    updateTheme
  }
}