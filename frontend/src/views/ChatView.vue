<template>
  <div class="chat-page animate-fadeIn">
    <!-- Page Header -->
    <header class="page-header">
      <h1>Feedback & Support</h1>
      <p class="subtitle">Report bugs, share ideas, or ask questions — directly to the BadgeBox team.</p>
    </header>

    <!-- Amber not supported notice -->
    <div v-if="!chatStore.chatSupported" class="info-banner info-banner--warning">
      <div class="info-banner-icon">
        <Icon name="alert-triangle" size="md" />
      </div>
      <div class="info-banner-content">
        <p>Encrypted chat requires <strong>nsec</strong> or a <strong>NIP-07 browser extension</strong> (nos2x, Alby). Amber (NIP-46) support for encrypted DMs is coming soon.</p>
      </div>
    </div>

    <!-- Info Banner -->
    <div v-else-if="chatStore.messages.length === 0 && !chatStore.isLoading" class="info-banner">
      <div class="info-banner-icon">
        <Icon name="info-circle" size="md" />
      </div>
      <div class="info-banner-content">
        <p>Your messages are <strong>end-to-end encrypted</strong> using the Nostr NIP-17 protocol. Only you and the BadgeBox developer can read them. No message is stored on any server — everything lives on Nostr relays.</p>
      </div>
    </div>

    <!-- Chat Container -->
    <div class="chat-container">
      <!-- Recipient Header -->
      <div class="chat-header">
        <div class="recipient-info">
          <div class="recipient-avatar">
            <Icon name="shield-check" size="md" />
          </div>
          <div>
            <span class="recipient-name">BadgeBox Team</span>
            <span class="recipient-detail">Encrypted via NIP-17</span>
          </div>
        </div>
        <button
          class="refresh-btn"
          :disabled="chatStore.isLoading"
          @click="chatStore.fetchMessages()"
          title="Refresh messages"
        >
          <Icon name="refresh" size="sm" :spin="chatStore.isLoading" />
        </button>
      </div>

      <!-- Messages Area -->
      <div class="messages-area" ref="messagesRef">
        <!-- Loading -->
        <div v-if="chatStore.isLoading" class="chat-status">
          <Icon name="loader-2" size="lg" :spin="true" />
          <p>Decrypting messages...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="chatStore.messages.length === 0" class="chat-empty">
          <div class="empty-visual">
            <Icon name="message-circle" size="xl" />
          </div>
          <h3>Start a conversation</h3>
          <p>Found a bug? Have an idea? Just want to say hi?<br />Send your first message below.</p>
          <div class="quick-prompts">
            <button class="prompt-chip" @click="prefillText = 'Bug report: '">Bug report</button>
            <button class="prompt-chip" @click="prefillText = 'Feature idea: '">Feature idea</button>
            <button class="prompt-chip" @click="prefillText = 'Question: '">Question</button>
          </div>
        </div>

        <!-- Messages -->
        <template v-else>
          <MessageBubble
            v-for="msg in chatStore.messages"
            :key="msg.id"
            :message="msg"
          />
        </template>
      </div>

      <!-- Input -->
      <MessageInput
        :placeholder="chatStore.chatSupported ? 'Describe a bug, share feedback, or ask a question...' : 'Encrypted chat not available with current login method'"
        :disabled="chatStore.isLoading || !chatStore.chatSupported"
        :sending="chatStore.isSending"
        :prefill="prefillText"
        @send="handleSend"
      />
    </div>

    <!-- Footer Notice -->
    <div class="encryption-footer">
      <Icon name="lock" size="sm" />
      <span>End-to-end encrypted — only you and the recipient can read these messages</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const chatStore = useChatStore()
const messagesRef = ref(null)
const prefillText = ref('')

onMounted(() => {
  chatStore.fetchMessages()
})

watch(() => chatStore.messages.length, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
})

async function handleSend(content) {
  prefillText.value = ''
  const result = await chatStore.sendMessage(content)
  if (result?.success) {
    nextTick(() => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    })
  }
}
</script>

<style scoped>
.chat-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}

.page-header {
  margin-bottom: var(--space-lg);
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

/* Info Banner */
.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--color-primary-soft);
  border: 1px solid rgba(157, 78, 221, 0.25);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-lg);
}

.info-banner--warning {
  background: var(--color-warning-soft);
  border-color: rgba(245, 158, 11, 0.25);
}

.info-banner--warning .info-banner-icon {
  color: var(--color-warning);
}

.info-banner-icon {
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-banner-content p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.info-banner-content strong {
  color: var(--color-text);
}

/* Chat Container */
.chat-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 60vh;
  min-height: 400px;
  background: var(--color-surface);
}

/* Recipient Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.recipient-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.recipient-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.recipient-name {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.recipient-detail {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.refresh-btn {
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

.refresh-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
}

.chat-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.75rem;
  color: var(--color-text-muted);
}

.chat-status p {
  margin: 0;
  font-size: 0.875rem;
}

/* Empty State */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: var(--space-xl);
}

.empty-visual {
  width: 4rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.chat-empty h3 {
  margin: 0 0 var(--space-sm);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.chat-empty p {
  margin: 0 0 var(--space-lg);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Quick Prompts */
.quick-prompts {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  justify-content: center;
}

.prompt-chip {
  padding: 0.375rem 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.prompt-chip:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Footer */
.encryption-footer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: center;
  padding: var(--space-md);
  color: var(--color-text-subtle);
  font-size: 0.75rem;
}

@media (max-width: 640px) {
  .chat-page {
    padding: var(--space-md) var(--space-sm);
  }

  .chat-container {
    height: 65vh;
    border-radius: var(--radius-md);
  }

  .quick-prompts {
    flex-direction: column;
    align-items: center;
  }
}
</style>
