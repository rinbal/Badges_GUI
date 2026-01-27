<template>
  <div class="surf-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1>Surf</h1>
      <p class="subtitle">Discover badges from across the Nostr network</p>
    </header>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <!-- Search -->
      <div class="search-wrapper">
        <div class="search-bar">
          <Icon name="search" size="md" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name..."
            class="search-input"
            @keyup.enter="performSearch"
          />
          <button
            v-if="searchQuery"
            class="clear-btn"
            @click="clearSearch"
            aria-label="Clear search"
          >
            <Icon name="x" size="sm" />
          </button>
        </div>
      </div>

      <!-- Sort & Filter Row -->
      <div class="filter-row">
        <!-- Sort Dropdown -->
        <div class="sort-control">
          <button
            class="sort-btn"
            @click="showSortMenu = !showSortMenu"
            :class="{ active: showSortMenu }"
          >
            <Icon :name="sortOptions[sortBy].icon" size="sm" />
            <span>{{ sortOptions[sortBy].label }}</span>
            <Icon name="chevron-down" size="sm" class="chevron" />
          </button>

          <Transition name="dropdown">
            <div v-if="showSortMenu" class="sort-dropdown" @click.stop>
              <button
                v-for="(option, key) in sortOptions"
                :key="key"
                class="sort-option"
                :class="{ selected: sortBy === key }"
                @click="selectSort(key)"
              >
                <Icon :name="option.icon" size="sm" />
                <span>{{ option.label }}</span>
                <Icon v-if="sortBy === key" name="check" size="sm" class="check-icon" />
              </button>
            </div>
          </Transition>
        </div>

        <!-- Filter Toggle: Hide Broken Images -->
        <label
          class="filter-toggle"
          title="Hides badges that don't have a working image - we consider them incomplete or broken"
        >
          <input type="checkbox" v-model="hideBrokenImages" />
          <span class="toggle-switch"></span>
          <span class="filter-label">
            <Icon name="photo-off" size="sm" />
            Hide broken
          </span>
        </label>

        <!-- User Search Toggle -->
        <button
          class="user-search-btn"
          :class="{ active: showUserSearch }"
          @click="showUserSearch = !showUserSearch"
        >
          <Icon name="user" size="sm" />
          <span>Find user</span>
        </button>
      </div>

      <!-- User Search (expandable) -->
      <Transition name="slide">
        <div v-if="showUserSearch" class="user-search-section">
          <UserSearchInput placeholder="npub, user@domain.com, or hex..." />
        </div>
      </Transition>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stats-left">
        <span v-if="isSearchMode" class="search-results-label">
          Search results
        </span>
      </div>
      <button
        class="refresh-btn"
        :disabled="isLoading"
        @click="refresh"
        aria-label="Refresh badges"
      >
        <Icon name="refresh" size="sm" :spin="isLoading" />
      </button>
    </div>

    <!-- Main Content -->
    <main class="content">
      <!-- Initial Loading -->
      <div v-if="isLoading && badges.length === 0" class="badge-grid">
        <BadgeCardSkeleton v-for="n in skeletonCount" :key="n" />
      </div>

      <!-- Empty State -->
      <div v-else-if="displayBadges.length === 0 && !isLoading" class="empty-state">
        <div class="empty-icon">
          <Icon :name="emptyStateIcon" size="xl" />
        </div>
        <h3>{{ emptyStateTitle }}</h3>
        <p>{{ emptyStateMessage }}</p>
        <button v-if="hasFiltersActive" class="reset-filters-btn" @click="resetFilters">
          Clear filters
        </button>
      </div>

      <!-- Badge Grid -->
      <div v-else class="badge-grid">
        <SurfBadgeCard
          v-for="badge in displayBadges"
          :key="badge.a_tag"
          :badge="badge"
          @click="openBadgeDetail(badge)"
          @image-error="handleBadgeImageError"
        />
      </div>

      <!-- Infinite Scroll Sentinel - always render when we have any badges loaded -->
      <div
        v-if="badges.length > 0"
        ref="sentinelRef"
        class="scroll-sentinel"
      >
        <div v-if="isLoadingMore" class="loading-more">
          <div class="spinner"></div>
          <span>Loading more...</span>
        </div>
        <div v-else-if="hasMore" class="load-more-section">
          <button class="load-more-btn" @click="loadBadges(true)" :disabled="isLoadingMore">
            Load more badges
          </button>
        </div>
        <div v-else class="end-of-list">
          <div class="end-line"></div>
          <span class="end-text">
            End of results
          </span>
          <div class="end-line"></div>
        </div>
      </div>
    </main>

    <!-- Click outside to close sort menu -->
    <div v-if="showSortMenu" class="backdrop" @click="showSortMenu = false"></div>
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

