<template>
  <div class="postbox-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1>Badge Requests</h1>
      <p class="subtitle">Manage incoming badge requests and track your sent requests</p>
    </header>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button
        :class="['nav-tab', { active: activeTab === 'incoming' }]"
        @click="activeTab = 'incoming'"
      >
        <Icon name="inbox" size="md" class="tab-icon" />
        <span class="tab-label">Incoming</span>
        <span v-if="requestsStore.pendingCount > 0" class="tab-badge incoming">
          {{ requestsStore.pendingCount }}
        </span>
      </button>

      <button
        :class="['nav-tab', { active: activeTab === 'outgoing' }]"
        @click="activeTab = 'outgoing'"
      >
        <Icon name="send" size="md" class="tab-icon" />
        <span class="tab-label">Sent</span>
        <span v-if="outgoingPendingCount > 0" class="tab-badge outgoing">
          {{ outgoingPendingCount }}
        </span>
      </button>

      <!-- Refresh Button -->
      <button
        class="refresh-btn"
        :disabled="requestsStore.isLoading"
        @click="refreshRequests"
        title="Refresh requests"
      >
        <Icon name="refresh" size="sm" :spin="requestsStore.isLoading" />
      </button>
    </nav>

    <!-- Content Area -->
    <main class="content">
      <!-- ========================================
           INCOMING TAB
           Requests for your badges
           ======================================== -->
      <section v-if="activeTab === 'incoming'" class="tab-content animate-fadeIn">
        <!-- Loading State -->
        <div v-if="requestsStore.isLoading && requestsStore.incomingRequests.length === 0" class="requests-list">
          <RequestCardSkeleton v-for="n in 3" :key="n" />
        </div>

        <!-- Empty State -->
        <div v-else-if="requestsStore.incomingRequests.length === 0" class="empty-state">
          <div class="empty-icon">
            <Icon name="inbox" size="xl" />
          </div>
          <h3>No incoming requests</h3>
          <p>When someone requests one of your badges, it will appear here for you to review.</p>
          <div class="empty-hint">
            <Icon name="info" size="sm" class="hint-icon" />
            <span>Create badges in the Creator to start receiving requests!</span>
          </div>
          <router-link to="/creator" class="btn-primary">
            <Icon name="sparkles" size="sm" />
            <span>Create a Badge</span>
          </router-link>
        </div>

        <!-- Requests List -->
        <template v-else>
          <!-- Filter Tabs -->
          <div class="filter-tabs">
            <button
              v-for="filter in incomingFilters"
              :key="filter.value"
              :class="['filter-tab', { active: incomingFilter === filter.value }]"
              @click="incomingFilter = filter.value"
            >
              {{ filter.label }}
              <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
            </button>
          </div>

          <div class="requests-list">
            <IncomingRequestCard
              v-for="request in filteredIncoming"
              :key="request.event_id"
              :request="request"
              :loading="loadingRequestId === request.event_id"
              @award="handleAward"
              @deny="handleDeny"
              @view-requester="viewRequester"
              @view-badge="viewBadge"
            />
          </div>

          <div v-if="filteredIncoming.length === 0" class="no-results">
            <p>No {{ incomingFilter }} requests</p>
          </div>
        </template>
      </section>

      <!-- ========================================
           OUTGOING TAB
           Requests you've sent
           ======================================== -->
      <section v-else-if="activeTab === 'outgoing'" class="tab-content animate-fadeIn">
        <!-- Loading State -->
        <div v-if="requestsStore.isLoading && requestsStore.outgoingRequests.length === 0" class="requests-list">
          <RequestCardSkeleton v-for="n in 3" :key="n" />
        </div>

        <!-- Empty State -->
        <div v-else-if="requestsStore.outgoingRequests.length === 0" class="empty-state">
          <div class="empty-icon">
            <Icon name="send" size="xl" />
          </div>
          <h3>No sent requests</h3>
          <p>Badge requests you send to other issuers will appear here so you can track their status.</p>
          <div class="empty-hint">
            <Icon name="info" size="sm" class="hint-icon" />
            <span>Browse badges and request ones you'd like to earn!</span>
          </div>
        </div>

        <!-- Requests List -->
        <template v-else>
          <!-- Filter Tabs -->
          <div class="filter-tabs">
            <button
              v-for="filter in outgoingFilters"
              :key="filter.value"
              :class="['filter-tab', { active: outgoingFilter === filter.value }]"
              @click="outgoingFilter = filter.value"
            >
              {{ filter.label }}
              <span v-if="filter.count > 0" class="filter-count">{{ filter.count }}</span>
            </button>
          </div>

          <div class="requests-list">
            <OutgoingRequestCard
              v-for="request in filteredOutgoing"
              :key="request.event_id"
              :request="request"
              :loading="loadingRequestId === request.event_id"
              @withdraw="handleWithdraw"
              @view-badge="viewBadge"
            />
          </div>

          <div v-if="filteredOutgoing.length === 0" class="no-results">
            <p>No {{ outgoingFilter }} requests</p>
          </div>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRequestsStore } from '@/stores/requests'
