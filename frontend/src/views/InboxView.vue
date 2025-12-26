<template>
  <div class="inbox">
    <header class="page-header">
      <div class="header-top">
        <div class="header-text">
          <h1>📬 Badge Inbox</h1>
          <p>Manage your received badges</p>
        </div>
        <button 
          @click="refreshBadges"
          class="refresh-btn"
          :disabled="badgesStore.isLoading"
          title="Refresh"
        >
          <span :class="['refresh-icon', { spinning: badgesStore.isLoading }]">🔄</span>
        </button>
      </div>
    </header>
    
    <!-- Tabs -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        <span class="tab-icon">⏳</span>
        <span class="tab-text">Pending Badges</span>
        <span v-if="badgesStore.pendingCount > 0" class="tab-count">
          {{ badgesStore.pendingCount }}
        </span>
      </button>
      <button 
        :class="['tab', { active: activeTab === 'accepted' }]"
        @click="activeTab = 'accepted'"
      >
        <span class="tab-icon">✓</span>
        <span class="tab-text">Accepted Badges</span>
        <span v-if="badgesStore.acceptedCount > 0" class="tab-count accepted">
          {{ badgesStore.acceptedCount }}
        </span>
      </button>
    </div>
    
    <!-- Content -->
    <div class="inbox-content">
      <!-- Loading State with Skeletons -->
      <div v-if="badgesStore.isLoading" class="badge-list">
        <BadgeCardSkeleton v-for="n in 3" :key="n" />
      </div>
      
      <!-- Pending Tab -->
      <template v-else-if="activeTab === 'pending'">
        <div v-if="badgesStore.pendingBadges.length === 0" class="empty-state">
          <div class="empty-illustration">📭</div>
          <h3>No pending badges</h3>
          <p>
            When someone awards you a badge, it will appear here 
            for you to accept.
          </p>
          <div class="empty-cta">
            <router-link to="/creator" class="btn btn-primary">
              ✨ Create a badge yourself
            </router-link>
            <p class="cta-hint">Award badges to others on Nostr</p>
          </div>
        </div>
        <div v-else class="badge-list">
          <BadgeCard
            v-for="badge in badgesStore.pendingBadges"
            :key="badge.award_event_id"
            :badge="badge"
            :is-pending="true"
            :loading="loadingBadge === badge.award_event_id"
            @click="openBadgeDetail(badge, true)"
            @accept="handleAccept"
          />
        </div>
      </template>
      
      <!-- Accepted Tab -->
      <template v-else>
        <div v-if="badgesStore.acceptedBadges.length === 0" class="empty-state">
          <div class="empty-illustration">🏅</div>
          <h3>No badges in your collection</h3>
          <p>
            Accept pending badges to add them here. They'll be 
            visible on your Nostr profile.
          </p>
          <div class="empty-cta">
            <button 
              v-if="badgesStore.pendingCount > 0"
              @click="activeTab = 'pending'" 
              class="btn btn-primary"
            >
              📬 View {{ badgesStore.pendingCount }} pending badge{{ badgesStore.pendingCount > 1 ? 's' : '' }}
            </button>
            <router-link v-else to="/creator" class="btn btn-primary">
              ✨ Create your first badge
            </router-link>
            <p class="cta-hint">
              {{ badgesStore.pendingCount > 0 
                ? 'Accept badges to display them on your profile' 
                : 'Start by creating badges for your community' 
              }}
            </p>
          </div>
        </div>
        <div v-else class="badge-list">
          <BadgeCard
            v-for="badge in badgesStore.acceptedBadges"
            :key="badge.award_event_id"
            :badge="badge"
            :is-pending="false"
            :loading="loadingBadge === badge.award_event_id"
            @click="openBadgeDetail(badge, false)"
            @remove="handleRemove"
          />
        </div>
      </template>
    </div>
    
    <!-- Badge Detail Modal -->
    <BadgeDetailModal
      :is-open="showDetailModal"
      :badge="selectedBadge"
      :is-pending="selectedBadgeIsPending"
      :loading="loadingBadge === selectedBadge?.award_event_id"
      @close="closeDetailModal"
      @accept="handleAcceptFromModal"
      @remove="handleRemoveFromModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import BadgeCard from '@/components/badges/BadgeCard.vue'
