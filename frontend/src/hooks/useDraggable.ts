import { ref, onMounted, onUnmounted } from 'vue'

interface Position {
  x: number
  y: number
}

interface DraggableOptions {
  initialPosition?: Position
  bounds?: 'parent' | 'window' | HTMLElement
  onDragStart?: (position: Position) => void
  onDragEnd?: (position: Position) => void
  onDrag?: (position: Position) => void
}

export function useDraggable(targetRef: Ref<HTMLElement | null>, options: DraggableOptions = {}) {
  const position = ref<Position>(options.initialPosition || { x: 0, y: 0 })
  const isDragging = ref(false)
  
  let startPosition = { x: 0, y: 0 }
  let elementRect = { top: 0, left: 0, width: 0, height: 0 }
  let parentRect = { top: 0, left: 0, width: 0, height: 0 }
  
  const handleMouseDown = (e: MouseEvent) => {
    if (!targetRef.value) return
    
    isDragging.value = true
    startPosition = {
      x: e.clientX - position.value.x,
      y: e.clientY - position.value.y
    }
    
    elementRect = targetRef.value.getBoundingClientRect()
    
    if (options.bounds === 'parent' && targetRef.value.parentElement) {
      parentRect = targetRef.value.parentElement.getBoundingClientRect()
    } else if (options.bounds === 'window') {
      parentRect = {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight
      }
    } else if (options.bounds instanceof HTMLElement) {
      parentRect = options.bounds.getBoundingClientRect()
    }
    
    if (options.onDragStart) {
      options.onDragStart(position.value)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return
    
    let newX = e.clientX - startPosition.x
    let newY = e.clientY - startPosition.y
    
    // Apply bounds if specified
    if (options.bounds) {
      const minX = parentRect.left
      const maxX = parentRect.width - elementRect.width
      const minY = parentRect.top
      const maxY = parentRect.height - elementRect.height
      
      newX = Math.max(minX, Math.min(newX, maxX))
      newY = Math.max(minY, Math.min(newY, maxY))
    }
    
    position.value = { x: newX, y: newY }
    
    if (options.onDrag) {
      options.onDrag(position.value)
    }
  }
  
  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    
    if (options.onDragEnd) {
      options.onDragEnd(position.value)
    }
  }
  
  onMounted(() => {
    if (targetRef.value) {
      targetRef.value.addEventListener('mousedown', handleMouseDown)
    }
  })
  
  onUnmounted(() => {
    if (targetRef.value) {
      targetRef.value.removeEventListener('mousedown', handleMouseDown)
    }
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  })
  
  return {
    position,
    isDragging
  }
}