<template>
  <div class="messages-page animate-fadeIn">
    <header class="page-header">
      <div class="page-header-row">
        <div>
          <h1>Messages</h1>
          <p class="subtitle">Private encrypted conversations</p>
        </div>
        <button
          class="btn-icon"
          :disabled="messagesStore.isLoading"
          @click="messagesStore.fetchInbox()"
          title="Refresh inbox"
        >
          <Icon name="refresh" size="sm" :spin="messagesStore.isLoading" />
        </button>
      </div>
    </header>

    <div class="dm-layout">
      <!-- Sidebar: conversation list -->
      <aside class="dm-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Conversations</span>
          <button class="btn-icon-sm" @click="showNewDm = true" title="New message">
            <Icon name="edit" size="sm" />
          </button>
        </div>

        <!-- New DM input -->
        <div v-if="showNewDm" class="new-dm-bar">
          <input
            ref="newDmInput"
            v-model="newDmPubkey"
            class="new-dm-input"
            placeholder="npub or hex pubkey..."
            @keydown.enter="handleStartConversation"
            @keydown.escape="showNewDm = false"
          />
          <button
            class="btn-icon-sm"
            :disabled="!newDmPubkey.trim()"
            @click="handleStartConversation"
            title="Start conversation"
          >
            <Icon name="arrow-right" size="sm" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="messagesStore.isLoading && messagesStore.conversationList.length === 0" class="sidebar-status">
          <Icon name="loader-2" size="md" :spin="true" />
          <span>Loading conversations...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="messagesStore.conversationList.length === 0" class="sidebar-status">
          <Icon name="inbox" size="md" />
          <span>No conversations yet</span>
          <button class="btn-link" @click="showNewDm = true">Start one</button>
        </div>

        <!-- Conversation list -->
        <div v-else class="conversation-list">
          <button
            v-for="conv in messagesStore.conversationList"
            :key="conv.pubkey"
            :class="['conv-item', { active: messagesStore.selectedPubkey === conv.pubkey }]"
            @click="messagesStore.selectConversation(conv.pubkey)"
          >
            <img
              v-if="conv.profile?.picture"
              :src="conv.profile.picture"
              alt=""
              class="conv-avatar"
            />
            <div v-else class="conv-avatar conv-avatar--placeholder">
              <Icon name="user" size="xs" />
            </div>
            <div class="conv-info">
              <span class="conv-name">{{ conv.profile?.name || shortKey(conv.pubkey) }}</span>
              <span class="conv-preview">{{ truncate(conv.lastMessage, 32) }}</span>
            </div>
            <div class="conv-meta">
              <span class="conv-time">{{ relativeTime(conv.lastTime) }}</span>
            </div>
          </button>
        </div>
      </aside>

      <!-- Main: message thread -->
      <main class="dm-main">
        <template v-if="messagesStore.selectedPubkey">
          <!-- Partner header -->
          <div class="thread-header">
            <!-- Back button (mobile) -->
            <button class="btn-back" @click="messagesStore.selectConversation(null)">
              <Icon name="chevron-left" size="sm" />
            </button>
            <img
              v-if="messagesStore.selectedProfile?.picture"
              :src="messagesStore.selectedProfile.picture"
              alt=""
              class="thread-avatar"
            />
            <div v-else class="thread-avatar thread-avatar--placeholder">
              <Icon name="user" size="sm" />
            </div>
            <div class="thread-info">
              <span class="thread-name">{{ messagesStore.selectedProfile?.name || shortKey(messagesStore.selectedPubkey) }}</span>
              <span class="thread-pubkey">{{ messagesStore.selectedPubkey }}</span>
            </div>
            <button
              class="btn-icon"
              :disabled="messagesStore.isLoadingConversation"
              @click="messagesStore.fetchConversation(messagesStore.selectedPubkey)"
              title="Refresh"
            >
              <Icon name="refresh" size="sm" :spin="messagesStore.isLoadingConversation" />
            </button>
          </div>

          <!-- Messages -->
          <div class="thread-messages" ref="messagesRef">
            <div v-if="messagesStore.isLoadingConversation && messagesStore.selectedMessages.length === 0" class="thread-status">
              <Icon name="loader-2" size="lg" :spin="true" />
              <p>Decrypting messages...</p>
            </div>

            <div v-else-if="messagesStore.selectedMessages.length === 0" class="thread-status">
              <Icon name="message-circle" size="lg" />
              <p>Send the first message</p>
            </div>

            <template v-else>
              <MessageBubble
                v-for="msg in messagesStore.selectedMessages"
                :key="msg.id"
                :message="msg"
              />
            </template>
          </div>

          <!-- Input -->
          <MessageInput
            placeholder="Write a message..."
            :sending="messagesStore.isSending"
            @send="handleSend"
          />

          <!-- Encryption footer -->
          <div class="thread-footer">
            <Icon name="lock" size="xs" />
            <span>End-to-end encrypted</span>
          </div>
        </template>

        <!-- No conversation selected -->
        <div v-else class="thread-empty">
          <div class="thread-empty-icon">
            <Icon name="messages" size="xl" />
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the sidebar or start a new one.</p>
          <button class="btn-secondary" @click="showNewDm = true">
            <Icon name="edit" size="sm" />
            <span>New message</span>
          </button>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { nip19 } from 'nostr-core'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const messagesStore = useMessagesStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

