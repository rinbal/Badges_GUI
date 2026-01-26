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
        :disabled="!isValidInput"
        @click="handleSearch"
      >
        <IconArrowRight :size="16" />
      </button>
    </div>

    <!-- Recent Searches (optional) -->
    <div v-if="showRecent && isFocused && recentSearches.length > 0" class="recent-searches">
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

    <!-- Validation Hint -->
    <p v-if="searchValue && !isValidInput" class="hint-text">
      Enter a valid npub or hex public key
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import {
  IconSearch,
  IconX,
  IconArrowRight,
  IconHistory
} from '@tabler/icons-vue'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Search by npub or hex...'
  },
  showRecent: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['search'])

const ui = useUIStore()
const inputRef = ref(null)
const searchValue = ref('')
const isFocused = ref(false)
const recentSearches = ref([])

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

  return false
})

// Methods
function handleSearch() {
  if (!isValidInput.value) return

  const pubkey = searchValue.value.trim()

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

/* Hint */
.hint-text {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
