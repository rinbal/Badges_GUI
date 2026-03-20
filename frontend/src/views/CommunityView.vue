<template>
  <div class="community-page animate-fadeIn">
    <!-- Header -->
    <header class="page-header">
      <div class="page-header-row">
        <div>
          <h1>{{ chatStore.channelMeta?.name || 'Community' }}</h1>
          <p class="subtitle">{{ chatStore.channelMeta?.about || 'Public chatroom, open to everyone on Nostr' }}</p>
        </div>
        <div class="header-status">
          <span v-if="chatStore.isConnected" class="status-dot status-dot--online"></span>
          <span v-else class="status-dot status-dot--offline"></span>
          <span class="status-text">{{ chatStore.isConnected ? 'Live' : 'Connecting...' }}</span>
        </div>
      </div>
    </header>

    <!-- Channel not set up -->
    <div v-if="!chatStore.channelReady" class="state-card">
      <Icon name="hash" size="xl" />
      <h3>Channel not created yet</h3>
      <p>The community channel will be available soon.</p>
      <!-- Admin only: create channel -->
      <div v-if="isAdmin" class="create-channel-form">
        <button class="btn-primary" @click="handleCreateChannel" :disabled="creating">
          {{ creating ? 'Creating...' : 'Create Community Channel' }}
        </button>
      </div>
    </div>

    <!-- Chat container -->
    <div v-else class="chat-container">
      <!-- Messages -->
      <div class="messages-area" ref="messagesRef" @scroll="handleScroll">
        <!-- Loading -->
        <div v-if="chatStore.isLoading" class="messages-status">
          <Icon name="loader-2" size="lg" :spin="true" />
          <p>Loading messages...</p>
        </div>

        <!-- Empty -->
        <div v-else-if="chatStore.visibleMessages.length === 0" class="messages-empty">
          <Icon name="message-circle" size="xl" />
          <h3>No messages yet</h3>
          <p>Be the first to say something!</p>
        </div>

        <!-- Messages list -->
        <template v-else>
          <ChannelMessage
            v-for="msg in chatStore.visibleMessages"
            :key="msg.id"
            :message="msg"
            :profile="chatStore.getProfile(msg.pubkey)"
            :is-own="msg.pubkey === authStore.hex"
            :can-reply="authStore.isAuthenticated"
            :show-moderation="chatStore.isModerator"
            :reply-preview="getReplyPreview(msg.replyTo)"
            @reply="startReply"
            @hide="handleHide"
            @mute="handleMute"
          />
        </template>
      </div>

      <!-- Reply bar -->
      <div v-if="replyingTo" class="reply-bar">
        <div class="reply-bar-content">
          <Icon name="corner-up-left" size="xs" />
          <span>Replying to <strong>{{ replyingToName }}</strong></span>
        </div>
        <button class="reply-bar-close" @click="cancelReply">
          <Icon name="x" size="xs" />
        </button>
      </div>

      <!-- Input area -->
      <div class="input-area">
        <!-- Not logged in - login prompt -->
        <div v-if="!authStore.isAuthenticated" class="login-prompt" @click="goToLogin">
          <Icon name="lock" size="sm" />
          <span>Sign in to join the conversation</span>
          <Icon name="chevron-right" size="sm" />
        </div>

        <!-- Logged in - message input -->
        <MessageInput
          v-else
          placeholder="Message the community..."
          :disabled="chatStore.isLoading"
          :sending="chatStore.isSending"
          @send="handleSend"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicChatStore } from '@/stores/publicChat'
import { useAuthStore } from '@/stores/auth'
import { ADMIN_PUBKEY_HEX } from '@/config/chat'
import ChannelMessage from '@/components/chat/ChannelMessage.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const router = useRouter()
const chatStore = usePublicChatStore()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.hex === ADMIN_PUBKEY_HEX)

const messagesRef = ref(null)
const replyingTo = ref(null)
const creating = ref(false)
const userScrolledUp = ref(false)