// =============================================================================
// Configuration - No magic numbers, named constants
// =============================================================================
const CONFIG = {
  BATCH_SIZE: 48,              // Badges per request - balance between UX and relay load
  SCROLL_THRESHOLD: 800,       // px from bottom to trigger next load (increased for better UX)
  SEARCH_DEBOUNCE: 300,        // ms to wait before searching
  SEARCH_MIN_CHARS: 1,         // Minimum characters to trigger search
  SKELETON_COUNT: 12           // Number of skeleton cards during initial load
}

// =============================================================================
// Sort Options
// =============================================================================
const sortOptions = {
  newest: { label: 'Newest', icon: 'clock' },
  popular: { label: 'Most Popular', icon: 'star' }
}

// =============================================================================
// State
// =============================================================================

// Core data
const badges = ref([])
const sortBy = ref('newest')
const cursor = ref(null)        // For 'newest': timestamp, for 'popular': offset
const hasMore = ref(true)

// Loading states
const isLoading = ref(false)
const isLoadingMore = ref(false)

// Search
const searchQuery = ref('')
const isSearchMode = ref(false)
const searchResults = ref([])

// Filters & UI
const hideBrokenImages = ref(true)  // Default: hide badges with broken image URLs
const brokenImageTags = ref(new Set())
const showSortMenu = ref(false)
const showUserSearch = ref(false)

// Refs
const sentinelRef = ref(null)
let observer = null
let searchTimeout = null

// =============================================================================
// Computed
// =============================================================================

const skeletonCount = computed(() => CONFIG.SKELETON_COUNT)

// Filter: only badges with images
const badgesWithImages = computed(() => {
  const source = isSearchMode.value ? searchResults.value : badges.value
  return source.filter(b => b.image || b.thumb)
})

// Filter: broken images
const displayBadges = computed(() => {
  let result = badgesWithImages.value
  if (hideBrokenImages.value && brokenImageTags.value.size > 0) {
    result = result.filter(b => !brokenImageTags.value.has(b.a_tag))
  }
  return result
})

// Only count user-activated filters (not default-on filters)
const hasFiltersActive = computed(() => {
  return isSearchMode.value || !hideBrokenImages.value
})

// Empty state content
const emptyStateIcon = computed(() => {
  if (isSearchMode.value) return 'search'
  if (hideBrokenImages.value && brokenImageTags.value.size > 0 && badgesWithImages.value.length > 0) return 'photo-off'
  return 'award'
})

const emptyStateTitle = computed(() => {
  if (isSearchMode.value) return 'No badges found'
  if (hideBrokenImages.value && brokenImageTags.value.size > 0 && badgesWithImages.value.length === brokenImageTags.value.size) {
    return 'All badges have broken images'
  }
  return 'No badges yet'
})

const emptyStateMessage = computed(() => {
  if (isSearchMode.value) return 'Try a different search term'
  if (hideBrokenImages.value && brokenImageTags.value.size > 0 && badgesWithImages.value.length === brokenImageTags.value.size) {
    return 'Try toggling "Hide broken" to see them anyway'
  }
  return 'Badges will appear here as they\'re published to Nostr'
})

// =============================================================================
// Methods
// =============================================================================

