<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">User Profile</h2>
            <button class="close-btn" @click="close">
              <IconX :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <!-- Loading State -->
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
              <p>Loading profile...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
              <IconAlertCircle :size="48" />
              <p>{{ error }}</p>
              <button class="btn btn-secondary" @click="loadProfile">
                Try Again
              </button>
            </div>

            <!-- Profile Content -->
            <template v-else-if="profile">
              <!-- Profile Header -->
              <div class="profile-header">
                <UserAvatar
                  :picture="profile.picture"
                  :name="profile.name || profile.display_name"
                  :pubkey="pubkey"
                  size="xl"
                />
                <div class="profile-info">
                  <h3 class="profile-name">
                    {{ profile.name || profile.display_name || 'Anonymous' }}
                  </h3>
                  <p v-if="profile.nip05" class="profile-nip05">
                    <IconCheck :size="14" class="verified-icon" />
                    {{ profile.nip05 }}
                  </p>
                  <p class="profile-npub">{{ shortNpub }}</p>
                </div>
              </div>

              <!-- Bio -->
              <p v-if="profile.about" class="profile-bio">
                {{ profile.about }}
              </p>

              <!-- Links -->
              <div v-if="hasLinks" class="profile-links">
                <a
                  v-if="profile.website"
                  :href="normalizeUrl(profile.website)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="profile-link"
                >
                  <IconWorld :size="16" />
                  <span>{{ cleanUrl(profile.website) }}</span>
                </a>
                <a
                  v-if="profile.lud16"
                  :href="`lightning:${profile.lud16}`"
                  class="profile-link"
                >
                  <IconBolt :size="16" />
                  <span>{{ profile.lud16 }}</span>
                </a>
              </div>

              <!-- Badges Section -->
              <div v-if="showBadges" class="badges-section">
                <div class="section-header">
                  <h4 class="section-title">
                    <IconAward :size="18" />
                    Badges
                    <span v-if="badges.length" class="badge-count">{{ badges.length }}</span>
                  </h4>
                </div>

                <div v-if="badgesLoading" class="badges-loading">
                  <div class="spinner-sm"></div>
                  <span>Loading badges...</span>
                </div>

                <div v-else-if="badges.length === 0" class="empty-badges">
                  <p>No badges yet</p>
                </div>

                <div v-else class="badges-grid">
                  <div
                    v-for="badge in badges"
                    :key="badge.a_tag || badge.award_event_id"
                    class="badge-item"
                    @click="handleBadgeClick(badge)"
                  >
                    <img
                      v-if="getBadgeImage(badge) && !badgeImageErrors.has(badge.a_tag)"
                      :src="getBadgeImage(badge)"
                      :alt="getBadgeName(badge)"
                      class="badge-image"
                      @error="handleBadgeImageError(badge.a_tag)"
                    />
                    <div v-else class="badge-placeholder">
                      <IconAward :size="24" />
                    </div>
                    <span class="badge-name">{{ getBadgeName(badge) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="copyNpub">
              <IconCopy :size="16" />
              Copy npub
            </button>
            <button class="btn btn-primary" @click="viewFullProfile">
              View Full Profile
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useUIStore } from '@/stores/ui'
import UserAvatar from './UserAvatar.vue'
import {
  IconX,
  IconAlertCircle,
  IconCheck,
  IconWorld,
  IconBolt,
  IconAward,
  IconCopy
} from '@tabler/icons-vue'

const props = defineProps({
  pubkey: {
    type: String,
    required: true
  },
  showBadges: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'badge-click'])

const router = useRouter()
const ui = useUIStore()

// State
const isOpen = ref(true)
const isLoading = ref(false)
const error = ref(null)
const profile = ref(null)
const badges = ref([])
const badgesLoading = ref(false)
const badgeImageErrors = ref(new Set())

// Computed
const shortNpub = computed(() => {
  if (!profile.value?.npub) return ''
  const npub = profile.value.npub
  return `${npub.slice(0, 12)}...${npub.slice(-8)}`
})

const hasLinks = computed(() =>
  profile.value?.website || profile.value?.lud16
)

// Methods
async function loadProfile() {
  isLoading.value = true
  error.value = null

  try {
    const response = await api.getProfile(props.pubkey)
    profile.value = response.data

    if (props.showBadges) {
      loadBadges()
    }
  } catch (err) {
    error.value = err.response?.data?.detail || 'Failed to load profile'
    console.error('Failed to load profile:', err)
  } finally {
    isLoading.value = false
  }
}

async function loadBadges() {
  badgesLoading.value = true

  try {
    const response = await api.getProfileBadges(props.pubkey)
    // Backend returns { accepted: [...], pending: [...] }
    badges.value = response.data?.accepted || []
  } catch (err) {
    console.error('Failed to load badges:', err)
  } finally {
    badgesLoading.value = false
  }
}

function close() {
  isOpen.value = false
  setTimeout(() => {
    emit('close')
  }, 200) // Wait for animation
}

function handleBadgeClick(badge) {
  emit('badge-click', badge)
  ui.openBadgeDetail(badge.a_tag, badge)
}

function handleBadgeImageError(aTag) {
  badgeImageErrors.value.add(aTag)
}

// Helper: Get badge image (handles both API response formats)
function getBadgeImage(badge) {
  return badge.badge_image || badge.image || badge.thumb || null
}

// Helper: Get badge name (handles both API response formats)
function getBadgeName(badge) {
  return badge.badge_name || badge.name || 'Unnamed Badge'
}

function viewFullProfile() {
  close()
  router.push(`/profile/${props.pubkey}`)
}

async function copyNpub() {
  if (profile.value?.npub) {
    try {
      await navigator.clipboard.writeText(profile.value.npub)
      ui.showSuccess('Copied npub to clipboard')
    } catch (err) {
      ui.showError('Failed to copy')
    }
  }
}

function normalizeUrl(url) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://${url}`
}

function cleanUrl(url) {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// Load on mount
onMounted(() => {
  loadProfile()
})

// Watch for pubkey changes
watch(() => props.pubkey, () => {
  loadProfile()
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

/* Profile Header */
.profile-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.profile-nip05 {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-success);
  margin: 0 0 0.25rem 0;
}

.verified-icon {
  color: var(--color-success);
}

.profile-npub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Profile Bio */
.profile-bio {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0 0 1.25rem 0;
}

/* Profile Links */
.profile-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.profile-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
}

.profile-link:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

/* Badges Section */
.badges-section {
  border-top: 1px solid var(--color-border);
  padding-top: 1.25rem;
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
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.badge-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}

.badges-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.empty-badges {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 1rem;
}

.badge-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.badge-item:hover {
  background: var(--color-primary-soft);
  transform: translateY(-2px);
}

.badge-image {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.badge-placeholder {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.badge-name {
  font-size: 0.6875rem;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

  .profile-header {
    flex-direction: column;
    text-align: center;
  }

  .profile-links {
    justify-content: center;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
