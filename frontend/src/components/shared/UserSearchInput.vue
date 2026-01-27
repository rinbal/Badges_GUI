<template>
  <div class="user-search">
    <div :class="['search-container', { focused: isFocused }]">
      <IconSearch :size="18" class="search-icon" />
      <input
        ref="inputRef"
        v-model="searchValue"
        type="text"
        :placeholder="placeholder"
        class="search-input"
        @focus="isFocused = true"
        @blur="handleBlur"
        @keyup.enter="handleSearch"
      />
      <button
        v-if="searchValue"
        class="clear-btn"
        @mousedown.prevent="clearSearch"
      >
        <IconX :size="14" />
      </button>
      <button
        class="search-btn"
        :disabled="!isValidInput || isResolving"
        @click="handleSearch"
      >
        <IconLoader2 v-if="isResolving" :size="16" class="spin" />
        <IconArrowRight v-else :size="16" />
      </button>
    </div>

    <!-- Recent Searches (optional) -->
    <div v-if="showRecent && isFocused && recentSearches.length > 0 && !searchValue && !isResolving" class="recent-searches">
      <span class="recent-label">Recent</span>
      <div
        v-for="recent in recentSearches"
        :key="recent"
        class="recent-item"
        @mousedown.prevent="selectRecent(recent)"
      >
        <IconHistory :size="14" />
        <span>{{ shortKey(recent) }}</span>
      </div>
    </div>

    <!-- Input Detection Preview -->
    <div v-if="searchValue && isValidInput && !isResolving" class="detection-preview" :class="detectedType">
      <span class="detection-type">
        <IconCheck :size="12" />
        {{ detectedTypeLabel }}
      </span>
      <span class="detection-hint">
        <span class="auto-search-indicator"></span>
        Looking up...
      </span>
    </div>

    <!-- Validation Hint -->
    <p v-if="searchValue && !isValidInput && !isResolving" class="hint-text">
      Enter npub, NIP-05 (user@domain.com), or hex pubkey
    </p>

    <!-- Resolve Error -->
    <p v-if="resolveError" class="error-text">
      {{ resolveError }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import {
  IconSearch,
  IconX,
  IconArrowRight,
  IconHistory,
  IconLoader2,
  IconCheck
} from '@tabler/icons-vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'npub, user@domain.com, or hex...'
  },
  showRecent: {
    type: Boolean,
    default: true
  },
  autoSearch: {
    type: Boolean,
    default: true
  },
  autoSearchDelay: {
    type: Number,
    default: 800  // ms delay before auto-searching
  }
})

const emit = defineEmits(['search'])

const ui = useUIStore()
const inputRef = ref(null)
const searchValue = ref('')
const isFocused = ref(false)
const recentSearches = ref([])
const isResolving = ref(false)
const resolveError = ref('')
let autoSearchTimeout = null

// Storage key for recent searches
const STORAGE_KEY = 'badges_recent_user_searches'

// Load recent searches from localStorage
onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      recentSearches.value = JSON.parse(stored).slice(0, 5)
    }
  } catch (e) {
    console.error('Failed to load recent searches:', e)
  }
})

onUnmounted(() => {
  if (autoSearchTimeout) clearTimeout(autoSearchTimeout)
})

// Check if value looks like a NIP-05 identifier (name@domain.com)
function isNip05Format(val) {
  // Must contain @ and have something before and after
  // Domain must have at least one dot
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)
}

// Resolve NIP-05 identifier to pubkey
async function resolveNip05(identifier) {
  const [name, domain] = identifier.split('@')
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch')

    const data = await response.json()
    const pubkey = data.names?.[name] || data.names?.[name.toLowerCase()]

    if (!pubkey) throw new Error('Name not found')
    return pubkey
  } catch (err) {
    throw new Error(`Could not resolve ${identifier}`)
  }
}