async function loadBadges(append = false) {
  if (isLoading.value || isLoadingMore.value) return
  if (append && !hasMore.value) return

  if (append) {
    isLoadingMore.value = true
  } else {
    isLoading.value = true
    cursor.value = null
    hasMore.value = true
  }

  try {
    let response
    let newBadges = []

    if (sortBy.value === 'newest') {
      // Use /surf/recent endpoint with cursor pagination (until = before this timestamp)
      const until = append ? cursor.value : null
      response = await api.getRecentBadges(CONFIG.BATCH_SIZE, until)
      newBadges = response.data.badges || []

      // Update cursor for next page - use oldest badge's timestamp
      if (newBadges.length > 0) {
        const oldest = newBadges[newBadges.length - 1]
        // Set cursor to 1 second before oldest to avoid duplicates
        cursor.value = oldest.created_at ? oldest.created_at - 1 : null
      }

      // Check if more available (fewer badges returned than requested = end of data)
      if (newBadges.length < CONFIG.BATCH_SIZE) {
        hasMore.value = false
      }
    } else {
      // Popular: use existing /surf/popular endpoint
      // Note: Backend limit is 50, no pagination support yet
      if (!append) {
        response = await api.getPopularBadges(50)
        newBadges = response.data.badges || []
        hasMore.value = false // No pagination for popular yet
      }
    }

    if (append) {
      // Deduplicate by a_tag
      const existingTags = new Set(badges.value.map(b => b.a_tag))
      const uniqueNew = newBadges.filter(b => !existingTags.has(b.a_tag))
      badges.value = [...badges.value, ...uniqueNew]
    } else {
      badges.value = newBadges
    }
  } catch (err) {
    console.error('Failed to load badges:', err)
    ui.showError('Failed to load badges')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

async function performSearch() {
  const query = searchQuery.value.trim()
  if (query.length < CONFIG.SEARCH_MIN_CHARS) return

  isLoading.value = true
  isSearchMode.value = true

  try {
    const response = await api.searchBadges(query, 100)
    searchResults.value = response.data.badges || []
  } catch (err) {
    console.error('Search failed:', err)
    ui.showError('Search failed')
  } finally {
    isLoading.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  isSearchMode.value = false
}

function selectSort(key) {
  if (sortBy.value !== key) {
    sortBy.value = key
    badges.value = []
    cursor.value = null
    hasMore.value = true
    brokenImageTags.value = new Set()  // Clear broken image tracking
    loadBadges()
  }
  showSortMenu.value = false
}

function refresh() {
  // Clear broken image tracking on refresh - images might be fixed
  brokenImageTags.value = new Set()

  if (isSearchMode.value) {
    performSearch()
  } else {
    loadBadges(false)
  }
}

function resetFilters() {
  hideBrokenImages.value = true  // Reset to default
  if (isSearchMode.value) {
    clearSearch()
  }
}

function openBadgeDetail(badge) {
  ui.openBadgeDetail(badge.a_tag, badge)
}

function handleBadgeImageError(aTag) {
  brokenImageTags.value.add(aTag)
  // Trigger Vue reactivity by creating a new Set
  brokenImageTags.value = new Set(brokenImageTags.value)
}

// =============================================================================
// Infinite Scroll
// =============================================================================

function setupObserver() {
  if (observer) observer.disconnect()

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (
        entry.isIntersecting &&
        hasMore.value &&
        !isLoadingMore.value &&
        !isLoading.value &&
        !isSearchMode.value
      ) {
        loadBadges(true)
      }
    },
    {
      rootMargin: `${CONFIG.SCROLL_THRESHOLD}px`,
      threshold: 0
    }
  )

  nextTick(() => {
    if (sentinelRef.value) {
      observer.observe(sentinelRef.value)
    }
  })
}

// =============================================================================
// Lifecycle
// =============================================================================

// Keyboard handlers
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (showSortMenu.value) {
      showSortMenu.value = false
    }
    if (showUserSearch.value) {
      showUserSearch.value = false
    }
    if (isSearchMode.value) {
      clearSearch()
    }
  }
}

