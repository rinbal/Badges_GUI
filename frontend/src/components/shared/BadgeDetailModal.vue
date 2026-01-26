<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">Badge Details</h2>
            <button class="close-btn" @click="close">
              <IconX :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <!-- Loading State -->
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
              <p>Loading badge...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
              <IconAlertCircle :size="48" />
              <p>{{ error }}</p>
              <button class="btn btn-secondary" @click="loadBadge">
                Try Again
              </button>
            </div>

            <!-- Badge Content -->
            <template v-else-if="badge">
              <!-- Badge Header -->
              <div class="badge-header">
                <div class="badge-image-container">
                  <img
                    v-if="badge.image"
                    :src="badge.image"
                    :alt="badge.name"
                    class="badge-image"
                    @error="(e) => e.target.style.display = 'none'"
                  />
                  <div v-else class="badge-placeholder">
                    <IconAward :size="48" />
                  </div>
                </div>
                <div class="badge-info">
                  <h3 class="badge-name">{{ badge.name || 'Unnamed Badge' }}</h3>
                  <p class="badge-identifier">{{ shortIdentifier }}</p>
                </div>
              </div>

              <!-- Description -->
              <p v-if="badge.description" class="badge-description">
                {{ badge.description }}
              </p>

              <!-- Issuer Section -->
              <div class="issuer-section">
                <h4 class="section-title">
                  <IconUser :size="16" />
                  Issued by
                </h4>
                <div class="issuer-row" @click="viewIssuerProfile">
                  <UserAvatar
                    :picture="issuerProfile?.picture"
                    :name="issuerProfile?.name || issuerProfile?.display_name"
                    :pubkey="badge.issuer_pubkey"
                    size="sm"
                    clickable
                  />
                  <div class="issuer-info">
                    <span class="issuer-name">
                      {{ issuerProfile?.name || issuerProfile?.display_name || 'Unknown' }}
                    </span>
                    <span class="issuer-npub">{{ shortIssuerNpub }}</span>
                  </div>
                  <IconChevronRight :size="16" class="chevron" />
                </div>
              </div>

              <!-- Holders Section -->
              <div class="holders-section">
                <div class="section-header">
                  <h4 class="section-title">
                    <IconUsers :size="16" />
                    Badge Holders
                    <span v-if="holdersCount > 0" class="holders-count">{{ holdersCount }}</span>
                  </h4>
                  <button
                    v-if="holdersCount > holdersPreviewLimit"
                    class="view-all-btn"
                    @click="viewAllHolders"
                  >
                    View All
                  </button>
                </div>

                <div v-if="holdersLoading" class="holders-loading">
                  <div class="spinner-sm"></div>
                  <span>Loading holders...</span>
                </div>

                <div v-else-if="holders.length === 0" class="empty-holders">
                  <p>No holders yet</p>
                </div>

                <div v-else class="holders-grid">
                  <div
                    v-for="holder in holdersPreview"
                    :key="holder.pubkey"
                    class="holder-item"
                    @click="viewHolderProfile(holder)"
                  >
                    <UserAvatar
                      :picture="holder.profile?.picture"
                      :name="holder.profile?.name || holder.profile?.display_name"
                      :pubkey="holder.pubkey"
                      size="md"
                      clickable
                    />
                    <span class="holder-name">
                      {{ holder.profile?.name || holder.profile?.display_name || 'Anon' }}
                    </span>
                  </div>
                  <div
                    v-if="holdersCount > holdersPreviewLimit"
                    class="holder-item more-holders"
                    @click="viewAllHolders"
                  >
                    <div class="more-count">+{{ holdersCount - holdersPreviewLimit }}</div>
                    <span class="holder-name">more</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div v-if="badge && !isLoading && !error" class="modal-footer">
            <button class="btn btn-secondary" @click="copyATag">
              <IconCopy :size="16" />
              Copy ID
            </button>
            <button
              v-if="canRequest"
              class="btn btn-primary"
              @click="requestBadge"
            >
              <IconSend :size="16" />
              Request Badge
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '@/api/client'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from './UserAvatar.vue'
import {
  IconX,
  IconAlertCircle,
  IconAward,
  IconUser,
  IconUsers,
  IconChevronRight,
  IconCopy,
  IconSend
} from '@tabler/icons-vue'

const props = defineProps({
  badgeATag: {
    type: String,
    required: true
  },
  initialBadge: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'request'])

const ui = useUIStore()
const auth = useAuthStore()

// State
const isOpen = ref(true)
const isLoading = ref(false)
const error = ref(null)
const badge = ref(null)
const issuerProfile = ref(null)
const holders = ref([])
const holdersLoading = ref(false)
const holdersCount = ref(0)
const holdersPreviewLimit = 8

