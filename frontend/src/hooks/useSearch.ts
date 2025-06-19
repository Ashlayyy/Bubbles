import { ref, computed } from 'vue'
import { useDebounce } from './useDebounce'

interface SearchOptions<T> {
  searchFields: (keyof T)[]
  initialQuery?: string
  debounceTime?: number
  caseSensitive?: boolean
  exactMatch?: boolean
}

export function useSearch<T>(items: T[] | (() => T[]), options: SearchOptions<T>) {
  const {
    searchFields,
    initialQuery = '',
    debounceTime = 300,
    caseSensitive = false,
    exactMatch = false
  } = options
  
  const searchQuery = ref(initialQuery)
  const debouncedSearchQuery = useDebounce(searchQuery, debounceTime)
  
  const getItems = typeof items === 'function' ? items : () => items
  
  const searchResults = computed(() => {
    const query = debouncedSearchQuery.value
    if (!query) return getItems()
    
    const normalizedQuery = caseSensitive ? query : query.toLowerCase()
    
    return getItems().filter(item => {
      return searchFields.some(field => {
        const value = String(item[field])
        const normalizedValue = caseSensitive ? value : value.toLowerCase()
        
        if (exactMatch) {
          return normalizedValue === normalizedQuery
        } else {
          return normalizedValue.includes(normalizedQuery)
        }
      })
    })
  })
  
  return {
    searchQuery,
    searchResults
  }
}