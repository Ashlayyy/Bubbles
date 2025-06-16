
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>('dark')

  function setInitialTheme() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        theme.value = savedTheme
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme.value = 'light'
      } else {
        theme.value = 'dark'
      }
    }
  }

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  watch(theme, (newTheme) => {
    if (typeof window !== 'undefined') {
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      localStorage.setItem('theme', newTheme)
    }
  })

  setInitialTheme()

  return { theme, toggleTheme }
})
