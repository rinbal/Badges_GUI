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
      <!-- Loading Skeleton -->
      <div v-if="isLoading && badges.length === 0" class="badges-list">
        <div v-for="n in 4" :key="n" class="badge-card">
          <div class="badge-header skeleton-header">
            <div class="skeleton-image"></div>
            <div class="skeleton-info">
              <div class="skeleton-name"></div>
              <div class="skeleton-identifier"></div>
            </div>
            <div class="skeleton-stats">
              <div class="skeleton-count"></div>
              <div class="skeleton-btn"></div>
              <div class="skeleton-btn"></div>
              <div class="skeleton-btn"></div>
            </div>
          </div>
        </div>
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
                class="btn-save-template"
                :class="{ 'is-saved': savedTemplateIdentifiers.has(badge.identifier) }"
                :disabled="savedTemplateIdentifiers.has(badge.identifier) || savingTemplateFor === badge.a_tag"
                :title="savedTemplateIdentifiers.has(badge.identifier) ? 'Already saved as template' : 'Save as template'"
                @click.stop="saveToTemplate(badge)"
              >
                <span v-if="savingTemplateFor === badge.a_tag" class="spinner-sm"></span>
                <Icon v-else name="template" size="sm" />
              </button>
              <button
                class="btn-send-again"
                @click.stop="openReissue(badge)"
                title="Send again to new recipients"
              >
                <Icon name="send" size="sm" />
              </button>
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

              <div v-else-if="badge.holders === null" class="no-holders fetch-error">
                <p>Oops, couldn't load — relays seem busy right now. Come try again in a few minutes.</p>
                <button class="btn-small" @click="loadHolders(badge)">
                  <Icon name="refresh" size="sm" />
                  Try Again
                </button>
              </div>

              <div v-else-if="badge.holders && badge.holders.length === 0" class="no-holders">
                <p>No recipients yet</p>
                <button class="btn-small" @click="openReissue(badge)">
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

    <!-- Reissue Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="reissueModal.show" class="modal-overlay" @click.self="closeReissue">
          <div class="modal-content reissue-modal">
            <!-- Header -->
            <div class="reissue-header">
              <div class="reissue-title-icon">
                <Icon name="send" size="md" />
              </div>
              <div>
                <h3>Send Again</h3>
                <p class="reissue-subtitle">Award this badge to additional recipients</p>
              </div>
            </div>

            <!-- Badge Preview (locked) -->
            <div class="reissue-badge-preview">
              <div class="reissue-badge-image">
                <img
                  v-if="reissueModal.badge?.image"
                  :src="reissueModal.badge.image"
                  :alt="reissueModal.badge.name"
                />
                <div v-else class="reissue-badge-placeholder">
                  <Icon name="award" size="md" />
                </div>
              </div>
              <div class="reissue-badge-info">
                <strong class="reissue-badge-name">{{ reissueModal.badge?.name }}</strong>
                <span class="reissue-badge-identifier">{{ reissueModal.badge?.identifier }}</span>
                <p v-if="reissueModal.badge?.description" class="reissue-badge-description">
                  {{ reissueModal.badge.description }}
                </p>
              </div>
            </div>

            <!-- Recipient Input -->
            <div class="reissue-recipients">
              <label class="reissue-label">Recipients</label>
              <RecipientInput
                v-model="reissueRecipientsText"
                :count="reissueRecipients.length"
              />
            </div>

            <!-- Actions -->
            <div class="modal-actions reissue-actions">
              <button class="btn-cancel" @click="closeReissue">Cancel</button>
              <button
                class="btn-reissue"
                :disabled="reissueRecipients.length === 0 || isReissuing"
                @click="confirmReissue"
              >
                <span v-if="isReissuing" class="spinner-sm"></span>
                <Icon v-else name="send" size="sm" />
                {{ isReissuing ? 'Sending...' : 'Send Again' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useBadgesStore } from '@/stores/badges'
import { createDeletionEvent } from '@/utils/nip07'
import Icon from '@/components/common/Icon.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'
import RecipientInput from '@/components/common/RecipientInput.vue'

const auth = useAuthStore()
const ui = useUIStore()
const badgesStore = useBadgesStore()

// State
const isLoading = ref(false)
const badges = ref([])
const expandedBadges = reactive(new Set())
const loadingHolders = reactive(new Set())
const badgeImageErrors = reactive(new Set())
const deletingBadge = ref(null)
const savingTemplateFor = ref(null)
const deleteConfirm = reactive({ show: false, badge: null, input: '' })
const deleteInput = ref(null)

// Reissue modal
const reissueModal = reactive({ show: false, badge: null })
const reissueRecipientsText = ref('')
const isReissuing = ref(false)

const reissueRecipients = computed(() =>
  reissueRecipientsText.value
    .split(/[\n,]/)
    .map(r => r.trim())
    .filter(r => r.startsWith('npub1') && r.length === 63)
)

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
    badge.holders = null
  } finally {
    loadingHolders.delete(badge.a_tag)
  }
}

