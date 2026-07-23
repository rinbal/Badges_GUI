<template>
  <form class="message-input" @submit.prevent="handleSend">
    <textarea
      ref="inputRef"
      v-model="text"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="1"
      class="input-field"
      @keydown.enter.exact.prevent="handleSend"
      @input="autoResize"
    />
    <button
      type="submit"
      class="send-btn"
      :disabled="disabled || !text.trim() || sending"
      :title="sending ? 'Sending...' : 'Send message'"
    >
      <Icon v-if="sending" name="loader" size="sm" :spin="true" />
      <Icon v-else name="send" size="sm" />
    </button>
  </form>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  placeholder: { type: String, default: 'Type a message...' },
  disabled: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  prefill: { type: String, default: '' }
})

const emit = defineEmits(['send'])

const text = ref('')
const inputRef = ref(null)

// When prefill changes, set the text and focus the input
watch(() => props.prefill, (val) => {
  if (val) {
    text.value = val
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
        // Place cursor at end
        inputRef.value.selectionStart = inputRef.value.selectionEnd = text.value.length
      }
    })
  }
})

function handleSend() {
  if (!text.value.trim()) return
  emit('send', text.value.trim())
  text.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })
}

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
</script>

<style scoped>
.message-input {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.input-field {
  flex: 1;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.4;
  resize: none;
  overflow-y: auto;
  max-height: 120px;
  transition: border-color var(--transition-fast);
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
}

.input-field::placeholder {
  color: var(--color-text-subtle);
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-normal);
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-glow);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
