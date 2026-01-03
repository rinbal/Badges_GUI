<template>
  <div class="inbox-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1>My Badges</h1>
      <p class="subtitle">Manage pending badges and your collection</p>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button
        :class="['nav-tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        <span class="tab-icon">📬</span>
        <span class="tab-label">Pending</span>
        <span v-if="badgesStore.pendingCount > 0" class="tab-badge pending">
          {{ badgesStore.pendingCount }}
        </span>
      </button>

      <button
        :class="['nav-tab', { active: activeTab === 'collection' }]"
        @click="activeTab = 'collection'"
      >
        <span class="tab-icon">🏆</span>
        <span class="tab-label">Collection</span>
        <span v-if="badgesStore.acceptedCount > 0" class="tab-badge collection">
          {{ badgesStore.acceptedCount }}
        </span>
      </button>

      <!-- Refresh Button -->
      <button
        class="refresh-btn"
        :disabled="badgesStore.isLoading"
        @click="refreshBadges"
        title="Refresh badges"
      >
        <span :class="{ spinning: badgesStore.isLoading }">🔄</span>
      </button>
    </nav>

    <!-- Content Area -->
    <main class="content">
      <!-- ========================================
           PENDING TAB
           Badges awaiting acceptance
           ======================================== -->
      <section v-if="activeTab === 'pending'" class="tab-content animate-fadeIn">
        <!-- Loading State -->
        <div v-if="badgesStore.isLoading" class="pending-list">
          <PendingBadgeSkeleton v-for="n in 2" :key="n" />
        </div>

        <!-- Empty State -->
        <div v-else-if="badgesStore.pendingCount === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No pending badges</h3>
          <p>When someone awards you a badge, it will appear here for you to accept.</p>
          <router-link to="/creator" class="btn-primary">
            Create a Badge
          </router-link>
        </div>

        <!-- Pending Badges List -->
        <div v-else class="pending-list">
          <PendingBadgeCard
            v-for="badge in badgesStore.pendingBadges"
            :key="badge.award_event_id"
            :badge="badge"
            :loading="loadingBadgeId === badge.award_event_id"
            @accept="handleAccept"
            @view="openBadgeDetail"
          />
        </div>
      </section>

      <!-- ========================================
           COLLECTION TAB
           Accepted badges displayed in grid
           ======================================== -->
      <section v-else-if="activeTab === 'collection'" class="tab-content animate-fadeIn">
        <!-- Loading State -->
        <div v-if="badgesStore.isLoading" class="collection-grid">
          <CollectionBadgeSkeleton v-for="n in 6" :key="n" />
        </div>

        <!-- Empty State -->
        <div v-else-if="badgesStore.acceptedCount === 0" class="empty-state">
          <div class="empty-icon">🏅</div>
          <h3>Your collection is empty</h3>
          <p>Accept badges from the Pending tab to add them to your collection.</p>
          <button
            v-if="badgesStore.pendingCount > 0"
            class="btn-primary"
            @click="activeTab = 'pending'"
          >
            View {{ badgesStore.pendingCount }} Pending
          </button>
          <router-link v-else to="/creator" class="btn-primary">
            Create Your First Badge
          </router-link>
        </div>

        <!-- Collection Grid -->
        <div v-else class="collection-grid">
          <CollectionBadgeCard
            v-for="badge in badgesStore.acceptedBadges"
            :key="badge.award_event_id"
            :badge="badge"
            @click="openBadgeDetail(badge)"
          />
        </div>

        <!-- Collection Stats (shown when badges exist) -->
        <div v-if="badgesStore.acceptedCount > 0" class="collection-stats">
          <span class="stat-text">
            {{ badgesStore.acceptedCount }} badge{{ badgesStore.acceptedCount !== 1 ? 's' : '' }} in your collection
          </span>
        </div>
      </section>
    </main>

    <!-- ========================================
         BADGE DETAIL PANEL (Slide-over)
         Shows detailed badge info and actions
         ======================================== -->
    <BadgeDetailPanel
      :badge="selectedBadge"
      :is-open="showDetailPanel"
      :is-pending="selectedBadgeIsPending"
      :loading="loadingBadgeId === selectedBadge?.award_event_id"
      @close="closeDetailPanel"
      @accept="handleAcceptFromPanel"
      @remove="handleRemoveFromPanel"
    />
  </div>
</template>

<script setup>
/**
 * InboxView - Badge management page
 *
 * Displays two main sections:
 * 1. Pending - Badges awaiting user acceptance
 * 2. Collection - Accepted badges displayed in a grid
 *
 * Features:
 * - Responsive grid layout for collection
 * - Detail panel for viewing full badge info
 * - Loading skeletons for better UX
 * - Empty states with CTAs
 */

import { ref, onMounted } from 'vue'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'

