<template>
  <div class="live-chat-embed">
    <!-- Messages feed (scrollable) -->
    <div class="feed" ref="feedRef">
      <div v-if="store.isLoading" class="feed-status">
        <Icon name="loader-2" size="md" :spin="true" />
      </div>

      <div v-else-if="store.visibleMessages.length === 0" class="feed-status">
        <p>No messages yet. Be the first!</p>
      </div>

      <template v-else>
        <div
          v-for="msg in store.visibleMessages.slice(-30)"
          :key="msg.id"
          class="feed-msg"
        >
          <img
            v-if="store.getProfile(msg.pubkey)?.picture"
            :src="store.getProfile(msg.pubkey).picture"
            alt=""
            class="feed-avatar"
          />
          <div v-else class="feed-avatar feed-avatar--placeholder">
            <Icon name="user" size="xs" />
          </div>
          <div class="feed-body">
            <span class="feed-author">{{ store.getProfile(msg.pubkey)?.name || msg.pubkey.slice(0, 8) + '...' }}</span>
            <span class="feed-text">{{ cleanMessageContent(msg.content) }}</span>
          </div>
          <span class="feed-time">{{ relativeTime(msg.created_at) }}</span>
        </div>
      </template>
    </div>

    <!-- Input / Login prompt -->
    <div class="feed-input-area">
      <template v-if="authStore.isAuthenticated">
        <form class="feed-form" @submit.prevent="handleSend">
          <input
            v-model="text"
            class="feed-input"
            placeholder="Say something..."
            :disabled="store.isSending"
          />
          <button
            type="submit"
            class="feed-send"
            :disabled="!text.trim() || store.isSending"
          >
            <Icon v-if="store.isSending" name="loader-2" size="sm" :spin="true" />
            <Icon v-else name="send" size="sm" />
          </button>
        </form>
      </template>
      <template v-else>
        <button class="feed-login-prompt" @click="goToLogin">
          <Icon name="lock" size="sm" />
          <span>Sign in to join the conversation</span>
          <Icon name="chevron-right" size="sm" class="feed-login-arrow" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicChatStore } from '@/stores/publicChat'
import { useAuthStore } from '@/stores/auth'
import { cleanMessageContent } from '@/utils/chatFormat'
import Icon from '@/components/common/Icon.vue'

const router = useRouter()
const store = usePublicChatStore()
const authStore = useAuthStore()
const feedRef = ref(null)
const text = ref('')

onMounted(() => {
  if (store.channelReady && !store.isConnected) {
    store.joinChannel()
  }
})

onUnmounted(() => {
  store.leaveChannel()
})

// Auto-scroll on new messages
watch(() => store.visibleMessages.length, () => {
  nextTick(() => {
    if (feedRef.value) feedRef.value.scrollTop = feedRef.value.scrollHeight
  })
})

async function handleSend() {
  if (!text.value.trim()) return
  await store.sendMessage(text.value.trim())
  text.value = ''
}

function goToLogin() {
  router.push({ name: 'login', query: { redirect: '/' } })
}

function relativeTime(ts) {
  if (!ts) return ''
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60) return 'now'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}
</script>

<style scoped>
.live-chat-embed {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 360px;
}

/* Message feed */
.feed {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.feed-status {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.feed-msg {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.feed-msg:hover {
  background: var(--color-surface-hover);
}

.feed-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.feed-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  color: var(--color-text-subtle);
}

.feed-body {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.feed-author {
  font-weight: 600;
  color: var(--color-text);
  margin-right: 0.375rem;
}

.feed-text {
  color: var(--color-text-muted);
  word-break: break-word;
}

.feed-time {
  font-size: 0.625rem;
  color: var(--color-text-subtle);
  flex-shrink: 0;
  margin-top: 0.25rem;
}

/* Input area */
.feed-input-area {
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.feed-form {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
}

.feed-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: inherit;
}

.feed-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.feed-input::placeholder {
  color: var(--color-text-subtle);
}

.feed-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.feed-send:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.feed-send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Login prompt */
.feed-login-prompt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.feed-login-prompt:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.feed-login-arrow {
  margin-left: auto;
}
</style>
