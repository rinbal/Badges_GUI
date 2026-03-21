<template>
  <div class="admin-chat-page animate-fadeIn">
    <header class="page-header">
      <h1>Support Inbox</h1>
      <p class="subtitle">All user conversations, badge-gated admin view</p>
    </header>

    <!-- Access Denied -->
    <div v-if="accessDenied" class="access-card">
      <div class="access-card-icon access-card-icon--denied">
        <Icon name="lock" size="xl" />
      </div>
      <h3>Access Denied</h3>
      <p>This page requires the <strong>badgebox-admin</strong> badge.</p>
      <p class="access-hint">Only the BadgeBox team can access the support inbox.</p>
    </div>

    <!-- Loading Access Check -->
    <div v-else-if="checkingAccess" class="access-card">
      <Icon name="loader-2" size="lg" :spin="true" />
      <p>Verifying badge access...</p>
    </div>

    <!-- Admin Chat Layout -->
    <div v-else class="chat-layout">
      <!-- Conversations Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Conversations</span>
          <span v-if="chatStore.conversationList.length > 0" class="sidebar-count">
            {{ chatStore.conversationList.length }}
          </span>
          <button
            class="refresh-btn"
            :disabled="chatStore.isLoading"
            @click="chatStore.fetchAllConversations()"
            title="Refresh"
          >
            <Icon name="refresh" size="sm" :spin="chatStore.isLoading" />
          </button>
        </div>

        <div v-if="chatStore.isLoading && chatStore.conversationList.length === 0" class="sidebar-status">
          <Icon name="loader-2" size="md" :spin="true" />
          <span>Loading conversations...</span>
        </div>

        <div v-else-if="chatStore.conversationList.length === 0" class="sidebar-status">
          <Icon name="inbox" size="md" />
          <span>No conversations yet</span>
        </div>

        <div v-else class="conversation-list">
          <button
            v-for="conv in chatStore.conversationList"
            :key="conv.pubkey"
            :class="['conversation-item', { active: chatStore.selectedPartner === conv.pubkey }]"
            @click="chatStore.selectConversation(conv.pubkey)"
          >
            <img
              v-if="conv.profile?.picture"
              :src="conv.profile.picture"
              alt=""
              class="conv-avatar"
            />
            <div v-else class="conv-avatar conv-avatar--placeholder">
              <Icon name="user" size="sm" />
            </div>
            <div class="conv-info">
              <span class="conv-name">{{ conv.profile?.name || shortPubkey(conv.pubkey) }}</span>
              <span class="conv-preview">{{ truncate(conv.lastMessage, 36) }}</span>
            </div>
            <div class="conv-meta">
              <span class="conv-time">{{ relativeTime(conv.lastTime) }}</span>
              <span class="conv-count">{{ conv.messageCount }}</span>
            </div>
          </button>
        </div>
      </aside>

      <!-- Messages Panel -->
      <main class="messages-panel">
        <template v-if="chatStore.selectedPartner">
          <!-- Partner Header -->
          <div class="partner-header">
            <img
              v-if="selectedProfile?.picture"
              :src="selectedProfile.picture"
              alt=""
              class="partner-avatar"
            />
            <div v-else class="partner-avatar partner-avatar--placeholder">
              <Icon name="user" size="sm" />
            </div>
            <div class="partner-info">
              <span class="partner-name">{{ selectedProfile?.name || shortPubkey(chatStore.selectedPartner) }}</span>
              <span class="partner-pubkey">{{ chatStore.selectedPartner }}</span>
            </div>
          </div>

          <!-- Messages -->
          <div class="messages-area" ref="messagesRef">
            <MessageBubble
              v-for="msg in chatStore.selectedMessages"
              :key="msg.id"
              :message="msg"
            />
          </div>

          <!-- Reply Input -->
          <MessageInput
            placeholder="Write a reply..."
            :sending="chatStore.isSending"
            @send="handleReply"
          />
        </template>

        <div v-else class="no-selection">
          <div class="no-selection-icon">
            <Icon name="messages" size="xl" />
          </div>
          <h3>Select a conversation</h3>
          <p>Choose a user from the sidebar to view their messages and reply.</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import Icon from '@/components/common/Icon.vue'

const chatStore = useChatStore()
const messagesRef = ref(null)
const checkingAccess = ref(true)
const accessDenied = ref(false)

const selectedProfile = computed(() => {
  if (!chatStore.selectedPartner) return null
  return chatStore.conversationProfiles[chatStore.selectedPartner] || null
})

onMounted(async () => {
  const hasAccess = await chatStore.checkAdminAccess()
  checkingAccess.value = false

  if (!hasAccess) {
    accessDenied.value = true
    return
  }

  chatStore.fetchAllConversations()
})

watch(() => chatStore.selectedMessages.length, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
})

function shortPubkey(hex) {
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

async function handleReply(content) {
  if (!chatStore.selectedPartner) return
  await chatStore.replyToUser(chatStore.selectedPartner, content)
}
</script>

<style scoped>
.admin-chat-page {
  max-width: 1100px;
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

/* Access Card */
.access-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.access-card-icon {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-md);
}

.access-card-icon--denied {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.access-card h3 {
  margin: 0 0 var(--space-sm);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.access-card p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.access-hint {
  margin-top: var(--space-sm) !important;
  font-size: 0.8125rem !important;
  color: var(--color-text-subtle) !important;
}

/* Layout */
.chat-layout {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  height: 70vh;
  min-height: 450px;
  background: var(--color-surface);
}

/* Sidebar */
.sidebar {
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
  gap: var(--space-sm);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.sidebar-count {
  font-size: 0.6875rem;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-weight: 600;
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

.sidebar-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.75rem;
  color: var(--color-text-subtle);
  font-size: 0.8125rem;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
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

.conversation-item:hover {
  background: var(--color-surface-hover);
}

.conversation-item.active {
  background: var(--color-primary-soft);
  border-left-color: var(--color-primary);
}

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

.conv-info {
  flex: 1;
  min-width: 0;
}

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

.conv-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  flex-shrink: 0;
}

.conv-time {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.conv-count {
  font-size: 0.625rem;
  background: var(--color-primary);
  color: #fff;
  padding: 0.0625rem 0.375rem;
  border-radius: var(--radius-full);
  font-weight: 600;
  min-width: 1.25rem;
  text-align: center;
}

/* Messages Panel */
.messages-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.partner-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.partner-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.partner-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-hover);
  color: var(--color-text-subtle);
}

.partner-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.partner-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.partner-pubkey {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg);
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: var(--space-xl);
}

.no-selection-icon {
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

.no-selection h3 {
  margin: 0 0 var(--space-sm);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.no-selection p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Mobile */
@media (max-width: 768px) {
  .admin-chat-page {
    padding: var(--space-md) var(--space-sm);
  }

  .chat-layout {
    flex-direction: column;
    height: auto;
    min-height: unset;
  }

  .sidebar {
    width: 100%;
    min-width: unset;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    max-height: 220px;
  }

  .messages-panel {
    min-height: 400px;
  }
}
</style>
