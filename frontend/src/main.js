import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

// Register service worker after app mount
import { registerSW } from 'virtual:pwa-register'
import { useUIStore } from './stores/ui'

registerSW({
  onNeedRefresh() {
    const uiStore = useUIStore()
    uiStore.showInfo('Updating BadgeBox to the latest version...')
  },
  onOfflineReady() {
    const uiStore = useUIStore()
    uiStore.showSuccess('BadgeBox is ready for offline use')
  },
  onRegisterError(error) {
    console.error('Service worker registration failed:', error)
  }
})