function viewHolder(pubkey) {
  ui.openLookupUser(pubkey)
}

function openReissue(badge) {
  reissueModal.badge = badge
  reissueRecipientsText.value = ''
  reissueModal.show = true
}

function closeReissue() {
  reissueModal.show = false
  reissueModal.badge = null
  reissueRecipientsText.value = ''
}

async function confirmReissue() {
  if (reissueRecipients.value.length === 0) return

  const badge = reissueModal.badge
  isReissuing.value = true

  const result = await badgesStore.createAndAwardBadge(badge, reissueRecipients.value)

  isReissuing.value = false

  if (result.success) {
    const count = result.data.recipients_count
    ui.showSuccess(`"${badge.name}" sent to ${count} recipient${count !== 1 ? 's' : ''}`)

    // Update holder count and clear cached holders so they reload on next expand
    const liveBadge = badges.value.find(b => b.a_tag === badge.a_tag)
    if (liveBadge) {
      liveBadge.holder_count = (liveBadge.holder_count || 0) + count
      delete liveBadge.holders
    }

    closeReissue()
  } else {
    ui.showError(result.error || 'Failed to send badge. Please try again.')
  }
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

    if (auth.isClientSigning) {
      // Client-signing (NIP-07/Amber): fetch event IDs from backend, sign deletion client-side
      const eventsRes = await api.getBadgeEventsForDeletion(badge.a_tag)
      const { event_ids } = eventsRes.data

      if (!event_ids || event_ids.length === 0) {
        ui.showError('No events found for this badge on relays')
        return
      }

      const unsignedEvent = createDeletionEvent(event_ids, [badge.a_tag], 'Badge deleted by issuer')
      signedDeletionEvent = await auth.signEvent(unsignedEvent)

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

// Template helpers
const savedTemplateIdentifiers = computed(() =>
  new Set(badgesStore.userTemplates.map(t => t.identifier))
)

async function saveToTemplate(badge) {
  savingTemplateFor.value = badge.a_tag
  const result = await badgesStore.createTemplate({
    identifier: badge.identifier,
    name: badge.name,
    description: badge.description || '',
    image: badge.image || ''
  })
  if (result.success) {
    ui.showSuccess(`"${badge.name}" saved to templates`)
  } else {
    ui.showError(result.error || 'Could not save template')
  }
  savingTemplateFor.value = null
}

// Lifecycle
onMounted(() => {
  loadBadges()
  badgesStore.fetchUserTemplates()
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
   Loading Skeleton
   =========================================== */
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-image,
.skeleton-name,
.skeleton-identifier,
.skeleton-count,
.skeleton-btn {
  background: linear-gradient(
    90deg,
    var(--color-surface-elevated) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-header {
  cursor: default !important;
}

.skeleton-header:hover {
  background: transparent !important;
}

.skeleton-image {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.skeleton-name {
  height: 1rem;
  width: 42%;
}

.skeleton-identifier {
  height: 0.75rem;
  width: 28%;
}

.skeleton-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.skeleton-count {
  height: 28px;
  width: 52px;
  border-radius: var(--radius-full);
}

.skeleton-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
}

/* ===========================================
   Empty States
   =========================================== */

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

.no-holders.fetch-error p {
  color: var(--color-danger, #e53e3e);
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
   Send Again Button
   =========================================== */
.btn-send-again {
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

.btn-send-again:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

/* ===========================================
   Save to Template Button
   =========================================== */
.btn-save-template {
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

.btn-save-template:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.btn-save-template.is-saved {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-save-template:disabled:not(.is-saved) {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===========================================
   Reissue Modal
   =========================================== */
.reissue-modal {
  max-width: 520px;
  text-align: left;
}

.reissue-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
}

.reissue-title-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  flex-shrink: 0;
}

.reissue-header h3 {
  font-size: 1.125rem;
  margin: 0 0 0.125rem;
}

.reissue-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

.reissue-badge-preview {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 1.25rem;
}

.reissue-badge-image {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface);
}

.reissue-badge-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reissue-badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
}

.reissue-badge-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.reissue-badge-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.reissue-badge-identifier {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.reissue-badge-description {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
  line-height: 1.4;
}

.reissue-recipients {
  margin-bottom: 1.25rem;
}

.reissue-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.reissue-actions {
  justify-content: flex-end;
}

.btn-reissue {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-reissue:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-reissue:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