// Computed
const shortIdentifier = computed(() => {
  if (!badge.value?.identifier) return ''
  const id = badge.value.identifier
  if (id.length <= 20) return id
  return `${id.slice(0, 10)}...${id.slice(-8)}`
})

const shortIssuerNpub = computed(() => {
  if (!issuerProfile.value?.npub) return ''
  const npub = issuerProfile.value.npub
  return `${npub.slice(0, 8)}...${npub.slice(-4)}`
})

const holdersPreview = computed(() =>
  holders.value.slice(0, holdersPreviewLimit)
)

const canRequest = computed(() => {
  if (!auth.isAuthenticated) return false
  // Can't request your own badge
  if (badge.value?.issuer_pubkey === auth.hex) return false
  return true
})

// Methods
async function loadBadge() {
  isLoading.value = true
  error.value = null

  try {
    // Use initial badge data if provided
    if (props.initialBadge) {
      badge.value = props.initialBadge
    } else if (props.badgeATag) {
      // Load badge from API using a-tag
      const response = await api.getBadgeDetails(props.badgeATag)
      badge.value = response.data
    }

    if (badge.value) {
      // Load issuer profile
      loadIssuerProfile()
      // Load holders
      loadHolders()
    } else {
      error.value = 'Badge not found'
    }
  } catch (err) {
    error.value = err.response?.data?.detail || 'Failed to load badge'
    console.error('Failed to load badge:', err)
  } finally {
    isLoading.value = false
  }
}

async function loadIssuerProfile() {
  if (!badge.value?.issuer_pubkey) return

  try {
    const response = await api.getProfile(badge.value.issuer_pubkey)
    issuerProfile.value = response.data
  } catch (err) {
    console.error('Failed to load issuer profile:', err)
  }
}

async function loadHolders() {
  if (!props.badgeATag) return

  holdersLoading.value = true

  try {
    const response = await api.getBadgeOwners(props.badgeATag, holdersPreviewLimit + 1, true)
    holders.value = response.data.owners || []
    holdersCount.value = response.data.total_count || holders.value.length
  } catch (err) {
    console.error('Failed to load holders:', err)
  } finally {
    holdersLoading.value = false
  }
}

function close() {
  isOpen.value = false
  setTimeout(() => {
    emit('close')
  }, 200)
}

function viewIssuerProfile() {
  if (badge.value?.issuer_pubkey) {
    close()
    ui.openLookupUser(badge.value.issuer_pubkey)
  }
}

function viewHolderProfile(holder) {
  close()
  ui.openLookupUser(holder.pubkey)
}

function viewAllHolders() {
  // For now, just show a message. Full view can be added later.
  ui.showInfo(`This badge has ${holdersCount.value} holders`)
}

async function copyATag() {
  if (props.badgeATag) {
    try {
      await navigator.clipboard.writeText(props.badgeATag)
      ui.showSuccess('Copied badge ID to clipboard')
    } catch (err) {
      ui.showError('Failed to copy')
    }
  }
}

function requestBadge() {
  emit('request', badge.value)
  close()
  ui.openRequestBadge(props.badgeATag, badge.value)
}

// Load on mount
onMounted(() => {
  loadBadge()
})

// Watch for badgeATag changes
watch(() => props.badgeATag, () => {
  loadBadge()
})
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal Container */
.modal-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Modal Content */
.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 1rem;
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

.error-state {
  color: var(--color-danger);
}

/* Badge Header */
.badge-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.badge-image-container {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
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
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.badge-identifier {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Badge Description */
.badge-description {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
}

/* Sections */
.issuer-section,
.holders-section {
  border-top: 1px solid var(--color-border);
  padding-top: 1.25rem;
  margin-bottom: 1.25rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

/* Issuer Row */
.issuer-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.issuer-row:hover {
  background: var(--color-primary-soft);
}

.issuer-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.issuer-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.issuer-npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.chevron {
  color: var(--color-text-muted);
}

/* Holders */
.holders-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}

.view-all-btn {
  background: none;
  border: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.view-all-btn:hover {
  background: var(--color-primary-soft);
}

.holders-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.empty-holders {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.holders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 0.75rem;
}

.holder-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.holder-item:hover {
  background: var(--color-surface-elevated);
}

.holder-name {
  font-size: 0.6875rem;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.more-holders {
  background: var(--color-surface-elevated);
}

.more-count {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-border);
  color: var(--color-text);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
  opacity: 0;
}

/* Responsive */
@media (max-width: 480px) {
  .modal-container {
    max-height: 100vh;
    border-radius: 0;
  }

  .badge-header {
    flex-direction: column;
    text-align: center;
  }

  .holders-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
