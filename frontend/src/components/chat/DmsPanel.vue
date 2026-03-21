<template>
  <Transition name="dms-panel">
    <div v-if="visible" class="dms-overlay" @click.self="$emit('close')">
      <div class="dms-panel">
        <!-- Header -->
        <div class="panel-header">
          <div class="panel-title">
            <Icon name="mail" size="sm" />
            <span>Messages</span>
          </div>
          <div class="panel-actions">
            <button class="panel-btn" @click="showNewDm = !showNewDm" title="New message">
              <Icon name="edit" size="sm" />
            </button>
            <button class="panel-btn" :disabled="store.isLoading" @click="store.fetchInbox()" title="Refresh">
              <Icon name="refresh" size="sm" :spin="store.isLoading" />
            </button>
            <button class="panel-btn" @click="$emit('close')" title="Close">
              <Icon name="x" size="sm" />
            </button>
          </div>
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
          <button class="panel-btn" :disabled="!newDmPubkey.trim()" @click="handleStartConversation">
            <Icon name="arrow-right" size="sm" />
          </button>
        </div>

        <!-- Two-pane layout: conversation list vs thread -->
        <div class="panel-body">
          <!-- Conversation list (shown when no conversation selected) -->
          <div v-if="!store.selectedPubkey" class="conv-list-pane">
            <div v-if="store.isLoading && store.conversationList.length === 0" class="pane-status">
              <Icon name="loader-2" size="md" :spin="true" />
              <span>Loading...</span>
            </div>

            <div v-else-if="store.conversationList.length === 0" class="pane-status">
              <Icon name="inbox" size="lg" />
              <span>No conversations yet</span>
              <button class="btn-link" @click="showNewDm = true">Start one</button>
            </div>

            <div v-else class="conv-list">
              <button
                v-for="conv in store.conversationList"
                :key="conv.pubkey"
                class="conv-item"
                @click="store.selectConversation(conv.pubkey)"
              >
                <img v-if="conv.profile?.picture" :src="conv.profile.picture" alt="" class="conv-avatar" />
                <div v-else class="conv-avatar conv-avatar--placeholder"><Icon name="user" size="xs" /></div>
                <div class="conv-info">
                  <span class="conv-name">{{ conv.profile?.name || shortKey(conv.pubkey) }}</span>
                  <span class="conv-preview">{{ truncate(conv.lastMessage, 28) }}</span>
                </div>
                <span class="conv-time">{{ relativeTime(conv.lastTime) }}</span>
              </button>
            </div>
          </div>

          <!-- Thread view (shown when conversation selected) -->
          <div v-else class="thread-pane">
            <!-- Thread header -->
            <div class="thread-header">
              <button class="panel-btn" @click="store.selectConversation(null)" title="Back">
                <Icon name="chevron-left" size="sm" />
              </button>
              <img v-if="store.selectedProfile?.picture" :src="store.selectedProfile.picture" alt="" class="thread-avatar" />
              <div v-else class="thread-avatar thread-avatar--placeholder"><Icon name="user" size="xs" /></div>
              <span class="thread-name">{{ store.selectedProfile?.name || shortKey(store.selectedPubkey) }}</span>
            </div>

            <!-- Messages -->
            <div class="thread-messages" ref="messagesRef">
              <div v-if="store.isLoadingConversation && store.selectedMessages.length === 0" class="pane-status">
                <Icon name="loader-2" size="md" :spin="true" />
                <span>Decrypting...</span>
              </div>
              <div v-else-if="store.selectedMessages.length === 0" class="pane-status">
                <Icon name="message-circle" size="md" />
                <span>Send the first message</span>
              </div>
              <template v-else>
                <MessageBubble v-for="msg in store.selectedMessages" :key="msg.id" :message="msg" />
              </template>
            </div>

            <!-- Input -->
            <MessageInput placeholder="Write a message..." :sending="store.isSending" @send="handleSend" />

            <div class="thread-footer">
              <Icon name="lock" size="xs" /><span>End-to-end encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { nip19 } from 'nostr-core'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({ visible: { type: Boolean, default: false } })
defineEmits(['close'])

const store = useMessagesStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

const messagesRef = ref(null)
const showNewDm = ref(false)
const newDmPubkey = ref('')
const newDmInput = ref(null)

watch(() => props.visible, (v) => {
  if (v && !store.hasFetched) store.fetchInbox()
})

watch(() => store.selectedMessages.length, () => {
  nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
})

watch(showNewDm, (v) => { if (v) nextTick(() => newDmInput.value?.focus()) })

async function handleStartConversation() {
  let pubkey = newDmPubkey.value.trim()
  if (!pubkey) return

  if (pubkey.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(pubkey)
      if (decoded.type === 'npub') pubkey = decoded.data
    } catch { uiStore.showError('Invalid npub format'); return }
  }

  if (!/^[a-f0-9]{64}$/.test(pubkey)) { uiStore.showError('Invalid pubkey'); return }
  if (pubkey === authStore.hex) { uiStore.showError("Can't message yourself"); return }

  showNewDm.value = false
  newDmPubkey.value = ''
  await store.startConversation(pubkey)
}

async function handleSend(content) {
  if (!store.selectedPubkey) return
  const result = await store.sendDM(store.selectedPubkey, content)
  if (result?.success) nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
}

function shortKey(hex) { return hex ? hex.slice(0, 8) + '...' + hex.slice(-4) : '' }
function truncate(t, l) { return !t ? '' : t.length > l ? t.slice(0, l) + '...' : t }
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
.dms-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
}

.dms-panel {
  width: 380px;
  max-width: 100vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  box-shadow: var(--shadow-xl);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-actions { display: flex; gap: 0.25rem; }

.panel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.panel-btn:hover { background: var(--color-surface-hover); color: var(--color-text); }
.panel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.new-dm-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-primary-soft);
  flex-shrink: 0;
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

.panel-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Conversation list pane */
.conv-list-pane { flex: 1; overflow-y: auto; }

.pane-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.625rem;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
  padding: 2rem;
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

.conv-list { display: flex; flex-direction: column; }

.conv-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
  color: var(--color-text);
  font-family: inherit;
}

.conv-item:hover { background: var(--color-surface-hover); }

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
.conv-name { display: block; font-size: 0.8125rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-preview { display: block; font-size: 0.75rem; color: var(--color-text-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.125rem; }
.conv-time { font-size: 0.6875rem; color: var(--color-text-subtle); flex-shrink: 0; }

/* Thread pane */
.thread-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.thread-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.thread-avatar { width: 1.75rem; height: 1.75rem; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.thread-avatar--placeholder { display: flex; align-items: center; justify-content: center; background: var(--color-surface-hover); color: var(--color-text-subtle); }
.thread-name { font-size: 0.875rem; font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.thread-messages { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; display: flex; flex-direction: column; background: var(--color-bg); }

.thread-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem;
  color: var(--color-text-subtle);
  font-size: 0.6875rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Slide-in from LEFT */
.dms-panel-enter-active { transition: opacity 0.25s ease; }
.dms-panel-leave-active { transition: opacity 0.2s ease; }
.dms-panel-enter-from, .dms-panel-leave-to { opacity: 0; }
.dms-panel-enter-active .dms-panel { animation: slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.dms-panel-leave-active .dms-panel { animation: slideOutLeft 0.2s ease forwards; }

@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }

@media (max-width: 480px) { .dms-panel { width: 100vw; } }
</style>
