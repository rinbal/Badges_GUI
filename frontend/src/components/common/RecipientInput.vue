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
        <span class="tab-label">One Recipient</span>
      </button>
      <button
        :class="['tab', { active: mode === 'bulk' }]"
        @click="mode = 'bulk'"
        :disabled="disabled"
      >
        <span class="tab-icon">👥</span>
        <span class="tab-label">Multiple Recipients</span>
      </button>
    </div>

    <!-- Single Input -->
    <div v-if="mode === 'single'" class="input-single">
      <div class="input-wrapper">
        <input
          v-model="singleInput"
          type="text"
          placeholder="npub1..."
          :disabled="disabled"
          :class="{ 'input-valid': singleInputValid, 'input-invalid': singleInputInvalid, 'input-duplicate': singleInputDuplicate }"
          @input="onSingleInput"
          @keydown.enter.prevent="addSingle"
          maxlength="63"
        />
        <!-- Validation indicator -->
        <span v-if="singleInputValid && !singleInputDuplicate" class="validation-icon valid" title="Valid npub">&#10003;</span>
        <span v-else-if="singleInputDuplicate" class="validation-icon duplicate" title="Already added">!</span>
        <span v-else-if="singleInputInvalid" class="validation-icon invalid" title="Invalid format">&#10007;</span>
      </div>
      <!-- Character count and help -->
      <div class="input-meta">
        <span v-if="singleInput.length > 0" class="char-count" :class="{ complete: singleInput.length === 63 }">
          {{ singleInput.length }}/63
        </span>
        <a href="https://nostr.how/en/get-started#find-your-public-key" target="_blank" class="help-link" title="Learn about npub addresses">
          What's an npub?
        </a>
      </div>
      <button
        class="add-btn"
        :disabled="!isValidNpub(singleInput) || singleInputDuplicate || disabled"
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
      <!-- Bulk validation feedback -->
      <div v-if="bulkStats.total > 0" class="bulk-stats">
        <span v-if="bulkStats.valid > 0" class="stat valid">{{ bulkStats.valid }} valid</span>
        <span v-if="bulkStats.invalid > 0" class="stat invalid">{{ bulkStats.invalid }} invalid</span>
        <span v-if="bulkStats.duplicates > 0" class="stat duplicate">{{ bulkStats.duplicates }} duplicate{{ bulkStats.duplicates !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <!-- Duplicate Warning -->
    <div v-if="singleInputDuplicate" class="duplicate-warning">
      This address is already in your list
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
          <button class="remove-btn" @click="removeRecipient(index)" title="Remove" aria-label="Remove recipient">×</button>
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

// Get unique recipients (for duplicate detection)
const uniqueRecipients = computed(() => [...new Set(recipients.value)])

// Single input validation states
const singleInputValid = computed(() => {
  return singleInput.value.length > 0 && isValidNpub(singleInput.value)
})

const singleInputInvalid = computed(() => {
  const val = singleInput.value.trim()
  if (val.length === 0) return false
  // Show invalid if it has some content but isn't valid
  if (val.length >= 5 && !val.startsWith('npub1')) return true
  if (val.length === 63 && !isValidNpub(val)) return true
  return false
})

const singleInputDuplicate = computed(() => {
  if (!isValidNpub(singleInput.value)) return false
  return recipients.value.includes(singleInput.value.trim())
})

// Bulk input statistics
const bulkStats = computed(() => {
  const lines = props.modelValue
    .split(/[\n,]/)
    .map(r => r.trim())
    .filter(r => r.length > 0)

  const valid = lines.filter(r => isValidNpub(r))
  const invalid = lines.filter(r => !isValidNpub(r))
  const seen = new Set()
  let duplicates = 0

  for (const r of lines) {
    if (isValidNpub(r)) {
      if (seen.has(r)) {
        duplicates++
      } else {
        seen.add(r)
      }
    }
  }

  return {
    total: lines.length,
    valid: valid.length,
    invalid: invalid.length,
    duplicates
  }
})

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
  if (singleInputDuplicate.value) return

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
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
}

.input-wrapper {
  flex: 1;
  min-width: 200px;
  position: relative;
}

.input-single input {
  width: 100%;
  padding: 0.625rem 2rem 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-single input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.input-single input.input-valid {
  border-color: var(--color-success);
}

.input-single input.input-valid:focus {
  box-shadow: 0 0 0 2px var(--color-success-soft);
}

.input-single input.input-invalid {
  border-color: var(--color-danger);
}

.input-single input.input-invalid:focus {
  box-shadow: 0 0 0 2px var(--color-danger-soft);
}

.input-single input.input-duplicate {
  border-color: var(--color-warning);
}

.input-single input.input-duplicate:focus {
  box-shadow: 0 0 0 2px var(--color-warning-soft);
}

/* Validation Icon */
.validation-icon {
  position: absolute;
  right: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: bold;
}

.validation-icon.valid {
  color: var(--color-success);
}

.validation-icon.invalid {
  color: var(--color-danger);
}

.validation-icon.duplicate {
  color: var(--color-warning);
}

/* Input Meta (char count + help link) */
.input-meta {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.6875rem;
  order: 3;
}

.char-count {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.char-count.complete {
  color: var(--color-success);
}

.help-link {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.15s;
}

.help-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.add-btn {
  padding: 0.625rem 1rem;
  min-height: 38px;
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

/* Bulk Stats */
.bulk-stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
}

.bulk-stats .stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.bulk-stats .stat.valid {
  color: var(--color-success);
}

.bulk-stats .stat.invalid {
  color: var(--color-danger);
}

.bulk-stats .stat.duplicate {
  color: var(--color-warning);
}

/* Duplicate Warning */
.duplicate-warning {
  padding: 0.5rem 0.75rem;
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--color-warning);
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
  min-height: 28px;
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
  padding: 0.625rem 0.75rem;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.recipient-item:last-child {
  border-bottom: none;
}

.npub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Remove button - larger touch target */
.remove-btn {
  width: 28px;
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  cursor: pointer;
  font-size: 1.125rem;
  line-height: 1;
  transition: all 0.15s;
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

/* Mobile Responsive */
@media (max-width: 640px) {
  .tab-label {
    font-size: 0.75rem;
  }

  .input-single {
    flex-direction: column;
  }

  .input-wrapper {
    width: 100%;
  }

  .add-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    min-height: 44px;
  }

  .input-meta {
    order: 2;
    margin-top: 0.25rem;
  }

  .recipient-item {
    padding: 0.75rem;
  }

  /* Larger touch target on mobile */
  .remove-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    font-size: 1.25rem;
  }

  .list-items {
    max-height: 200px;
  }
}
</style>
