<template>
  <div class="issued-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1>Issued Badges</h1>
      <p class="subtitle">Badges you've created and who holds them</p>
    </header>

    <!-- Refresh Button -->
    <div class="actions-bar">
      <button
        class="refresh-btn"
        :disabled="isLoading"
        @click="loadBadges"
      >
        <Icon name="refresh" size="sm" :spin="isLoading" />
        Refresh
      </button>
    </div>

    <!-- Content -->
    <main class="content">
      <!-- Loading State -->
      <div v-if="isLoading && badges.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your badges...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="badges.length === 0" class="empty-state">
        <div class="empty-icon">
          <Icon name="certificate" size="xl" />
        </div>
        <h3>No badges issued yet</h3>
        <p>Badges you create and issue will appear here with their holders.</p>
        <router-link to="/creator" class="btn-primary">
          <Icon name="sparkles" size="sm" />
          <span>Create Your First Badge</span>
        </router-link>
      </div>

      <!-- Badges List -->
      <div v-else class="badges-list">
        <div
          v-for="badge in badges"
          :key="badge.a_tag"
          class="badge-card"
        >
          <!-- Badge Header -->
          <div class="badge-header" @click="toggleBadge(badge.a_tag)">
            <div class="badge-image-container">
              <img
                v-if="badge.image && !badgeImageErrors.has(badge.a_tag)"
                :src="badge.image"
                :alt="badge.name || 'Badge'"
                class="badge-image"
                @error="badgeImageErrors.add(badge.a_tag)"
              />
              <div v-else class="badge-placeholder">
                <Icon name="award" size="md" />
              </div>
            </div>
            <div class="badge-info">
              <h3 class="badge-name">{{ badge.name || 'Unnamed Badge' }}</h3>
              <span class="badge-identifier">{{ badge.identifier || 'Unknown' }}</span>
            </div>
            <div class="badge-stats">
              <span class="holder-count">
                <Icon name="users" size="sm" />
                {{ badge.holder_count || 0 }}
              </span>
              <button
                class="btn-delete"
                :disabled="deletingBadge === badge.a_tag"
                @click.stop="handleDelete(badge)"
                title="Delete badge from Nostr"
              >
                <span v-if="deletingBadge === badge.a_tag" class="spinner-sm"></span>
                <Icon v-else name="trash" size="sm" />
              </button>
              <Icon
                :name="expandedBadges.has(badge.a_tag) ? 'chevron-up' : 'chevron-down'"
                size="sm"
                class="expand-icon"
              />
            </div>
          </div>

          <!-- Holders List (Expandable) -->
          <Transition name="expand">
            <div v-if="expandedBadges.has(badge.a_tag)" class="holders-section">
              <div v-if="loadingHolders.has(badge.a_tag)" class="holders-loading">
                <div class="spinner-sm"></div>
                <span>Loading holders...</span>
              </div>

              <div v-else-if="!badge.holders || badge.holders.length === 0" class="no-holders">
                <p>No recipients yet</p>
                <button class="btn-small" @click="awardBadge(badge)">
                  <Icon name="send" size="sm" />
                  Award Badge
                </button>
              </div>

              <div v-else class="holders-grid">
                <div
                  v-for="holder in badge.holders"
                  :key="holder.pubkey"
                  class="holder-item"
                  @click="viewHolder(holder.pubkey)"
                >
                  <UserAvatar
                    :picture="holder.profile?.picture"
                    :name="holder.profile?.name || holder.profile?.display_name"
                    :pubkey="holder.pubkey"
                    size="sm"
                    clickable
                  />
                  <span class="holder-name">
                    {{ holder.profile?.name || holder.profile?.display_name || shortPubkey(holder.pubkey) }}
                  </span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </main>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="deleteConfirm.show" class="modal-overlay" @click.self="cancelDelete">
          <div class="modal-content">
            <div class="modal-icon">
              <Icon name="alert-circle" size="lg" />
            </div>
            <h3>Delete "{{ deleteConfirm.badge?.name || deleteConfirm.badge?.identifier }}"?</h3>
            <p class="modal-warning">
              This will publish a NIP-09 deletion event for the badge definition and all award events.
            </p>
            <p v-if="(deleteConfirm.badge?.holder_count || 0) > 0" class="modal-holders">
              {{ deleteConfirm.badge.holder_count }} holder(s) will lose this badge.
            </p>
            <p class="modal-instruction">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              ref="deleteInput"
              v-model="deleteConfirm.input"
              type="text"
              class="modal-input"
              placeholder="Type DELETE"
              autocomplete="off"
              @keyup.enter="confirmDelete"
            />
            <div class="modal-actions">
              <button class="btn-cancel" @click="cancelDelete">Cancel</button>
              <button
                class="btn-confirm-delete"
                :disabled="deleteConfirm.input !== 'DELETE' || deletingBadge"
                @click="confirmDelete"
              >
                <span v-if="deletingBadge" class="spinner-sm"></span>
                {{ deletingBadge ? 'Deleting...' : 'Delete Badge' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { createDeletionEvent, signEvent } from '@/utils/nip07'
import Icon from '@/components/common/Icon.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const auth = useAuthStore()
const ui = useUIStore()

// State
const isLoading = ref(false)
const badges = ref([])
const expandedBadges = reactive(new Set())
const loadingHolders = reactive(new Set())
const badgeImageErrors = reactive(new Set())
const deletingBadge = ref(null)
const deleteConfirm = reactive({ show: false, badge: null, input: '' })
const deleteInput = ref(null)

// Methods
async function loadBadges() {
  if (!auth.hex) return

  isLoading.value = true

  try {
    // Get badges created by this user
    const response = await api.getBadgesByIssuer(auth.hex)
    badges.value = response.data.badges || []

    // Pre-fetch holder counts for all badges (without full profiles)
    await Promise.allSettled(
      badges.value
        .filter(b => !b.holder_count)
        .map(async (badge) => {
          try {
            const res = await api.getBadgeOwners(badge.a_tag, 1, false)
            badge.holder_count = res.data.total_count || 0
          } catch {
            // Silent - count stays at 0
          }
        })
    )
  } catch (err) {
    console.error('Failed to load badges:', err)
    ui.showError('Failed to load badges')
  } finally {
    isLoading.value = false
  }
}

async function toggleBadge(aTag) {
  if (expandedBadges.has(aTag)) {
    expandedBadges.delete(aTag)
  } else {
    expandedBadges.add(aTag)

    // Load holders if not already loaded
    const badge = badges.value.find(b => b.a_tag === aTag)
    if (badge && !badge.holders) {
      await loadHolders(badge)
    }
  }
}

async function loadHolders(badge) {
  loadingHolders.add(badge.a_tag)

  try {
    const response = await api.getBadgeOwners(badge.a_tag, 50, true)
    badge.holders = response.data.owners || []
    badge.holder_count = response.data.total_count || 0
  } catch (err) {
    console.error('Failed to load holders:', err)
  } finally {
    loadingHolders.delete(badge.a_tag)
  }
}

function viewHolder(pubkey) {
  ui.openLookupUser(pubkey)
}

function awardBadge(badge) {
  // Navigate to creator with badge pre-selected
  // For now, just show a message
  ui.showInfo('Use the Creator tab to award this badge')
}

function handleDelete(badge) {
  deleteConfirm.badge = badge
  deleteConfirm.input = ''
  deleteConfirm.show = true
  nextTick(() => deleteInput.value?.focus())
}

function cancelDelete() {
  deleteConfirm.show = false
  deleteConfirm.badge = null
  deleteConfirm.input = ''
}

async function confirmDelete() {
  if (deleteConfirm.input !== 'DELETE') return

  const badge = deleteConfirm.badge
  const name = badge.name || badge.identifier || 'this badge'

  deletingBadge.value = badge.a_tag

  try {
    let signedDeletionEvent = null

    if (auth.isNip07) {
      // NIP-07: fetch event IDs from backend, sign deletion client-side
      const eventsRes = await api.getBadgeEventsForDeletion(badge.a_tag)
      const { event_ids } = eventsRes.data

      if (!event_ids || event_ids.length === 0) {
        ui.showError('No events found for this badge on relays')
        return
      }

      const unsignedEvent = createDeletionEvent(event_ids, [badge.a_tag], 'Badge deleted by issuer')
      signedDeletionEvent = await signEvent(unsignedEvent)

      if (!signedDeletionEvent) {
        ui.showError('Signing was rejected')
        return
      }
    }

    const response = await api.deleteBadge(badge.a_tag, signedDeletionEvent)

    if (response.data.success) {
      badges.value = badges.value.filter(b => b.a_tag !== badge.a_tag)
      cancelDelete()
      ui.showSuccess(`"${name}" deleted (${response.data.deleted_events} event(s) removed)`)
    } else {
      ui.showError(response.data.error || 'Failed to delete badge')
    }
  } catch (err) {
    console.error('Delete badge error:', err)
    ui.showError(err.response?.data?.detail || err.message || 'Failed to delete badge')
  } finally {
    deletingBadge.value = null
  }
}

function shortPubkey(pubkey) {
  return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`
}

// Lifecycle
onMounted(() => {
  loadBadges()
})
</script>

<style scoped>
/* ===========================================
   Layout
   =========================================== */
.issued-page {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 4rem;
}

/* ===========================================
   Page Header
   =========================================== */
.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
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
   Actions Bar
   =========================================== */
.actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
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
   Loading & Empty States
   =========================================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

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
   Badges List
   =========================================== */
.badges-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.badge-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.badge-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.badge-header:hover {
  background: var(--color-surface-elevated);
}

.badge-image-container {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-elevated);
}

.badge-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.125rem 0;
}

.badge-identifier {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.badge-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.holder-count {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.btn-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover:not(:disabled) {
  border-color: var(--color-danger, #e53e3e);
  color: var(--color-danger, #e53e3e);
  background: rgba(229, 62, 62, 0.05);
}

.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.expand-icon {
  color: var(--color-text-muted);
}

/* ===========================================
   Holders Section
   =========================================== */
.holders-section {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.holders-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.no-holders {
  text-align: center;
  padding: 1.5rem;
  color: var(--color-text-muted);
}

.no-holders p {
  margin: 0 0 1rem;
  font-size: 0.875rem;
}

.btn-small {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: var(--color-primary-hover);
}

.holders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.holder-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.holder-item:hover {
  background: var(--color-primary-soft);
}

.holder-name {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Expand Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 400px;
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 640px) {
  .page-header h1 {
    font-size: 1.5rem;
  }

  .badge-header {
    padding: 0.875rem 1rem;
  }

  .badge-image-container {
    width: 40px;
    height: 40px;
  }

  .holders-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

/* ===========================================
   Delete Confirmation Modal
   =========================================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  max-width: 420px;
  width: 100%;
  text-align: center;
}

.modal-icon {
  color: var(--color-danger, #e53e3e);
  margin-bottom: 1rem;
}

.modal-content h3 {
  font-size: 1.125rem;
  margin: 0 0 0.75rem;
}

.modal-warning {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.modal-holders {
  font-size: 0.875rem;
  color: var(--color-danger, #e53e3e);
  font-weight: 500;
  margin: 0 0 0.75rem;
}

.modal-instruction {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
}

.modal-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  color: var(--color-text);
  font-size: 0.9375rem;
  text-align: center;
  letter-spacing: 2px;
  font-weight: 600;
  margin-bottom: 1.25rem;
  outline: none;
  transition: border-color 0.15s;
}

.modal-input:focus {
  border-color: var(--color-danger, #e53e3e);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-cancel {
  flex: 1;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  border-color: var(--color-text-muted);
}

.btn-confirm-delete {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: var(--color-danger, #e53e3e);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-confirm-delete:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-confirm-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content {
  transform: scale(0.95);
}

.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
