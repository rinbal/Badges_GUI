<template>
  <div class="surf-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1>Surf</h1>
      <p class="subtitle">Discover and collect badges from across Nostr</p>
    </header>

    <!-- Search Section -->
    <div class="search-section">
      <!-- Badge Search -->
      <div class="search-bar">
        <Icon name="search" size="md" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search badges by name..."
          class="search-input"
          @keyup.enter="performSearch"
        />
        <button
          v-if="searchQuery"
          class="clear-btn"
          @click="clearSearch"
        >
          <Icon name="x" size="sm" />
        </button>
      </div>

      <!-- User Search Toggle -->
      <div class="search-toggle">
        <button
          :class="['toggle-btn', { active: searchMode === 'badges' }]"
          @click="searchMode = 'badges'"
        >
          <Icon name="award" size="sm" />
          Badges
        </button>
        <button
          :class="['toggle-btn', { active: searchMode === 'users' }]"
          @click="searchMode = 'users'"
        >
          <Icon name="user" size="sm" />
          Users
        </button>
      </div>

      <!-- User Search Input (shown when user mode selected) -->
      <div v-if="searchMode === 'users'" class="user-search-wrapper">
        <UserSearchInput placeholder="Search user by npub..." />
      </div>
    </div>

    <!-- Filter Options -->
    <div class="filter-bar">
      <label class="filter-toggle">
        <input
          type="checkbox"
          v-model="multipleHoldersOnly"
        />
        <span class="toggle-switch"></span>
        <span class="filter-label">Multiple holders only</span>
      </label>
    </div>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button
        :class="['nav-tab', { active: activeTab === 'recent' }]"
        @click="setTab('recent')"
      >
        <Icon name="clock" size="md" class="tab-icon" />
        <span class="tab-label">Recent</span>
      </button>

      <button
        :class="['nav-tab', { active: activeTab === 'popular' }]"
        @click="setTab('popular')"
      >
        <Icon name="star" size="md" class="tab-icon" />
        <span class="tab-label">Popular</span>
      </button>

      <button
        v-if="searchResults.length > 0 || isSearching"
        :class="['nav-tab', { active: activeTab === 'search' }]"
        @click="activeTab = 'search'"
      >
        <Icon name="search" size="md" class="tab-icon" />
        <span class="tab-label">Results</span>
        <span v-if="searchResults.length > 0" class="tab-badge">
          {{ searchResults.length }}
        </span>
      </button>

      <!-- Refresh Button -->
      <button
        class="refresh-btn"
        :disabled="isLoading"
        @click="refresh"
        title="Refresh"
      >
        <Icon name="refresh" size="sm" :spin="isLoading" />
      </button>
    </nav>

    <!-- Content Area -->
    <main class="content">
      <!-- Loading State -->
      <div v-if="isLoading && currentBadges.length === 0" class="badge-grid">
        <BadgeCardSkeleton v-for="n in 8" :key="n" />
      </div>

      <!-- Empty State -->
      <div v-else-if="currentBadges.length === 0 && !isLoading" class="empty-state">
        <div class="empty-icon">
          <Icon :name="multipleHoldersOnly ? 'users' : 'search'" size="xl" />
        </div>
        <h3 v-if="multipleHoldersOnly && hasUnfilteredBadges">No badges with multiple holders</h3>
        <h3 v-else-if="activeTab === 'search'">No badges found</h3>
        <h3 v-else>No badges yet</h3>
        <p v-if="multipleHoldersOnly && hasUnfilteredBadges">
          Try disabling the filter to see all badges
        </p>
        <p v-else-if="activeTab === 'search'">
          Try a different search term or browse recent badges
        </p>
        <p v-else>
          Badge definitions will appear here once they're published to Nostr
        </p>
      </div>

      <!-- Badge Grid -->
      <div v-else class="badge-grid">
        <SurfBadgeCard
          v-for="badge in currentBadges"
          :key="badge.a_tag"
          :badge="badge"
          @click="openBadgeDetail(badge)"
        />
      </div>

      <!-- Infinite Scroll Sentinel -->
      <div
        v-if="currentBadges.length > 0"
        ref="sentinelRef"
        class="scroll-sentinel"
      >
        <div v-if="isLoadingMore" class="loading-more">
          <div class="spinner"></div>
          <span>Loading more badges...</span>
        </div>
        <div v-else-if="!hasMore && currentBadges.length > 0" class="end-of-list">
          <span class="results-count">
            {{ currentBadges.length }} badge{{ currentBadges.length !== 1 ? 's' : '' }} loaded
          </span>
          <span v-if="activeTab !== 'search'" class="end-message">You've reached the end</span>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { api } from '@/api/client'
