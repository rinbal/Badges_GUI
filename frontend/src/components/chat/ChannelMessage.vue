<template>
  <div class="channel-msg" :class="{ 'channel-msg--own': isOwn, 'channel-msg--reply': !!message.replyTo }">
    <!-- Reply indicator -->
    <div v-if="message.replyTo && replyPreview" class="reply-indicator">
      <Icon name="corner-down-right" size="xs" />
      <span class="reply-author">{{ replyPreview.name || shortKey(replyPreview.pubkey) }}</span>
      <span class="reply-text">{{ replyPreview.content }}</span>
    </div>

    <div class="msg-row">
      <!-- Avatar -->
      <img
        v-if="profile?.picture && !avatarError"
        :src="profile.picture"
        alt=""
        class="msg-avatar"
        @error="avatarError = true"
      />
      <div v-else class="msg-avatar msg-avatar--placeholder">
        <Icon name="user" size="xs" />
      </div>

      <!-- Content -->
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">{{ profile?.name || shortKey(message.pubkey) }}</span>
          <span class="msg-time">{{ formattedTime }}</span>
        </div>
        <p class="msg-content" v-html="linkedContent"></p>
      </div>

      <!-- Actions -->
      <div class="msg-actions">
        <button
          v-if="canReply"
          class="msg-action-btn"
          @click="$emit('reply', message)"
          title="Reply"
        >
          <Icon name="corner-up-left" size="xs" />
        </button>
        <button
          v-if="showModeration"
          class="msg-action-btn msg-action-btn--danger"
          @click="$emit('hide', message.id)"
          title="Hide message"
        >
          <Icon name="eye-off" size="xs" />
        </button>
        <button
          v-if="showModeration && !isOwn"
          class="msg-action-btn msg-action-btn--danger"
          @click="$emit('mute', message.pubkey)"
          title="Mute user"
        >
          <Icon name="volume-off" size="xs" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Icon from '@/components/common/Icon.vue'
import { cleanMessageContent, linkifyUrls, escapeHtml } from '@/utils/chatFormat'

const props = defineProps({
  message: { type: Object, required: true },
  profile: { type: Object, default: null },
  isOwn: { type: Boolean, default: false },
  canReply: { type: Boolean, default: false },
  showModeration: { type: Boolean, default: false },
  replyPreview: { type: Object, default: null }
})

defineEmits(['reply', 'hide', 'mute'])

const avatarError = ref(false)

const formattedTime = computed(() => {
  const date = new Date(props.message.created_at * 1000)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400 && date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

const linkedContent = computed(() => {
  const cleaned = cleanMessageContent(props.message.content)
  return linkifyUrls(escapeHtml(cleaned))
})

function shortKey(hex) {
  if (!hex) return ''
  return hex.slice(0, 8) + '...'
}

</script>

<style scoped>
.channel-msg {
  padding: 0.25rem 0;
}

.channel-msg:hover {
  background: var(--color-surface-hover);
  border-radius: var(--radius-md);
}

.channel-msg:hover .msg-actions {
  opacity: 1;
}

/* Reply indicator */
.reply-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: 2.75rem;
  margin-bottom: 0.125rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  border-left: 2px solid var(--color-border);
}

.reply-author {
  font-weight: 600;
  color: var(--color-text-muted);
}

.reply-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* Message row */
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
}

.msg-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.msg-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  color: var(--color-text-subtle);
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.0625rem;
}

.msg-author {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.channel-msg--own .msg-author {
  color: var(--color-primary);
}

.msg-time {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.msg-content {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--color-text);
  word-break: break-word;
  white-space: pre-wrap;
}

.msg-content :deep(.msg-link) {
  color: var(--color-primary);
  text-decoration: none;
}

.msg-content :deep(.msg-link:hover) {
  text-decoration: underline;
}

/* Actions - visible on hover */
.msg-actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.msg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.msg-action-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

.msg-action-btn--danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Mobile - always show actions */
@media (max-width: 640px) {
  .msg-actions {
    opacity: 1;
  }
}
</style>
