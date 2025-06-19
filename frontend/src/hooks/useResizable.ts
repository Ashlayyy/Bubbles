import { ref, onMounted, onUnmounted } from 'vue'

interface ResizableOptions {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number
  onResizeStart?: (size: { width: number, height: number }) => void
  onResize?: (size: { width: number, height: number }) => void
  onResizeEnd?: (size: { width: number, height: number }) => void
}

export function useResizable(targetRef: Ref<HTMLElement | null>, options: ResizableOptions = {}) {
  const width = ref(0)
  const height = ref(0)
  const isResizing = ref(false)
  
  const {
    minWidth = 100,
    minHeight = 100,
    maxWidth = Infinity,
    maxHeight = Infinity,
    aspectRatio
  } = options
  
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0
  
  const handleResizeStart = (e: MouseEvent) => {
    if (!targetRef.value) return
    
    e.preventDefault()
    isResizing.value = true
    
    startX = e.clientX
    startY = e.clientY
    startWidth = targetRef.value.offsetWidth
    startHeight = targetRef.value.offsetHeight
    
    width.value = startWidth
    height.value = startHeight
    
    if (options.onResizeStart) {
      options.onResizeStart({ width: width.value, height: height.value })
    }
    
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', handleResizeEnd)
  }
  
  const handleResize = (e: MouseEvent) => {
    if (!isResizing.value) return
    
    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY
    
    let newWidth = startWidth + deltaX
    let newHeight = startHeight + deltaY
    
    // Apply constraints
    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight))
    
    // Maintain aspect ratio if specified
    if (aspectRatio) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newHeight = newWidth / aspectRatio
      } else {
        newWidth = newHeight * aspectRatio
      }
    }
    
    width.value = newWidth
    height.value = newHeight
    
    if (targetRef.value) {
      targetRef.value.style.width = `${newWidth}px`
      targetRef.value.style.height = `${newHeight}px`
    }
    
    if (options.onResize) {
      options.onResize({ width: width.value, height: height.value })
    }
  }
  
  const handleResizeEnd = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', handleResizeEnd)
    
    if (options.onResizeEnd) {
      options.onResizeEnd({ width: width.value, height: height.value })
    }
  }
  
  onMounted(() => {
    if (targetRef.value) {
      // Create and append resize handle
      const resizeHandle = document.createElement('div')
      resizeHandle.style.position = 'absolute'
      resizeHandle.style.width = '10px'
      resizeHandle.style.height = '10px'
      resizeHandle.style.right = '0'
      resizeHandle.style.bottom = '0'
      resizeHandle.style.cursor = 'nwse-resize'
      
      // Make sure target has position relative or absolute
      const computedStyle = window.getComputedStyle(targetRef.value)
      if (computedStyle.position === 'static') {
        targetRef.value.style.position = 'relative'
      }
      
      targetRef.value.appendChild(resizeHandle)
      resizeHandle.addEventListener('mousedown', handleResizeStart)
      
      // Initialize size
      width.value = targetRef.value.offsetWidth
      height.value = targetRef.value.offsetHeight
    }
  })
  
  onUnmounted(() => {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', handleResizeEnd)
  })
  
  return {
    width,
    height,
    isResizing
  }
}