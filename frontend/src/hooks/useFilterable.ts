import { ref, computed } from 'vue'

interface FilterOption<T> {
  field: keyof T
  value: any
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith'
}

export function useFilterable<T>(items: T[] | (() => T[])) {
  const filters = ref<FilterOption<T>[]>([])
  
  const getItems = typeof items === 'function' ? items : () => items
  
  const filteredItems = computed(() => {
    if (filters.value.length === 0) return getItems()
    
    return getItems().filter(item => {
      return filters.value.every(filter => {
        const value = item[filter.field]
        const filterValue = filter.value
        
        switch (filter.operator) {
          case 'eq':
            return value === filterValue
          case 'neq':
            return value !== filterValue
          case 'gt':
            return value > filterValue
          case 'gte':
            return value >= filterValue
          case 'lt':
            return value < filterValue
          case 'lte':
            return value <= filterValue
          case 'contains':
            return String(value).includes(String(filterValue))
          case 'startsWith':
            return String(value).startsWith(String(filterValue))
          case 'endsWith':
            return String(value).endsWith(String(filterValue))
          default:
            return value === filterValue
        }
      })
    })
  })
  
  const addFilter = (filter: FilterOption<T>) => {
    filters.value.push(filter)
  }
  
  const removeFilter = (index: number) => {
    filters.value.splice(index, 1)
  }
  
  const updateFilter = (index: number, filter: FilterOption<T>) => {
    filters.value[index] = filter
  }
  
  const clearFilters = () => {
    filters.value = []
  }
  
  return {
    filters,
    filteredItems,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters
  }
}