<template>
  <div class="message" :class="{ 'message--mine': message.isMine }">
    <div class="message-bubble">
      <p class="message-text">{{ displayContent }}</p>
      <span class="message-time">{{ formattedTime }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { cleanMessageContent } from '@/utils/chatFormat'

const props = defineProps({
  message: { type: Object, required: true }
})

const displayContent = computed(() => cleanMessageContent(props.message.content))

const formattedTime = computed(() => {
  const date = new Date(props.message.created_at * 1000)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped>
.message {
  display: flex;
  margin-bottom: 0.375rem;
}

.message + .message {
  margin-top: 0.125rem;
}

.message--mine {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 75%;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  word-break: break-word;
}

.message--mine .message-bubble {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.message-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.message-time {
  display: block;
  font-size: 0.6875rem;
  opacity: 0.5;
  margin-top: 0.25rem;
  text-align: right;
}

.message--mine .message-time {
  opacity: 0.7;
}

@media (max-width: 480px) {
  .message-bubble {
    max-width: 85%;
  }
}
</style>
