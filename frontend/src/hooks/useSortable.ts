import { ref, computed } from 'vue'

type SortDirection = 'asc' | 'desc'

interface SortOptions<T> {
  initialSortBy?: keyof T
  initialDirection?: SortDirection
}

export function useSortable<T>(items: T[] | (() => T[]), options: SortOptions<T> = {}) {
  const sortBy = ref<keyof T | null>(options.initialSortBy || null)
  const sortDirection = ref<SortDirection>(options.initialDirection || 'asc')
  
  const getItems = typeof items === 'function' ? items : () => items
  
  const sortedItems = computed(() => {
    const itemsToSort = [...getItems()]
    
    if (!sortBy.value) return itemsToSort
    
    return itemsToSort.sort((a, b) => {
      const aValue = a[sortBy.value as keyof T]
      const bValue = b[sortBy.value as keyof T]
      
      // Handle different types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection.value === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection.value === 'asc'
          ? aValue - bValue
          : bValue - aValue
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection.value === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }
      
      // Default comparison
      if (aValue < bValue) return sortDirection.value === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection.value === 'asc' ? 1 : -1
      return 0
    })
  })
  
  const toggleSort = (field: keyof T) => {
    if (sortBy.value === field) {
      // Toggle direction if already sorting by this field
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      // Set new sort field and reset direction to asc
      sortBy.value = field
      sortDirection.value = 'asc'
    }
  }
  
  return {
    sortBy,
    sortDirection,
    sortedItems,
    toggleSort
  }
}