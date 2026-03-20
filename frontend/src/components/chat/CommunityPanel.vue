<template>
  <Transition name="community-panel">
    <div v-if="visible" class="community-overlay" @click.self="$emit('close')">
      <div class="community-panel">
        <!-- Header -->
        <div class="panel-header">
          <div class="panel-title">
            <div class="panel-title-dot" :class="{ 'panel-title-dot--live': store.isConnected }"></div>
            <span>{{ store.channelMeta?.name || 'Community' }}</span>
          </div>
          <div class="panel-actions">
            <button class="panel-btn" :disabled="store.isLoading" @click="store.joinChannel()" title="Refresh">
              <Icon name="refresh" size="sm" :spin="store.isLoading" />
            </button>
            <button class="panel-btn" @click="$emit('close')" title="Close">
              <Icon name="x" size="sm" />
            </button>
          </div>
        </div>

        <!-- Channel not ready -->
        <div v-if="!store.channelReady" class="panel-status-full">
          <Icon name="hash" size="xl" />
          <p>Community channel coming soon.</p>
          <button v-if="isAdmin" class="btn-sm" @click="handleCreate" :disabled="creating">
            {{ creating ? 'Creating...' : 'Create Channel' }}
          </button>
        </div>

        <template v-else>
          <!-- Messages -->
          <div class="panel-messages" ref="messagesRef" @scroll="handleScroll">
            <div v-if="store.isLoading" class="panel-status">
              <Icon name="loader-2" size="md" :spin="true" />
            </div>

            <div v-else-if="store.visibleMessages.length === 0" class="panel-status">
              <Icon name="message-circle" size="md" />
              <span>No messages yet</span>
            </div>

            <template v-else>
              <ChannelMessage
                v-for="msg in store.visibleMessages"
                :key="msg.id"
                :message="msg"
                :profile="store.getProfile(msg.pubkey)"
                :is-own="msg.pubkey === authStore.hex"
                :can-reply="authStore.isAuthenticated"
                :show-moderation="store.isModerator"
                :reply-preview="getReplyPreview(msg.replyTo)"
                @reply="startReply"
                @hide="store.hideMessage($event)"
                @mute="store.muteUser($event)"
              />
            </template>
          </div>

          <!-- Reply bar -->
          <div v-if="replyingTo" class="reply-bar">
            <div class="reply-bar-content">
              <Icon name="corner-up-left" size="xs" />
              <span>Replying to <strong>{{ replyingToName }}</strong></span>
            </div>
            <button class="reply-bar-close" @click="replyingTo = null"><Icon name="x" size="xs" /></button>
          </div>

          <!-- Input -->
          <div class="panel-input">
            <div v-if="!authStore.isAuthenticated" class="login-prompt" @click="goToLogin">
              <Icon name="lock" size="sm" />
              <span>Sign in to chat</span>
            </div>
            <MessageInput
              v-else
              placeholder="Message the community..."
              :disabled="store.isLoading"
              :sending="store.isSending"
              @send="handleSend"
            />
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicChatStore } from '@/stores/publicChat'
import { useAuthStore } from '@/stores/auth'
import { ADMIN_PUBKEY_HEX } from '@/config/chat'
import ChannelMessage from '@/components/chat/ChannelMessage.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({ visible: { type: Boolean, default: false } })
defineEmits(['close'])

const router = useRouter()
const store = usePublicChatStore()
const authStore = useAuthStore()

const messagesRef = ref(null)
const replyingTo = ref(null)
const creating = ref(false)
const userScrolledUp = ref(false)
const isAdmin = computed(() => authStore.hex === ADMIN_PUBKEY_HEX)

const replyingToName = computed(() => {
  if (!replyingTo.value) return ''
  const p = store.getProfile(replyingTo.value.pubkey)
  return p?.name || replyingTo.value.pubkey.slice(0, 8) + '...'
})