// Computed
const isValidInput = computed(() => {
  const val = searchValue.value.trim()
  if (!val) return false

  // Check for npub format
  if (val.startsWith('npub1') && val.length === 63) {
    return true
  }

  // Check for hex format (64 chars)
  if (/^[a-f0-9]{64}$/i.test(val)) {
    return true
  }

  // Check for NIP-05 format (name@domain.com)
  if (isNip05Format(val)) {
    return true
  }

  return false
})

// Detect input type for preview
const detectedType = computed(() => {
  const val = searchValue.value.trim()
  if (!val) return null
  if (val.startsWith('npub1') && val.length === 63) return 'npub'
  if (/^[a-f0-9]{64}$/i.test(val)) return 'hex'
  if (isNip05Format(val)) return 'nip05'
  return null
})

const detectedTypeLabel = computed(() => {
  switch (detectedType.value) {
    case 'npub': return 'npub detected'
    case 'hex': return 'Hex pubkey detected'
    case 'nip05': return 'NIP-05 detected'
    default: return ''
  }
})

// Auto-search watcher
watch(isValidInput, (valid) => {
  if (autoSearchTimeout) clearTimeout(autoSearchTimeout)
  resolveError.value = ''

  if (valid && props.autoSearch) {
    autoSearchTimeout = setTimeout(() => {
      handleSearch()
    }, props.autoSearchDelay)
  }
})

// Methods
async function handleSearch() {
  if (!isValidInput.value || isResolving.value) return

  let pubkey = searchValue.value.trim()
  resolveError.value = ''

  // If it's a NIP-05 identifier, resolve it first
  if (isNip05Format(pubkey)) {
    isResolving.value = true
    try {
      pubkey = await resolveNip05(pubkey)
    } catch (err) {
      resolveError.value = err.message
      isResolving.value = false
      return
    }
    isResolving.value = false
  }

  // Save to recent searches
  saveToRecent(pubkey)

  // Emit and open lookup
  emit('search', pubkey)
  ui.openLookupUser(pubkey)

  // Clear and blur
  searchValue.value = ''
  inputRef.value?.blur()
}

function handleBlur() {
  // Delay to allow button clicks
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

function clearSearch() {
  searchValue.value = ''
  inputRef.value?.focus()
}

function selectRecent(pubkey) {
  searchValue.value = pubkey
  handleSearch()
}

function saveToRecent(pubkey) {
  // Remove if already exists
  recentSearches.value = recentSearches.value.filter(r => r !== pubkey)

  // Add to front
  recentSearches.value.unshift(pubkey)

  // Keep only last 5
  recentSearches.value = recentSearches.value.slice(0, 5)

  // Save to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches.value))
  } catch (e) {
    console.error('Failed to save recent searches:', e)
  }
}

function shortKey(pubkey) {
  if (pubkey.startsWith('npub')) {
    return `${pubkey.slice(0, 10)}...${pubkey.slice(-6)}`
  }
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-6)}`
}
</script>

<style scoped>
.user-search {
  position: relative;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.search-container.focused {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.search-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--color-text);
  outline: none;
  font-family: var(--font-mono);
  min-width: 0;
}

.search-input::placeholder {
  font-family: var(--font-sans);
  color: var(--color-text-muted);
}

.clear-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

.search-btn {
  background: var(--color-primary);
  border: none;
  padding: 0.375rem;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Recent Searches */
.recent-searches {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 10;
}

.recent-label {
  display: block;
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s ease;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.recent-item:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Detection Preview */
.detection-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-success-soft, rgba(34, 197, 94, 0.1));
  border: 1px solid var(--color-success, #22c55e);
  border-radius: var(--radius-md);
}

.detection-preview.nip05 {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
}

.detection-preview.nip05 .detection-type {
  color: var(--color-primary);
}

.detection-type {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-success, #22c55e);
}

.detection-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.auto-search-indicator {
  width: 10px;
  height: 10px;
  border: 2px solid var(--color-text-muted);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Hint */
.hint-text {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Error */
.error-text {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-error, #ef4444);
}

/* Loading spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