import { useUIStore } from '@/stores/ui'
import Icon from '@/components/common/Icon.vue'
import IncomingRequestCard from '@/components/requests/IncomingRequestCard.vue'
import OutgoingRequestCard from '@/components/requests/OutgoingRequestCard.vue'
import RequestCardSkeleton from '@/components/requests/RequestCardSkeleton.vue'

const requestsStore = useRequestsStore()
const uiStore = useUIStore()

// ===========================================
// State
// ===========================================

const activeTab = ref('incoming')
const incomingFilter = ref('all')
const outgoingFilter = ref('all')
const loadingRequestId = ref(null)

// ===========================================
// Computed
// ===========================================

const outgoingPendingCount = computed(() =>
  requestsStore.outgoingRequests.filter(r => r.state === 'pending').length
)

const incomingFilters = computed(() => [
  { value: 'all', label: 'All', count: requestsStore.incomingRequests.length },
  { value: 'pending', label: 'Pending', count: requestsStore.incomingByState.pending.length },
  { value: 'fulfilled', label: 'Awarded', count: requestsStore.incomingByState.fulfilled.length },
  { value: 'denied', label: 'Denied', count: requestsStore.incomingByState.denied.length }
])

const outgoingFilters = computed(() => [
  { value: 'all', label: 'All', count: requestsStore.outgoingRequests.length },
  { value: 'pending', label: 'Pending', count: requestsStore.outgoingByState.pending.length },
  { value: 'fulfilled', label: 'Awarded', count: requestsStore.outgoingByState.fulfilled.length },
  { value: 'denied', label: 'Denied', count: requestsStore.outgoingByState.denied.length },
  { value: 'withdrawn', label: 'Withdrawn', count: requestsStore.outgoingByState.withdrawn.length }
])

const filteredIncoming = computed(() => {
  if (incomingFilter.value === 'all') {
    return requestsStore.incomingRequests
  }
  return requestsStore.incomingByState[incomingFilter.value] || []
})

const filteredOutgoing = computed(() => {
  if (outgoingFilter.value === 'all') {
    return requestsStore.outgoingRequests
  }
  return requestsStore.outgoingByState[outgoingFilter.value] || []
})

// ===========================================
// Lifecycle
// ===========================================

onMounted(() => {
  refreshRequests()
})

// ===========================================
// Data Fetching
// ===========================================

async function refreshRequests() {
  await requestsStore.fetchAll()
}

// ===========================================
// Request Actions
// ===========================================

async function handleAward(request) {
  loadingRequestId.value = request.event_id

  const result = await requestsStore.awardFromRequest(
    request.event_id,
    request.badge_a_tag,
    request.requester_pubkey
  )

  loadingRequestId.value = null

  if (result.success) {
    uiStore.showSuccess(`Badge awarded to ${request.requester_profile?.name || 'user'}`)
  } else {
    uiStore.showError(result.error || 'Failed to award badge')
  }
}

function handleDeny(request) {
  uiStore.openDenyRequest(request)
}

async function handleWithdraw(request) {
  if (!confirm('Withdraw this badge request?\n\nYou can submit a new request later.')) {
    return
  }

  loadingRequestId.value = request.event_id

  const result = await requestsStore.withdrawRequest(request.badge_a_tag)

  loadingRequestId.value = null

  if (result.success) {
    uiStore.showInfo('Request withdrawn')
  } else {
    uiStore.showError(result.error || 'Failed to withdraw request')
  }
}

// ===========================================
// Navigation
// ===========================================

function viewRequester(request) {
  uiStore.openLookupUser(request.requester_pubkey)
}

function viewBadge(request) {
  uiStore.openBadgeDetail(request.badge_a_tag, {
    name: request.badge_name,
    image: request.badge_image,
    description: request.badge_description,
    identifier: request.badge_identifier,
    issuer_pubkey: request.issuer_pubkey
  })
}
</script>

<style scoped>
/* ===========================================
   Layout
   =========================================== */
.postbox-page {
  max-width: 900px;
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
  flex-shrink: 0;
}

.tab-badge {
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.nav-tab:not(.active) .tab-badge.incoming {
  background: var(--color-warning);
  color: white;
}

.nav-tab:not(.active) .tab-badge.outgoing {
  background: var(--color-info);
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
   Filter Tabs
   =========================================== */
.filter-tabs {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.filter-tab.active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.filter-count {
  font-size: 0.6875rem;
  padding: 0.0625rem 0.375rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
}

.filter-tab.active .filter-count {
  background: var(--color-primary);
  color: white;
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
   Requests List
   =========================================== */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.no-results {
  text-align: center;
  padding: 3rem 1rem;
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
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.empty-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  text-align: left;
  max-width: 340px;
  margin-left: auto;
  margin-right: auto;
}

.empty-hint .hint-icon {
  flex-shrink: 0;
  color: var(--color-info);
  margin-top: 0.125rem;
}

.empty-hint span {
  font-size: 0.8125rem;
  color: var(--color-text);
  line-height: 1.4;
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
    min-width: 100px;
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

  .filter-tabs {
    gap: 0.25rem;
  }

  .filter-tab {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }

  .empty-state {
    padding: 2.5rem 1.5rem;
  }
}
</style>
