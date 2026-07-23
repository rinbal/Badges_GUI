<template>
  <div class="group-chat">
    <div class="gc-heading">
      <h2>Community Chat</h2>
      <a
        :href="COMMUNITY_CHAT.link"
        target="_blank"
        rel="noopener noreferrer"
        class="gc-lotus"
        title="Open the full community in Lotus"
      >
        <Icon name="external-link" size="xs" />
        <span class="gc-lotus-label">Open in Lotus</span>
      </a>
    </div>

    <div class="gc-card">
      <!-- Group header -->
      <header class="gc-group-header">
        <img
          v-if="store.metadata.picture"
          :src="store.metadata.picture"
          alt=""
          class="gc-avatar"
        />
        <div v-else class="gc-avatar gc-avatar--ph">
          <Icon name="globe" size="sm" />
        </div>
        <div class="gc-group-heading">
          <span class="gc-name">{{ store.displayName }}</span>
          <span class="gc-sub">
            {{ store.memberCount ? `${store.memberCount} members` : 'Public community chat' }}
          </span>
        </div>
      </header>

      <!-- Messages -->
      <div class="gc-messages" ref="messagesRef">
        <div v-if="store.status === 'loading'" class="gc-status">
          <Icon name="loader" size="lg" :spin="true" />
          <p>Loading the conversation...</p>
        </div>

        <div v-else-if="store.status === 'error'" class="gc-status">
          <Icon name="alert-circle" size="lg" />
          <p>Could not reach the community relay.</p>
          <button class="gc-status-btn" @click="store.restart()">Try again</button>
        </div>

        <div v-else-if="store.restricted && !authStore.isAuthenticated" class="gc-status">
          <Icon name="lock" size="lg" />
          <p>Sign in to see the conversation.</p>
          <button class="gc-status-btn primary" @click="goLogin">Sign in</button>
        </div>

        <div v-else-if="store.messages.length === 0" class="gc-status">
          <Icon name="message-circle" size="lg" />
          <p>No messages yet. Be the first to say hi.</p>
        </div>

        <template v-else>
          <GroupMessage
            v-for="msg in store.messages"
            :key="msg.id"
            :message="msg"
            :profile="store.profileFor(msg.pubkey)"
          />
        </template>
      </div>

      <!-- Composer / join / sign-in -->
      <div class="gc-compose">
        <MessageInput
          v-if="canSend"
          placeholder="Message the community..."
          :sending="store.isSending"
          @send="handleSend"
        />
        <button
          v-else-if="authStore.isAuthenticated"
          class="gc-join-btn"
          :disabled="store.isJoining"
          @click="store.join()"
        >
          <Icon v-if="store.isJoining" name="loader" size="sm" :spin="true" />
          <Icon v-else name="users" size="sm" />
          {{ store.isJoining ? 'Joining...' : 'Join the group to chat' }}
        </button>
        <button v-else class="gc-join-btn" @click="goLogin">
          <Icon name="user" size="sm" />
          Sign in to join the conversation
        </button>
      </div>

      <LotusFooter />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGroupStore } from '@/stores/groups'
import { useAuthStore } from '@/stores/auth'
import { COMMUNITY_CHAT } from '@/config/community'
import GroupMessage from '@/components/chat/GroupMessage.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import LotusFooter from '@/components/chat/LotusFooter.vue'
import Icon from '@/components/common/Icon.vue'

const router = useRouter()
const store = useGroupStore()
const authStore = useAuthStore()
const messagesRef = ref(null)

const canSend = computed(() => authStore.isAuthenticated && store.isMember)

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

async function handleSend(content) {
  const result = await store.send(content)
  if (result?.success) scrollToBottom()
}

function goLogin() {
  router.push({ path: '/login', query: { redirect: '/' } })
}

watch(() => store.messages.length, scrollToBottom)
watch(() => authStore.isAuthenticated, () => store.restart())

onMounted(async () => {
  await store.start()
  scrollToBottom()
})

onUnmounted(() => store.stop())
</script>

<style scoped>
.group-chat {
  width: 100%;
}

.gc-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.gc-heading h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.gc-lotus {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.gc-lotus:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

/* Card */
.gc-card {
  display: flex;
  flex-direction: column;
  height: 480px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.gc-group-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.gc-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.gc-avatar--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.gc-group-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.gc-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gc-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Messages */
.gc-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.gc-status {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  color: var(--color-text-muted);
  padding: 1.5rem 1rem;
}

.gc-status p {
  margin: 0;
  font-size: 0.875rem;
}

.gc-status-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gc-status-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.gc-status-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.gc-status-btn.primary:hover {
  background: var(--color-primary-hover);
  color: #fff;
}

/* Composer */
.gc-compose {
  flex-shrink: 0;
}

.gc-join-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1rem;
  border: none;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.gc-join-btn:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.gc-join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .gc-heading h2 {
    font-size: 1.25rem;
  }

  .gc-lotus-label {
    display: none;
  }

  .gc-card {
    height: 440px;
  }
}
</style>
