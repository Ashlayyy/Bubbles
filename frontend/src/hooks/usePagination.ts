import { ref, computed } from 'vue'

interface PaginationOptions {
  initialPage?: number
  initialPageSize?: number
}

export function usePagination<T>(items: T[] | (() => T[]), options: PaginationOptions = {}) {
  const currentPage = ref(options.initialPage || 1)
  const pageSize = ref(options.initialPageSize || 10)
  
  const getItems = typeof items === 'function' ? items : () => items
  
  const paginatedItems = computed(() => {
    const allItems = getItems()
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return allItems.slice(start, end)
  })
  
  const totalPages = computed(() => {
    const allItems = getItems()
    return Math.ceil(allItems.length / pageSize.value)
  })
  
  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
    }
  }
  
  const prevPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--
    }
  }
  
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }
  
  const setPageSize = (size: number) => {
    pageSize.value = size
    // Reset to first page when changing page size
    currentPage.value = 1
  }
  
  return {
    currentPage,
    pageSize,
    paginatedItems,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    setPageSize
  }
}