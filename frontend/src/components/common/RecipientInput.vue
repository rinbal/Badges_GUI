<template>
  <div class="recipient-input" :class="{ disabled }">
    <!-- Input Mode Tabs -->
    <div class="input-tabs">
      <button
        :class="['tab', { active: mode === 'single' }]"
        @click="mode = 'single'"
        :disabled="disabled"
      >
        <span class="tab-icon">👤</span>
        <span class="tab-label">Single</span>
      </button>
      <button
        :class="['tab', { active: mode === 'bulk' }]"
        @click="mode = 'bulk'"
        :disabled="disabled"
      >
        <span class="tab-icon">👥</span>
        <span class="tab-label">Multiple</span>
      </button>
    </div>

    <!-- Single Input -->
    <div v-if="mode === 'single'" class="input-single">
      <input
        v-model="singleInput"
        type="text"
        placeholder="npub1..."
        :disabled="disabled"
        @input="onSingleInput"
        @keydown.enter.prevent="addSingle"
      />
      <button
        class="add-btn"
        :disabled="!isValidNpub(singleInput) || disabled"
        @click="addSingle"
      >
        Add
      </button>
    </div>

    <!-- Bulk Input -->
    <div v-else class="input-bulk">
      <textarea
        :value="modelValue"
        placeholder="Paste npub addresses here...

One per line or comma-separated:
npub1abc123...
npub1xyz789..."
        :disabled="disabled"
        rows="4"
        @input="$emit('update:modelValue', $event.target.value)"
      ></textarea>
    </div>

    <!-- Recipients List -->
    <div v-if="recipients.length > 0" class="recipients-list">
      <div class="list-header">
        <span class="list-count">{{ recipients.length }} recipient{{ recipients.length !== 1 ? 's' : '' }}</span>
        <button v-if="recipients.length > 0" class="clear-all" @click="clearAll">Clear all</button>
      </div>
      <div class="list-items">
        <div v-for="(npub, index) in recipients" :key="index" class="recipient-item">
          <span class="npub">{{ formatNpub(npub) }}</span>
          <button class="remove-btn" @click="removeRecipient(index)" title="Remove">×</button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-hint">
      <span class="hint-icon">💡</span>
      <span class="hint-text">
        {{ mode === 'single' ? 'Enter an npub address and click Add' : 'Paste one or more npub addresses' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  count: {
    type: Number,
    default: 0
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const mode = ref('single')
const singleInput = ref('')

const recipients = computed(() =>
  props.modelValue
    .split(/[\n,]/)
    .map(r => r.trim())
    .filter(r => isValidNpub(r))
)

function isValidNpub(value) {
  // Valid npub format: starts with "npub1" and is 63 characters
  return value && value.startsWith('npub1') && value.length === 63
}

function formatNpub(npub) {
  if (npub.length <= 20) return npub
  return `${npub.slice(0, 12)}...${npub.slice(-6)}`
}

function onSingleInput() {
  // Auto-detect if user pasted multiple npubs
  if (singleInput.value.includes('\n') || singleInput.value.includes(',')) {
    const current = props.modelValue ? props.modelValue + '\n' : ''
    emit('update:modelValue', current + singleInput.value)
    singleInput.value = ''
    mode.value = 'bulk'
  }
}

function addSingle() {
  if (!isValidNpub(singleInput.value)) return

  const current = props.modelValue ? props.modelValue + '\n' : ''
  emit('update:modelValue', current + singleInput.value.trim())
  singleInput.value = ''
}

function removeRecipient(index) {
  const list = props.modelValue.split(/[\n,]/).map(r => r.trim()).filter(Boolean)
  list.splice(index, 1)
  emit('update:modelValue', list.join('\n'))
}

function clearAll() {
  emit('update:modelValue', '')
  singleInput.value = ''
}
</script>

<style scoped>
.recipient-input {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recipient-input.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Tabs */
.input-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  transition: all 0.15s;
}

.tab:hover:not(:disabled) {
  border-color: var(--color-primary-soft);
  color: var(--color-text);
}

.tab.active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-text);
}

.tab:disabled {
  cursor: not-allowed;
}

.tab-icon {
  font-size: 0.875rem;
}

.tab-label {
  font-weight: 500;
}

/* Single Input */
.input-single {
  display: flex;
  gap: 0.5rem;
}

.input-single input {
  flex: 1;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
}

.input-single input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.add-btn {
  padding: 0 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.add-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Bulk Input */
.input-bulk textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  resize: vertical;
  min-height: 100px;
}

.input-bulk textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.input-bulk textarea::placeholder {
  color: var(--color-text-subtle);
}

/* Recipients List */
.recipients-list {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.list-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-success);
}

.clear-all {
  background: none;
  border: none;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.clear-all:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.list-items {
  max-height: 140px;
  overflow-y: auto;
}

.recipient-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.recipient-item:last-child {
  border-bottom: none;
}

.npub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.remove-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.remove-btn:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Empty Hint */
.empty-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.hint-icon {
  font-size: 1rem;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
