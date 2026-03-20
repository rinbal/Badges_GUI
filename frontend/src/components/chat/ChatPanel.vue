<template>
  <Transition name="chat-panel">
    <div v-if="visible" class="chat-overlay" @click.self="$emit('close')">
      <div class="chat-panel">
        <!-- Panel Header -->
        <div class="panel-header">
          <div class="panel-title">
            <div class="panel-title-icon">
              <Icon name="shield-check" size="sm" />
            </div>
            <div>
              <span class="panel-title-text">Feedback & Support</span>
              <span class="panel-title-sub">Encrypted via NIP-17</span>
            </div>
          </div>
          <div class="panel-actions">
            <button
              class="panel-btn"
              :disabled="chatStore.isLoading"
              @click="retry"
              title="Refresh"
            >
              <Icon name="refresh" size="sm" :spin="chatStore.isLoading" />
            </button>
            <button class="panel-btn" @click="$emit('close')" title="Close">
              <Icon name="x" size="sm" />
            </button>
          </div>
        </div>

        <!-- Unsupported Auth Warning -->
        <div v-if="!chatStore.chatSupported" class="panel-notice panel-notice--warning">
          <Icon name="alert-triangle" size="sm" />
          <span>Encrypted chat requires <strong>nsec</strong> or a <strong>NIP-07 extension</strong>. Amber support coming soon.</span>
        </div>

        <!-- Error State -->
        <div v-if="chatStore.error" class="panel-notice panel-notice--error">
          <Icon name="alert-circle" size="sm" />
          <div>
            <span>{{ chatStore.error }}</span>
            <button class="retry-link" @click="retry">Try again</button>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="panel-messages" ref="messagesRef">
          <!-- Loading -->
          <div v-if="chatStore.isLoading" class="panel-status">
            <Icon name="loader-2" size="lg" :spin="true" />
            <p>Connecting to relays...</p>
          </div>

          <!-- Empty State (only when no error) -->
          <div v-else-if="chatStore.messages.length === 0 && !chatStore.error" class="panel-empty">
            <div class="empty-visual">
              <Icon name="message-circle" size="lg" />
            </div>
            <h4>Start a conversation</h4>
            <p>Found a bug? Have an idea?<br />Send your first message below.</p>
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
          :placeholder="chatStore.chatSupported ? 'Type your message...' : 'Chat unavailable with current login'"
          :disabled="chatStore.isLoading || !chatStore.chatSupported"
          :sending="chatStore.isSending"
          :prefill="prefillText"
          @send="handleSend"
        />

        <!-- Footer -->
        <div class="panel-footer">
          <Icon name="lock" size="xs" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close'])

const chatStore = useChatStore()
const messagesRef = ref(null)
const prefillText = ref('')

// Fetch messages when panel opens (retry-able)
watch(() => props.visible, (isVisible) => {
  if (isVisible && chatStore.chatSupported && chatStore.messages.length === 0 && !chatStore.isLoading) {
    chatStore.fetchMessages()
  }
  if (isVisible) {
    nextTick(() => scrollToBottom())
  }
})

// Auto-scroll on new messages
watch(() => chatStore.messages.length, () => {
  nextTick(() => scrollToBottom())
})

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function retry() {
  chatStore.error = null
  chatStore.fetchMessages()
}

async function handleSend(content) {
  prefillText.value = ''
  const result = await chatStore.sendMessage(content)
  if (result?.success) {
    nextTick(() => scrollToBottom())
  }
}
</script>

<style scoped>
/* Overlay */
.chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

/* Panel */
.chat-panel {
  width: 400px;
  max-width: 100vw;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  box-shadow: var(--shadow-xl);
}

/* Header */
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
  gap: 0.625rem;
}

.panel-title-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  flex-shrink: 0;
}

.panel-title-text {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-title-sub {
  display: block;
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.panel-actions {
  display: flex;
  gap: 0.25rem;
}

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

.panel-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.panel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Notice banners */
.panel-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.panel-notice--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
}

.panel-notice--error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-bottom: 1px solid rgba(239, 68, 68, 0.15);
}

.retry-link {
  display: inline;
  background: none;
  border: none;
  color: var(--color-danger);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.75rem;
  font-family: inherit;
  padding: 0;
  margin-left: 0.375rem;
}

.retry-link:hover {
  opacity: 0.8;
}

/* Messages */
.panel-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
}

.panel-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.75rem;
  color: var(--color-text-muted);
}

.panel-status p {
  margin: 0;
  font-size: 0.8125rem;
}

/* Empty State */
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 1.5rem 1rem;
}

.empty-visual {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}

.panel-empty h4 {
  margin: 0 0 0.375rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-empty p {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.quick-prompts {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: center;
}

.prompt-chip {
  padding: 0.3rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: 0.75rem;
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
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  color: var(--color-text-subtle);
  font-size: 0.6875rem;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

/* Slide-in Transition */
.chat-panel-enter-active {
  transition: opacity 0.25s ease;
}

.chat-panel-leave-active {
  transition: opacity 0.2s ease;
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
}

.chat-panel-enter-active .chat-panel {
  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-panel-leave-active .chat-panel {
  animation: slideOutRight 0.2s ease forwards;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideOutRight {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

/* Mobile */
@media (max-width: 480px) {
  .chat-panel {
    width: 100vw;
  }
}
</style>
