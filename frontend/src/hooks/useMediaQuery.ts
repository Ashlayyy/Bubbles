import { ref, onMounted, onUnmounted } from 'vue'

export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mediaQuery: MediaQueryList
  
  const updateMatches = (e: MediaQueryListEvent) => {
    matches.value = e.matches
  }
  
  onMounted(() => {
    mediaQuery = window.matchMedia(query)
    matches.value = mediaQuery.matches
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatches)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(updateMatches)
    }
  })
  
  onUnmounted(() => {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', updateMatches)
    } else {
      // Fallback for older browsers
      mediaQuery.removeListener(updateMatches)
    }
  })
  
  return matches
}