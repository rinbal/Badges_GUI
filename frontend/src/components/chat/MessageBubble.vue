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
  margin-bottom: 0.5rem;
}

.message--mine {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 75%;
  padding: 0.625rem 0.875rem;
  border-radius: 1rem;
  background: var(--color-surface-hover);
  color: var(--color-text);
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

/* Tail-style rounding: flatten the corner closest to the sender */
.message:not(.message--mine) .message-bubble {
  border-bottom-left-radius: 0.25rem;
}

.message--mine .message-bubble {
  background: var(--color-primary);
  color: #fff;
  border-bottom-right-radius: 0.25rem;
}

.message-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  white-space: pre-wrap;
  letter-spacing: 0.01em;
}

.message-time {
  display: block;
  font-size: 0.6875rem;
  margin-top: 0.25rem;
  text-align: right;
  color: var(--color-text-muted);
}

.message--mine .message-time {
  color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 480px) {
  .message-bubble {
    max-width: 85%;
  }
}
</style>