onMounted(() => {
  loadBadges()
  setupObserver()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  if (searchTimeout) clearTimeout(searchTimeout)
  document.removeEventListener('keydown', handleKeydown)
})

// =============================================================================
// Watchers
// =============================================================================

// Debounced search
watch(searchQuery, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (!val.trim()) {
    isSearchMode.value = false
    searchResults.value = []
    return
  }

  if (val.length >= CONFIG.SEARCH_MIN_CHARS) {
    searchTimeout = setTimeout(() => {
      performSearch()
    }, CONFIG.SEARCH_DEBOUNCE)
  }
})

// Reconnect observer when badges change
watch(badges, () => {
  nextTick(setupObserver)
})
</script>

<style scoped>
/* =============================================================================
   Layout
   ============================================================================= */
.surf-page {
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

/* =============================================================================
   Page Header
   ============================================================================= */
.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
  background: linear-gradient(135deg, var(--color-text) 0%, var(--color-primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: var(--color-text-muted);
  margin: 0;
}

/* =============================================================================
   Controls Bar
   ============================================================================= */
.controls-bar {
  margin-bottom: 1.5rem;
}

.search-wrapper {
  max-width: 480px;
  margin: 0 auto 1rem;
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
}

.clear-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Filter Row */
.filter-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Sort Control */
.sort-control {
  position: relative;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  border-color: var(--color-primary);
}

.sort-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.sort-btn .chevron {
  transition: transform 0.2s ease;
}

.sort-btn.active .chevron {
  transform: rotate(180deg);
}

.sort-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.sort-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.sort-option:hover {
  background: var(--color-surface-hover);
}

.sort-option.selected {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.sort-option .check-icon {
  margin-left: auto;
}

/* Filter Toggle */
.filter-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.filter-toggle input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.filter-toggle input:checked + .toggle-switch {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.filter-toggle input:checked + .toggle-switch::after {
  left: 18px;
  background: white;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.filter-toggle:hover .filter-label {
  color: var(--color-text);
}

/* User Search Button */
.user-search-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-search-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.user-search-btn.active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* User Search Section */
.user-search-section {
  max-width: 400px;
  margin: 1rem auto 0;
}

/* =============================================================================
   Stats Bar
   ============================================================================= */
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.stats-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-results-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =============================================================================
   Badge Grid
   ============================================================================= */
.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
}

/* =============================================================================
   Empty State
   ============================================================================= */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
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
  margin: 0 0 1.5rem;
}

.reset-filters-btn {
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-filters-btn:hover {
  background: var(--color-primary-hover);
}

/* =============================================================================
   Infinite Scroll
   ============================================================================= */
.scroll-sentinel {
  margin-top: 2rem;
  padding: 1.5rem;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.load-more-section {
  display: flex;
  justify-content: center;
}

.load-more-btn {
  padding: 0.75rem 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.end-line {
  flex: 1;
  max-width: 100px;
  height: 1px;
  background: var(--color-border);
}

.end-text {
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
  white-space: nowrap;
}

/* =============================================================================
   Backdrop (for closing dropdown)
   ============================================================================= */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* =============================================================================
   Transitions
   ============================================================================= */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* =============================================================================
   Responsive
   ============================================================================= */
@media (max-width: 768px) {
  .page-header h1 {
    font-size: 1.75rem;
  }

  .filter-row {
    gap: 0.5rem;
  }

  .badge-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.875rem;
  }
}

@media (max-width: 480px) {
  .page-header h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
  }

  .filter-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .sort-btn {
    width: 100%;
    justify-content: center;
  }

  .sort-dropdown {
    width: 100%;
  }

  .filter-toggle,
  .user-search-btn {
    width: 100%;
    justify-content: center;
    padding: 0.625rem;
  }

  .badge-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .empty-state {
    padding: 3rem 1.5rem;
  }
}
</style>