import { useUIStore } from '@/stores/ui'
import Icon from '@/components/common/Icon.vue'
import SurfBadgeCard from '@/components/surf/SurfBadgeCard.vue'
import BadgeCardSkeleton from '@/components/surf/BadgeCardSkeleton.vue'
import UserSearchInput from '@/components/shared/UserSearchInput.vue'

const ui = useUIStore()

// Batch size for loading
const BATCH_SIZE = 24

// State
const activeTab = ref('recent')
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isSearching = ref(false)
const searchQuery = ref('')
const searchMode = ref('badges') // 'badges' or 'users'
const recentBadges = ref([])
const popularBadges = ref([])
const searchResults = ref([])

// Filter state
const multipleHoldersOnly = ref(false)

// Cursor-based pagination state (using created_at timestamp)
const recentCursor = ref(null)
const hasMoreRecent = ref(true)
// Popular doesn't paginate (curated list)
const hasMorePopular = ref(false)

// Intersection Observer
const sentinelRef = ref(null)
let observer = null

// Helper: filter badges that have images
function hasImage(badge) {
  return badge.image || badge.thumb
}

// Helper: filter badges with multiple holders
function hasMultipleHolders(badge) {
  return badge.holder_count && badge.holder_count > 1
}

// Computed
const currentBadges = computed(() => {
  let badges
  if (activeTab.value === 'search') {
    badges = searchResults.value
  } else if (activeTab.value === 'popular') {
    badges = popularBadges.value
  } else {
    badges = recentBadges.value
  }

  // Always filter out badges without images
  badges = badges.filter(hasImage)

  // Apply multiple holders filter if enabled
  if (multipleHoldersOnly.value) {
    badges = badges.filter(hasMultipleHolders)
  }

  return badges
})

const hasMore = computed(() => {
  if (activeTab.value === 'search') return false // Search doesn't paginate
  if (activeTab.value === 'popular') return hasMorePopular.value
  return hasMoreRecent.value
})

// Check if there are badges before user filters (for empty state messaging)
const hasUnfilteredBadges = computed(() => {
  let badges
  if (activeTab.value === 'search') {
    badges = searchResults.value
  } else if (activeTab.value === 'popular') {
    badges = popularBadges.value
  } else {
    badges = recentBadges.value
  }
  // Check if there are any badges with images
  return badges.filter(hasImage).length > 0
})

// Methods
async function loadRecentBadges(append = false) {
  if (!append) {
    isLoading.value = true
    recentCursor.value = null
    hasMoreRecent.value = true
  } else {
    isLoadingMore.value = true
  }

  try {
    // Use cursor (since) for pagination - get badges older than the last one
    const since = append ? recentCursor.value : null
    const response = await api.getRecentBadges(BATCH_SIZE, since)
    const badges = response.data.badges || []

    if (append) {
      // Filter out duplicates (just in case)
      const existingIds = new Set(recentBadges.value.map(b => b.a_tag))
      const newBadges = badges.filter(b => !existingIds.has(b.a_tag))
      recentBadges.value = [...recentBadges.value, ...newBadges]
    } else {
      recentBadges.value = badges
    }

    // Update cursor to the oldest badge's created_at for next page
    if (badges.length > 0) {
      const oldestBadge = badges[badges.length - 1]
      // Use created_at - 1 to get badges older than this one
      recentCursor.value = oldestBadge.created_at ? oldestBadge.created_at - 1 : null
    }

    // Check if there are more to load
    if (badges.length < BATCH_SIZE) {
      hasMoreRecent.value = false
    }
  } catch (err) {
    console.error('Failed to load recent badges:', err)
    ui.showError('Failed to load badges')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

async function loadPopularBadges() {
  isLoading.value = true

  try {
    // Popular badges - load a larger set at once (max 50 from API)
    const response = await api.getPopularBadges(50)
    popularBadges.value = response.data.badges || []
    hasMorePopular.value = false // No pagination for popular
  } catch (err) {
    console.error('Failed to load popular badges:', err)
    ui.showError('Failed to load popular badges')
  } finally {
    isLoading.value = false
  }
}

async function loadMore() {
  if (isLoadingMore.value || isLoading.value) return
  if (!hasMore.value) return

  if (activeTab.value === 'recent') {
    await loadRecentBadges(true)
  }
  // Popular doesn't paginate
}

async function performSearch() {
  if (!searchQuery.value.trim() || searchQuery.value.length < 2) {
    return
  }

  isSearching.value = true
  activeTab.value = 'search'

  try {
    // Search fetches all matching results (server-side limit)
    const response = await api.searchBadges(searchQuery.value.trim(), 100)
    searchResults.value = response.data.badges || []
  } catch (err) {
    console.error('Search failed:', err)
    ui.showError('Search failed')
  } finally {
    isSearching.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  if (activeTab.value === 'search') {
    activeTab.value = 'recent'
  }
}

function setTab(tab) {
  activeTab.value = tab
  if (tab === 'recent' && recentBadges.value.length === 0) {
    loadRecentBadges()
  } else if (tab === 'popular' && popularBadges.value.length === 0) {
    loadPopularBadges()
  }
}

function refresh() {
  if (activeTab.value === 'recent') {
    loadRecentBadges(false)
  } else if (activeTab.value === 'popular') {
    loadPopularBadges()
  } else if (activeTab.value === 'search' && searchQuery.value) {
    performSearch()
  }
}

function openBadgeDetail(badge) {
  ui.openBadgeDetail(badge.a_tag, badge)
}

// Setup Intersection Observer for infinite scroll
function setupObserver() {
  if (observer) observer.disconnect()

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && !isLoading.value) {
        loadMore()
      }
    },
    {
      rootMargin: '200px', // Start loading before reaching the bottom
      threshold: 0
    }
  )

  nextTick(() => {
    if (sentinelRef.value) {
      observer.observe(sentinelRef.value)
    }
  })
}

