<template>
  <div class="inbox">
    <header class="page-header">
      <h1>📬 Your Badge Inbox</h1>
      <p>See what badges you've received and manage your collection</p>
    </header>
    
    <!-- Tabs -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        <span class="tab-icon">⏳</span>
        <span class="tab-text">Waiting for you</span>
        <span v-if="badgesStore.pendingCount > 0" class="tab-count">
          {{ badgesStore.pendingCount }}
        </span>
      </button>
      <button 
        :class="['tab', { active: activeTab === 'accepted' }]"
        @click="activeTab = 'accepted'"
      >
        <span class="tab-icon">✓</span>
        <span class="tab-text">Your collection</span>
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
          <h3>No badges waiting</h3>
          <p>
            When someone awards you a badge, it will show up here. 
            You can then choose to accept it and add it to your profile.
          </p>
          <div class="empty-tips">
            <div class="tip">
              <span class="tip-icon">💡</span>
              <span>Badges are like digital achievements you can display on your Nostr profile</span>
            </div>
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
          <h3>Your collection is empty</h3>
          <p>
            Badges you accept will appear here. They'll be visible on your 
            Nostr profile for everyone to see.
          </p>
          <div class="empty-tips">
            <div class="tip">
              <span class="tip-icon">👈</span>
              <span>Check the "Waiting for you" tab to see if you have any pending badges</span>
            </div>
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
    
    <!-- Refresh Button -->
    <div class="inbox-footer">
      <button 
        @click="refreshBadges"
        class="refresh-btn"
        :disabled="badgesStore.isLoading"
      >
        <span :class="['refresh-icon', { spinning: badgesStore.isLoading }]">🔄</span>
        {{ badgesStore.isLoading ? 'Checking...' : 'Check for new badges' }}
      </button>
      <p class="last-updated" v-if="lastRefresh">
        Last checked: {{ formatLastRefresh }}
      </p>
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
import { ref, computed, onMounted } from 'vue'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import BadgeCard from '@/components/badges/BadgeCard.vue'
import BadgeCardSkeleton from '@/components/badges/BadgeCardSkeleton.vue'
import BadgeDetailModal from '@/components/badges/BadgeDetailModal.vue'

const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const activeTab = ref('pending')
const loadingBadge = ref(null)
const lastRefresh = ref(null)

// Modal state
const showDetailModal = ref(false)
const selectedBadge = ref(null)
const selectedBadgeIsPending = ref(false)

const formatLastRefresh = computed(() => {
  if (!lastRefresh.value) return ''
  const now = new Date()
  const diff = Math.floor((now - lastRefresh.value) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return lastRefresh.value.toLocaleTimeString()
})

onMounted(() => {
  refreshBadges()
})

async function refreshBadges() {
  await Promise.all([
    badgesStore.fetchPendingBadges(),
    badgesStore.fetchAcceptedBadges()
  ])
  lastRefresh.value = new Date()
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

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.page-header p {
  color: var(--color-text-muted);
  margin: 0;
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

.empty-state p {
  color: var(--color-text-muted);
  margin: 0 auto;
  max-width: 400px;
  line-height: 1.6;
}

.empty-tips {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.tip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.tip-icon {
  font-size: 1rem;
}

/* Footer */
.inbox-footer {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-soft);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.refresh-icon {
  display: inline-block;
  transition: transform 0.3s ease;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.last-updated {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  margin: 0;
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