watch(() => props.visible, (v) => {
  if (v && store.channelReady && !store.isConnected) store.joinChannel()
  if (v) nextTick(() => scrollToBottom())
})

watch(() => store.visibleMessages.length, () => {
  if (!userScrolledUp.value) nextTick(() => scrollToBottom())
})

onUnmounted(() => { store.leaveChannel() })

function scrollToBottom() { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight }

function handleScroll() {
  if (!messagesRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesRef.value
  userScrolledUp.value = scrollHeight - scrollTop - clientHeight > 100
}

async function handleSend(content) {
  const replyId = replyingTo.value?.id || null
  replyingTo.value = null
  const result = await store.sendMessage(content, replyId)
  if (result?.success) { userScrolledUp.value = false; nextTick(() => scrollToBottom()) }
}

function startReply(msg) { replyingTo.value = msg }

function getReplyPreview(id) {
  if (!id) return null
  const m = store.visibleMessages.find(x => x.id === id)
  if (!m) return null
  const p = store.getProfile(m.pubkey)
  return { pubkey: m.pubkey, name: p?.name || null, content: m.content.slice(0, 50) }
}

function goToLogin() { router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } }) }

async function handleCreate() {
  creating.value = true
  try { await store.createCommunityChannel('BadgeBox Community', 'Public chatroom for the BadgeBox community.', '') } catch {}
  creating.value = false
}
</script>

<style scoped>
.community-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.community-panel {
  width: 900px;
  max-width: 100vw;
  height: 85vh;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  background: var(--color-surface-elevated);
  border-top: 2px solid var(--color-primary);
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5), var(--shadow-glow);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}

.panel-title-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-text-subtle);
}

.panel-title-dot--live {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.panel-actions { display: flex; gap: 0.25rem; }

.panel-btn {
  display: flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; border: none; border-radius: var(--radius-md);
  background: transparent; color: var(--color-text-muted); cursor: pointer;
  transition: all var(--transition-fast);
}

.panel-btn:hover { background: var(--color-surface-hover); color: var(--color-text); }
.panel-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.panel-status-full {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 2rem;
}

.panel-status-full p { margin: 0; }

.btn-sm {
  padding: 0.375rem 1rem; background: var(--color-primary); color: #fff;
  border: none; border-radius: var(--radius-md); font-size: 0.8125rem;
  font-family: inherit; cursor: pointer; transition: all var(--transition-normal);
}

.btn-sm:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.panel-messages { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; background: var(--color-surface); }

.panel-status {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 0.625rem; color: var(--color-text-subtle); font-size: 0.8125rem;
}

.reply-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.375rem 1rem; background: var(--color-primary-soft);
  border-top: 1px solid rgba(157, 78, 221, 0.2); flex-shrink: 0;
}

.reply-bar-content { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--color-primary); }

.reply-bar-close {
  display: flex; align-items: center; justify-content: center;
  width: 1.5rem; height: 1.5rem; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--color-text-muted); cursor: pointer;
}

.panel-input { flex-shrink: 0; }

.login-prompt {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.875rem 1rem; border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated); color: var(--color-text-muted);
  font-size: 0.875rem; cursor: pointer; transition: all var(--transition-normal);
}

.login-prompt:hover { background: var(--color-primary-soft); color: var(--color-primary); }

/* Slide UP from bottom */
.community-panel-enter-active { transition: opacity 0.25s ease; }
.community-panel-leave-active { transition: opacity 0.2s ease; }
.community-panel-enter-from, .community-panel-leave-to { opacity: 0; }
.community-panel-enter-active .community-panel { animation: slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.community-panel-leave-active .community-panel { animation: slideOutDown 0.2s ease forwards; }

@keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideOutDown { from { transform: translateY(0); } to { transform: translateY(100%); } }

@media (max-width: 640px) {
  .community-panel { width: 100vw; height: 92vh; border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
}
</style>