const messagesRef = ref(null)
const showNewDm = ref(false)
const newDmPubkey = ref('')
const newDmInput = ref(null)

onMounted(() => {
  if (!messagesStore.hasFetched) {
    messagesStore.fetchInbox()
  }
})

// Auto-scroll on new messages
watch(() => messagesStore.selectedMessages.length, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
})

// Focus new DM input when shown
watch(showNewDm, (val) => {
  if (val) nextTick(() => newDmInput.value?.focus())
})

async function handleStartConversation() {
  let pubkey = newDmPubkey.value.trim()
  if (!pubkey) return

  // Normalize: npub → hex
  if (pubkey.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(pubkey)
      if (decoded.type === 'npub') pubkey = decoded.data
    } catch {
      uiStore.showError('Invalid npub format')
      return
    }
  }

  // Basic hex validation
  if (!/^[a-f0-9]{64}$/.test(pubkey)) {
    uiStore.showError('Invalid pubkey. Use a 64-character hex key or npub.')
    return
  }

  // Don't DM yourself
  if (pubkey === authStore.hex) {
    uiStore.showError("You can't message yourself")
    return
  }

  showNewDm.value = false
  newDmPubkey.value = ''
  await messagesStore.startConversation(pubkey)
}

async function handleSend(content) {
  if (!messagesStore.selectedPubkey) return
  const result = await messagesStore.sendDM(messagesStore.selectedPubkey, content)
  if (result?.success) {
    nextTick(() => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    })
  }
}

function shortKey(hex) {
  if (!hex) return ''
  return hex.slice(0, 8) + '...' + hex.slice(-4)
}

function truncate(text, len) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) + '...' : text
}

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}
</script>

<style scoped>
.messages-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}

.page-header { margin-bottom: var(--space-lg); }

.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.subtitle {
  color: var(--color-text-muted);
  margin: var(--space-xs) 0 0;
  font-size: 0.9375rem;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-icon:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-icon-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-icon-sm:hover:not(:disabled) { background: var(--color-surface-hover); color: var(--color-text); }

/* Layout */
.dm-layout {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  height: 72vh;
  min-height: 500px;
  background: var(--color-surface);
}

/* Sidebar */
.dm-sidebar {
  width: 300px;
  min-width: 260px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-surface-elevated);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

/* New DM bar */
.new-dm-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-primary-soft);
}

.new-dm-input {
  flex: 1;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
}

.new-dm-input:focus { outline: none; border-color: var(--color-primary); }
.new-dm-input::placeholder { color: var(--color-text-subtle); font-family: var(--font-sans); }

.sidebar-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.625rem;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-left: 3px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
  color: var(--color-text);
  font-family: inherit;
}

.conv-item:hover { background: var(--color-surface-hover); }
.conv-item.active { background: var(--color-primary-soft); border-left-color: var(--color-primary); }

.conv-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.conv-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  color: var(--color-text-subtle);
}

.conv-info { flex: 1; min-width: 0; }

.conv-name {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-preview {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.125rem;
}

.conv-meta { flex-shrink: 0; }

.conv-time {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

/* Main thread */
.dm-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.thread-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.btn-back {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.btn-back:hover { background: var(--color-surface-hover); }

.thread-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.thread-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  color: var(--color-text-subtle);
}

.thread-info { flex: 1; min-width: 0; }

.thread-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text); display: block; }

.thread-pubkey {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.thread-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.75rem;
  color: var(--color-text-muted);
}

.thread-status p { margin: 0; font-size: 0.875rem; }

.thread-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem;
  color: var(--color-text-subtle);
  font-size: 0.6875rem;
  border-top: 1px solid var(--color-border);
}

/* Empty state */
.thread-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: var(--space-xl);
}

.thread-empty-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.thread-empty h3 {
  margin: 0 0 var(--space-sm);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.thread-empty p {
  margin: 0 0 var(--space-lg);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.btn-secondary:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Mobile */
@media (max-width: 768px) {
  .messages-page { padding: var(--space-md) var(--space-sm); }

  .dm-layout {
    height: auto;
    min-height: unset;
    flex-direction: column;
  }

  /* When no conversation selected, show full sidebar */
  .dm-sidebar {
    width: 100%;
    min-width: unset;
    border-right: none;
  }

  /* When conversation selected, hide sidebar, show thread full-width */
  .dm-layout:has(.dm-main .thread-header) .dm-sidebar {
    display: none;
  }

  .dm-main {
    min-height: 500px;
  }

  .btn-back {
    display: flex;
  }

  .thread-header {
    gap: 0.5rem;
  }
}
</style>
