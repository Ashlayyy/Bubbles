import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './index.css'
import 'vue3-emoji-picker/css'
import router from './router'
import { useUIStore } from './stores/ui'

const pinia = createPinia()

const app = createApp(App)
app.use(pinia)
app.use(router)

// Initialize theme before mounting
const uiStore = useUIStore(pinia)

app.mount('#app')