// Components
import PendingBadgeCard from '@/components/badges/PendingBadgeCard.vue'
import PendingBadgeSkeleton from '@/components/badges/PendingBadgeSkeleton.vue'
import CollectionBadgeCard from '@/components/badges/CollectionBadgeCard.vue'
import CollectionBadgeSkeleton from '@/components/badges/CollectionBadgeSkeleton.vue'
import BadgeDetailPanel from '@/components/badges/BadgeDetailPanel.vue'

// Stores
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

// ===========================================
// State
// ===========================================

/** Active tab: 'pending' | 'collection' */
const activeTab = ref('pending')

/** Currently loading badge ID (for button states) */
const loadingBadgeId = ref(null)

/** Selected badge for detail panel */
const selectedBadge = ref(null)

/** Whether detail panel is visible */
const showDetailPanel = ref(false)

/** Whether selected badge is pending */
const selectedBadgeIsPending = ref(false)

// ===========================================
// Lifecycle
// ===========================================

onMounted(() => {
  refreshBadges()
})

// ===========================================
// Data Fetching
// ===========================================

/**
 * Refresh both pending and accepted badges
 */
async function refreshBadges() {
  await Promise.all([
    badgesStore.fetchPendingBadges(),
    badgesStore.fetchAcceptedBadges()
  ])
}

// ===========================================
// Detail Panel
// ===========================================

/**
 * Open the badge detail panel
 * @param {Object} badge - Badge to display
 * @param {boolean} isPending - Whether badge is pending
 */
function openBadgeDetail(badge, isPending = false) {
  selectedBadge.value = badge
  selectedBadgeIsPending.value = isPending
  showDetailPanel.value = true
}

/**
 * Close the detail panel
 */
function closeDetailPanel() {
  showDetailPanel.value = false
  // Delay clearing to allow animation
  setTimeout(() => {
    selectedBadge.value = null
  }, 300)
}

// ===========================================
// Badge Actions
// ===========================================

/**
 * Accept a pending badge
 * @param {Object} badge - Badge to accept
 */
async function handleAccept(badge) {
  loadingBadgeId.value = badge.award_event_id

  const result = await badgesStore.acceptBadge(badge.a_tag, badge.award_event_id)

  loadingBadgeId.value = null

  if (result.success) {
    uiStore.showSuccess(`"${badge.badge_name}" added to your collection`)
  } else {
    uiStore.showError(result.error || 'Could not accept badge. Please try again.')
  }
}

/**
 * Accept badge from detail panel
 */
async function handleAcceptFromPanel(badge) {
  await handleAccept(badge)
  if (loadingBadgeId.value === null) {
    closeDetailPanel()
  }
}

/**
 * Remove a badge from collection
 * @param {Object} badge - Badge to remove
 */
async function handleRemove(badge) {
  loadingBadgeId.value = badge.award_event_id

  const result = await badgesStore.removeBadge(badge.a_tag, badge.award_event_id)

  loadingBadgeId.value = null

  if (result.success) {
    uiStore.showInfo(`"${badge.badge_name}" removed from your collection`)
  } else {
    uiStore.showError(result.error || 'Could not remove badge. Please try again.')
  }
}

/**
 * Remove badge from detail panel (with confirmation)
 */
async function handleRemoveFromPanel(badge) {
  if (!confirm(`Remove "${badge.badge_name}" from your collection?\n\nYou can accept it again later.`)) {
    return
  }

  await handleRemove(badge)
  if (loadingBadgeId.value === null) {
    closeDetailPanel()
  }
}
</script>

<style scoped>
/* ===========================================
   Layout
   =========================================== */
.inbox-page {
  max-width: 1000px;
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
  font-size: 1rem;
}

.tab-badge {
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.nav-tab:not(.active) .tab-badge.pending {
  background: var(--color-warning);
  color: white;
}

.nav-tab:not(.active) .tab-badge.collection {
  background: var(--color-success);
  color: white;
}

.nav-tab.active .tab-badge {
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
  font-size: 1.125rem;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===========================================
   Tab Content
   =========================================== */
.tab-content {
  min-height: 300px;
}

.animate-fadeIn {
  animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===========================================
   Pending List
   =========================================== */
.pending-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ===========================================
   Collection Grid
   Responsive grid that scales from 1-4 columns
   =========================================== */
.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Larger cards on wider screens */
@media (min-width: 768px) {
  .collection-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }
}

/* ===========================================
   Collection Stats
   =========================================== */
.collection-stats {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.stat-text {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
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
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
}

.empty-state p {
  color: var(--color-text-muted);
  margin: 0 0 1.5rem;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 640px) {
  .nav-tabs {
    flex-wrap: wrap;
  }

  .nav-tab {
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }

  .tab-label {
    display: none;
  }

  .refresh-btn {
    width: 44px;
  }
}
</style>
