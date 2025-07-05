
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>('dark')

  function setInitialTheme() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        theme.value = savedTheme
        applyTheme(savedTheme)
      } else {
        theme.value = 'dark'
        applyTheme('dark')
      }
    }
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme(theme.value)
  }

  function applyTheme(newTheme: 'light' | 'dark') {
    if (typeof window === 'undefined') return
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', newTheme)
  }

  watch(theme, applyTheme)

  setInitialTheme()

  return { theme, toggleTheme }
})