const replyingToName = computed(() => {
  if (!replyingTo.value) return ''
  const profile = chatStore.getProfile(replyingTo.value.pubkey)
  return profile?.name || replyingTo.value.pubkey.slice(0, 8) + '...'
})

onMounted(() => {
  chatStore.joinChannel()
})

onUnmounted(() => {
  chatStore.leaveChannel()
})

// Auto-scroll on new messages (unless user scrolled up)
watch(() => chatStore.visibleMessages.length, () => {
  if (!userScrolledUp.value) {
    nextTick(() => scrollToBottom())
  }
})

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function handleScroll() {
  if (!messagesRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesRef.value
  // User is "scrolled up" if more than 100px from bottom
  userScrolledUp.value = scrollHeight - scrollTop - clientHeight > 100
}

async function handleSend(content) {
  const replyId = replyingTo.value?.id || null
  replyingTo.value = null
  const result = await chatStore.sendMessage(content, replyId)
  if (result?.success) {
    userScrolledUp.value = false
    nextTick(() => scrollToBottom())
  }
}

function startReply(message) {
  replyingTo.value = message
}

function cancelReply() {
  replyingTo.value = null
}

function getReplyPreview(replyToId) {
  if (!replyToId) return null
  const original = chatStore.visibleMessages.find(m => m.id === replyToId)
  if (!original) return null
  const profile = chatStore.getProfile(original.pubkey)
  return {
    pubkey: original.pubkey,
    name: profile?.name || null,
    content: original.content.slice(0, 60)
  }
}

async function handleHide(messageId) {
  await chatStore.hideMessage(messageId)
}

async function handleMute(pubkey) {
  await chatStore.muteUser(pubkey)
}

function goToLogin() {
  router.push({ name: 'login', query: { redirect: '/community' } })
}

async function handleCreateChannel() {
  creating.value = true
  try {
    await chatStore.createCommunityChannel(
      'BadgeBox Community',
      'Public chatroom for the BadgeBox community. Talk about badges, Nostr, and more.',
      ''
    )
    chatStore.joinChannel()
  } catch (err) {
    console.error('Failed to create channel:', err)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.community-page {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}

/* Header */
.page-header {
  margin-bottom: var(--space-lg);
}

.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
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

.header-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding-top: 0.5rem;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-dot--online {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
}

.status-dot--offline {
  background: var(--color-text-subtle);
}

.status-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* State card (channel not ready) */
.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
}

.state-card h3 {
  margin: var(--space-md) 0 var(--space-sm);
  color: var(--color-text);
}

.state-card p {
  margin: 0;
}

.create-channel-form {
  margin-top: var(--space-lg);
}

.btn-primary {
  padding: 0.625rem 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Chat container */
.chat-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 72vh;
  min-height: 500px;
  background: var(--color-surface);
}

/* Messages area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.messages-status,
.messages-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
}

.messages-status p,
.messages-empty p {
  margin: 0;
  font-size: 0.875rem;
}

.messages-empty h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--color-text);
}

/* Reply bar */
.reply-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 1rem;
  background: var(--color-primary-soft);
  border-top: 1px solid rgba(157, 78, 221, 0.2);
  flex-shrink: 0;
}

.reply-bar-content {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-primary);
}

.reply-bar-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.reply-bar-close:hover {
  background: var(--color-surface-hover);
}

/* Input area */
.input-area {
  flex-shrink: 0;
}

/* Login prompt */
.login-prompt {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.login-prompt:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.login-prompt :last-child {
  margin-left: auto;
}

/* Responsive */
@media (max-width: 640px) {
  .community-page {
    padding: var(--space-md) var(--space-sm);
  }

  .chat-container {
    height: 75vh;
    min-height: 400px;
    border-radius: var(--radius-md);
  }

  .page-header-row {
    flex-direction: column;
    gap: var(--space-sm);
  }
}
</style>
