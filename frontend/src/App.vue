<template>
  <div class="app">
    <AppHeader @open-chat="chatOpen = true" />
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </main>
    <PwaInstallBanner />
    <ToastContainer />
    <GlobalModals />

    <!-- Chat FAB — only when authenticated -->
    <button
      v-if="authStore.isAuthenticated"
      class="chat-fab"
      :class="{ 'chat-fab--open': chatOpen }"
      @click="chatOpen = !chatOpen"
      title="Feedback & Support"
    >
      <Icon v-if="chatOpen" name="x" size="md" />
      <Icon v-else name="message-circle" size="md" />
    </button>

    <!-- Chat Slide-in Panel -->
    <ChatPanel :visible="chatOpen" @close="chatOpen = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import AppHeader from '@/components/common/AppHeader.vue'
import PwaInstallBanner from '@/components/common/PwaInstallBanner.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import GlobalModals from '@/components/shared/GlobalModals.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import Icon from '@/components/common/Icon.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const chatOpen = ref(false)

onMounted(() => {
  authStore.initAuth()
})

// Close chat on logout
watch(() => authStore.isAuthenticated, (isAuth) => {
  if (!isAuth) chatOpen.value = false
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Chat FAB */
.chat-fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 800;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-lg), var(--shadow-glow);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-fab:hover {
  transform: scale(1.08);
  box-shadow: var(--shadow-xl), 0 0 28px rgba(157, 78, 221, 0.45);
}

.chat-fab:active {
  transform: scale(0.95);
}

.chat-fab--open {
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  box-shadow: var(--shadow-md);
}

.chat-fab--open:hover {
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
}

@media (max-width: 480px) {
  .main-content {
    padding: 1rem;
  }

  .chat-fab {
    bottom: 1rem;
    right: 1rem;
    width: 3rem;
    height: 3rem;
  }
}
</style>