import BadgeCardSkeleton from '@/components/badges/BadgeCardSkeleton.vue'
import BadgeDetailModal from '@/components/badges/BadgeDetailModal.vue'

const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const activeTab = ref('pending')
const loadingBadge = ref(null)

// Modal state
const showDetailModal = ref(false)
const selectedBadge = ref(null)
const selectedBadgeIsPending = ref(false)

onMounted(() => {
  refreshBadges()
})

async function refreshBadges() {
  await Promise.all([
    badgesStore.fetchPendingBadges(),
    badgesStore.fetchAcceptedBadges()
  ])
}

function openBadgeDetail(badge, isPending) {
  selectedBadge.value = badge
  selectedBadgeIsPending.value = isPending
  showDetailModal.value = true
}

function closeDetailModal() {
  showDetailModal.value = false
  selectedBadge.value = null
}

async function handleAccept(badge) {
  loadingBadge.value = badge.award_event_id
  
  const result = await badgesStore.acceptBadge(badge.a_tag, badge.award_event_id)
  
  loadingBadge.value = null
  
  if (result.success) {
    uiStore.showSuccess(`Great! "${badge.badge_name}" is now part of your collection 🎉`)
  } else {
    uiStore.showError(result.error || "Something went wrong. Please try again in a moment.")
  }
}

async function handleAcceptFromModal(badge) {
  await handleAccept(badge)
  if (loadingBadge.value === null) {
    closeDetailModal()
  }
}

async function handleRemove(badge) {
  if (!confirm(`Remove "${badge.badge_name}" from your profile?\n\nYou can always accept it again later if you change your mind.`)) {
    return
  }
  
  loadingBadge.value = badge.award_event_id
  
  const result = await badgesStore.removeBadge(badge.a_tag, badge.award_event_id)
  
  loadingBadge.value = null
  
  if (result.success) {
    uiStore.showInfo(`"${badge.badge_name}" has been removed from your profile`)
  } else {
    uiStore.showError(result.error || "Couldn't remove the badge right now. Please try again.")
  }
}

async function handleRemoveFromModal(badge) {
  if (!confirm(`Remove "${badge.badge_name}" from your profile?\n\nYou can always accept it again later if you change your mind.`)) {
    return
  }
  
  loadingBadge.value = badge.award_event_id
  
  const result = await badgesStore.removeBadge(badge.a_tag, badge.award_event_id)
  
  loadingBadge.value = null
  
  if (result.success) {
    uiStore.showInfo(`"${badge.badge_name}" has been removed from your profile`)
    closeDetailModal()
  } else {
    uiStore.showError(result.error || "Couldn't remove the badge right now. Please try again.")
  }
}
</script>

<style scoped>
.inbox {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.header-text h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.header-text p {
  color: var(--color-text-muted);
  margin: 0;
}

.refresh-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 1.25rem;
  display: inline-block;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.tab.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.tab-icon {
  font-size: 1rem;
}

.tab-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tab:not(.active) .tab-count {
  background: var(--color-accent);
  color: white;
}

.tab:not(.active) .tab-count.accepted {
  background: var(--color-success);
}

/* Content */
.inbox-content {
  min-height: 300px;
}

.badge-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-illustration {
  font-size: 4rem;
  margin-bottom: 1rem;
  display: block;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.75rem 0;
}

.empty-state > p {
  color: var(--color-text-muted);
  margin: 0 auto;
  max-width: 320px;
  line-height: 1.6;
}

/* Empty State CTA */
.empty-cta {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--color-border);
}

.empty-cta .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.empty-cta .btn-primary {
  background: var(--color-primary);
  color: white;
}

.empty-cta .btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
}

.cta-hint {
  margin: 0.75rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

@media (max-width: 640px) {
  .tab-text {
    display: none;
  }
  
  .tab {
    padding: 0.75rem 1rem;
  }
}
</style>
