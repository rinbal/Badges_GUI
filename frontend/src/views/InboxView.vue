<template>
  <div class="inbox">
    <header class="page-header">
      <h1>📬 Badge Inbox</h1>
      <p>Manage your received badges</p>
    </header>
    
    <!-- Tabs -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        Pending
        <span v-if="badgesStore.pendingCount > 0" class="tab-count">
          {{ badgesStore.pendingCount }}
        </span>
      </button>
      <button 
        :class="['tab', { active: activeTab === 'accepted' }]"
        @click="activeTab = 'accepted'"
      >
        Accepted
        <span v-if="badgesStore.acceptedCount > 0" class="tab-count accepted">
          {{ badgesStore.acceptedCount }}
        </span>
      </button>
    </div>
    
    <!-- Content -->
    <div class="inbox-content">
      <!-- Loading State -->
      <div v-if="badgesStore.isLoading" class="loading-state">
        <LoadingSpinner text="Loading badges..." />
      </div>
      
      <!-- Pending Tab -->
      <template v-else-if="activeTab === 'pending'">
        <div v-if="badgesStore.pendingBadges.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <h3>No pending badges</h3>
          <p>When someone awards you a badge, it will appear here.</p>
        </div>
        <div v-else class="badge-list">
          <BadgeCard
            v-for="badge in badgesStore.pendingBadges"
            :key="badge.award_event_id"
            :badge="badge"
            :is-pending="true"
            :loading="loadingBadge === badge.award_event_id"
            @accept="handleAccept"
          />
        </div>
      </template>
      
      <!-- Accepted Tab -->
      <template v-else>
        <div v-if="badgesStore.acceptedBadges.length === 0" class="empty-state">
          <span class="empty-icon">🏅</span>
          <h3>No accepted badges</h3>
          <p>Accept pending badges to display them on your profile.</p>
        </div>
        <div v-else class="badge-list">
          <BadgeCard
            v-for="badge in badgesStore.acceptedBadges"
            :key="badge.award_event_id"
            :badge="badge"
            :is-pending="false"
            :loading="loadingBadge === badge.award_event_id"
            @remove="handleRemove"
          />
        </div>
      </template>
    </div>
    
    <!-- Refresh Button -->
    <button 
      @click="refreshBadges"
      class="refresh-btn"
      :disabled="badgesStore.isLoading"
    >
      🔄 Refresh
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BadgeCard from '@/components/badges/BadgeCard.vue'

const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const activeTab = ref('pending')
const loadingBadge = ref(null)

onMounted(() => {
  refreshBadges()
})

async function refreshBadges() {
  await Promise.all([
    badgesStore.fetchPendingBadges(),
    badgesStore.fetchAcceptedBadges()
  ])
}

async function handleAccept(badge) {
  loadingBadge.value = badge.award_event_id
  
  const result = await badgesStore.acceptBadge(badge.a_tag, badge.award_event_id)
  
  loadingBadge.value = null
  
  if (result.success) {
    uiStore.showSuccess(`Badge "${badge.badge_name}" accepted!`)
  } else {
    uiStore.showError(result.error || 'Failed to accept badge')
  }
}

async function handleRemove(badge) {
  if (!confirm(`Are you sure you want to remove "${badge.badge_name}"?`)) {
    return
  }
  
  loadingBadge.value = badge.award_event_id
  
  const result = await badgesStore.removeBadge(badge.a_tag, badge.award_event_id)
  
  loadingBadge.value = null
  
  if (result.success) {
    uiStore.showSuccess(`Badge "${badge.badge_name}" removed`)
  } else {
    uiStore.showError(result.error || 'Failed to remove badge')
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

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
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

.inbox-content {
  min-height: 300px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  color: var(--color-text-muted);
  margin: 0;
}

.badge-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.refresh-btn {
  margin-top: 2rem;
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
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

