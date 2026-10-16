import { ref, onMounted, onUnmounted } from 'vue'

interface InfiniteScrollOptions {
  threshold?: number
  loadMoreCallback: () => Promise<boolean>
  rootMargin?: string
}

export function useInfiniteScroll(
  targetRef: Ref<HTMLElement | null>,
  options: InfiniteScrollOptions
) {
  const isLoading = ref(false)
  const hasMore = ref(true)
  
  const { threshold = 0.5, loadMoreCallback, rootMargin = '0px' } = options
  
  let observer: IntersectionObserver | null = null
  
  const loadMore = async () => {
    if (isLoading.value || !hasMore.value) return
    
    isLoading.value = true
    try {
      const hasMoreData = await loadMoreCallback()
      hasMore.value = hasMoreData
    } catch (error) {
      console.error('Error loading more data:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  const handleIntersect = (entries: IntersectionObserverEntry[]) => {
    const entry = entries[0]
    if (entry.isIntersecting) {
      loadMore()
    }
  }
  
  onMounted(() => {
    if (!targetRef.value) return
    
    observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin,
      threshold
    })
    
    observer.observe(targetRef.value)
  })
  
  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
    }
  })
  
  return {
    isLoading,
    hasMore,
    loadMore
  }
}