// Lifecycle
onMounted(() => {
  loadRecentBadges()
  setupObserver()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

// Watch for tab changes to reconnect observer
watch(activeTab, () => {
  nextTick(() => {
    setupObserver()
  })
})

// Watch for search input debounce
let searchTimeout = null
watch(searchQuery, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (val.length >= 2) {
    searchTimeout = setTimeout(() => {
      performSearch()
    }, 500)
  }
})
</script>

<style scoped>
/* ===========================================
   Layout
   =========================================== */
.surf-page {
  max-width: 1100px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

/* ===========================================
   Page Header
   =========================================== */
.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
}

.subtitle {
  color: var(--color-text-muted);
  margin: 0;
}

/* ===========================================
   Search Section
   =========================================== */
.search-section {
  max-width: 500px;
  margin: 0 auto 1.5rem;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.search-bar:focus-within {
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
  font-size: 1rem;
  color: var(--color-text);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.clear-btn {
  background: none;
  border: none;
  padding: 0.375rem;
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

/* Search Toggle */
.search-toggle {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  color: var(--color-text);
}

.toggle-btn.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.user-search-wrapper {
  margin-top: 0.75rem;
}

/* ===========================================
   Filter Bar
   =========================================== */
.filter-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  user-select: none;
}

.filter-toggle input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 11px;
  transition: all 0.2s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.filter-toggle input:checked + .toggle-switch {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.filter-toggle input:checked + .toggle-switch::after {
  left: 20px;
  background: white;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.filter-toggle:hover .filter-label {
  color: var(--color-text);
}

/* ===========================================
   Navigation Tabs
   =========================================== */
.nav-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0 0.5rem;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.nav-tab:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.nav-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.tab-icon {
  flex-shrink: 0;
}

.tab-badge {
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.25);
}

.refresh-btn {
  margin-left: auto;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text);
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===========================================
   Badge Grid
   =========================================== */
.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
}

/* ===========================================
   Empty State
   =========================================== */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--color-text-muted);
}

.empty-state h3 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
}

.empty-state p {
  color: var(--color-text-muted);
  margin: 0;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

/* ===========================================
   Infinite Scroll
   =========================================== */
.scroll-sentinel {
  margin-top: 2rem;
  padding: 1.5rem;
  text-align: center;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.end-of-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.results-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.end-message {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 640px) {
  .page-header h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
  }

  .nav-tabs {
    flex-wrap: wrap;
  }

  .nav-tab {
    flex: 1;
    min-width: 80px;
    justify-content: center;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
  }

  .tab-label {
    font-size: 0.8125rem;
  }

  .tab-icon {
    display: none;
  }

  .refresh-btn {
    width: 44px;
    min-width: 44px;
  }

  .badge-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
  }
}
</style>
