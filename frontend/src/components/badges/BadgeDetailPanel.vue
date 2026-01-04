<template>
  <!--
    BadgeDetailPanel
    Slide-over panel displaying detailed badge information.
    Features: badge info, issuer details, other owners, lightbox, and actions.
  -->
  <Teleport to="body">
    <!-- Image Lightbox Modal -->
    <Transition name="lightbox">
      <div v-if="showLightbox && badgeImage" class="lightbox" @click="showLightbox = false">
        <button class="lightbox-close" @click.stop="showLightbox = false">✕</button>
        <img :src="badgeImage" :alt="badgeName" class="lightbox-image" @click.stop />
      </div>
    </Transition>

    <Transition name="panel">
      <div v-if="isOpen" class="panel-backdrop" @click.self="$emit('close')">
        <aside class="panel">
          <!-- Panel Header -->
          <header class="panel-header">
            <h2>Badge Details</h2>
            <button class="close-btn" @click="$emit('close')" title="Close">
              <span>✕</span>
            </button>
          </header>

          <!-- Panel Content -->
          <div class="panel-content">
            <!-- ========================================
                 BADGE SHOWCASE
                 Featured badge image and core info
                 ======================================== -->
            <section class="showcase">
              <!-- Badge Image with Glow Effect (Clickable for Lightbox) -->
              <div class="badge-image-wrapper" @click="openLightbox" :class="{ clickable: badgeImage }">
                <div class="badge-glow"></div>
                <div class="badge-image">
                  <img v-if="badgeImage" :src="badgeImage" :alt="badgeName" @error="onImageError" />
                  <span v-else class="placeholder">🏅</span>
                </div>
                <div v-if="badgeImage" class="image-hint">Click to enlarge</div>
              </div>

              <!-- Badge Name & Description -->
              <h3 class="badge-name">{{ badgeName }}</h3>
              <p v-if="badgeDescription" class="badge-description">{{ badgeDescription }}</p>

              <!-- Status Badge -->
              <div class="status-row">
                <span :class="['status-badge', isPending ? 'pending' : 'accepted']">
                  {{ isPending ? 'Pending' : 'In Collection' }}
                </span>
                <span v-if="awardDate" class="award-date">{{ awardDate }}</span>
              </div>
            </section>

            <!-- ========================================
                 ISSUER SECTION
                 Who created and awarded this badge
                 ======================================== -->
            <section class="section">
              <h4 class="section-title">Issued By</h4>
              <div class="issuer-card">
                <img v-if="issuerPicture" :src="issuerPicture" class="issuer-avatar" @error="onAvatarError" />
                <span v-else class="issuer-avatar placeholder">👤</span>
                <div class="issuer-info">
                  <span class="issuer-name">{{ issuerName }}</span>
                  <code class="issuer-npub">{{ issuerNpubShort }}</code>
                </div>
              </div>
            </section>

            <!-- ========================================
                 OTHER OWNERS SECTION
                 People who also have this badge
                 ======================================== -->
            <section class="section">
              <div class="section-header">
                <h4 class="section-title">Badge Owners</h4>
                <button
                  v-if="!ownersLoaded && !loadingOwners"
                  class="discover-btn"
                  @click="discoverOwners"
                >
                  Discover
                </button>
              </div>

              <!-- Not Yet Loaded -->
              <div v-if="!ownersLoaded && !loadingOwners" class="owners-hint">
                <span class="hint-icon">👥</span>
                <span class="hint-text">Click "Discover" to see who else has this badge</span>
              </div>

              <!-- Loading State -->
              <div v-else-if="loadingOwners" class="owners-loading">
                <div class="loading-spinner"></div>
                <span>Searching the network...</span>
              </div>

              <!-- Owners List -->
              <div v-else-if="owners.length > 0" class="owners-list">
                <div v-for="owner in displayedOwners" :key="owner.pubkey" class="owner-item">
                  <img v-if="owner.picture" :src="owner.picture" class="owner-avatar" />
                  <span v-else class="owner-avatar placeholder">👤</span>
                  <span class="owner-name">{{ owner.name || 'Nostr User' }}</span>
                </div>

                <!-- Show More -->
                <button
                  v-if="owners.length > 5 && !showAllOwners"
                  class="show-more-btn"
                  @click="showAllOwners = true"
                >
                  +{{ owners.length - 5 }} more
                </button>
              </div>

              <!-- No Owners Found -->
              <div v-else class="owners-empty">
                <span>No other owners found yet</span>
              </div>
            </section>

            <!-- ========================================
                 BADGE METADATA
                 All available badge information
                 ======================================== -->
            <section v-if="hasExtraInfo" class="section">
              <h4 class="section-title">Badge Information</h4>
              <div class="info-grid">
                <div v-if="badgeThumb" class="info-item">
                  <span class="info-label">Thumbnail</span>
                  <img :src="badgeThumb" class="info-thumb" />
                </div>
                <div v-if="badge?.identifier" class="info-item">
                  <span class="info-label">Identifier</span>
                  <span class="info-value">{{ badge.identifier }}</span>
                </div>
                <div v-if="badge?.created_at || badge?.awarded_at" class="info-item">
                  <span class="info-label">Awarded</span>
                  <span class="info-value">{{ awardDate }}</span>
                </div>
              </div>
            </section>

            <!-- ========================================
                 TECHNICAL DETAILS (Collapsible)
                 For advanced users
                 ======================================== -->
            <details class="tech-section">
              <summary>Technical Details</summary>
              <div class="tech-content">
                <div class="tech-row">
                  <span class="tech-label">Badge A-Tag</span>
                  <code class="tech-value">{{ badge?.a_tag || '—' }}</code>
                </div>
                <div class="tech-row">
                  <span class="tech-label">Award Event ID</span>
                  <code class="tech-value">{{ badge?.award_event_id || '—' }}</code>
                </div>
                <div v-if="badge?.identifier" class="tech-row">
                  <span class="tech-label">Identifier</span>
                  <code class="tech-value">{{ badge.identifier }}</code>
                </div>
                <div v-if="badge?.issuer_hex" class="tech-row">
                  <span class="tech-label">Issuer Pubkey (hex)</span>
                  <code class="tech-value">{{ badge.issuer_hex }}</code>
                </div>
                <div v-if="badge?.issuer_npub" class="tech-row">
                  <span class="tech-label">Issuer Pubkey (npub)</span>
                  <code class="tech-value">{{ badge.issuer_npub }}</code>
                </div>
              </div>
            </details>
          </div>

          <!-- Panel Footer (Actions) -->
          <footer class="panel-footer">
            <button class="btn-secondary" @click="$emit('close')">
              Close
            </button>
            <!-- Only show action buttons if not read-only -->
            <template v-if="!readOnly">
              <button
                v-if="isPending"
                class="btn-primary"
                :disabled="loading"
                @click="$emit('accept', badge)"
              >
                <span v-if="loading" class="btn-spinner"></span>
                {{ loading ? 'Adding...' : 'Accept Badge' }}
              </button>
              <button
                v-else
                class="btn-danger"
                :disabled="loading"
                @click="$emit('remove', badge)"
              >
                <span v-if="loading" class="btn-spinner"></span>
                {{ loading ? 'Removing...' : 'Remove' }}
              </button>
            </template>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * BadgeDetailPanel Component
 *
 * Slide-over panel for viewing comprehensive badge details.
 *
 * Features:
 * - Featured badge image with glow effect
 * - Issuer information
 * - Discover other badge owners
 * - Technical details (collapsible)
 * - Accept/Remove actions
 */

import { ref, computed, watch } from 'vue'
import { api } from '@/api/client'

const props = defineProps({
  badge: { type: Object, default: null },
  isOpen: { type: Boolean, default: false },
  isPending: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false }
})

defineEmits(['close', 'accept', 'remove'])

// ===========================================
// Image Error States
// ===========================================

const imageError = ref(false)
const avatarError = ref(false)

// ===========================================
// Lightbox State
// ===========================================

/** Whether lightbox is visible */
const showLightbox = ref(false)

// ===========================================
// Owners Discovery State
// ===========================================

/** List of discovered owners */
const owners = ref([])

/** Whether owners have been loaded */
const ownersLoaded = ref(false)

/** Loading state for owners */
const loadingOwners = ref(false)

/** Show all owners (vs limited) */
const showAllOwners = ref(false)

// ===========================================
// Computed Properties
// ===========================================

const badgeName = computed(() =>
  props.badge?.badge_name || props.badge?.name || 'Unknown Badge'
)

const badgeDescription = computed(() =>
  props.badge?.badge_description || props.badge?.description || ''
)

const badgeImage = computed(() =>
  imageError.value ? null : (props.badge?.badge_image || props.badge?.image)
)

const issuerPicture = computed(() =>
  avatarError.value ? null : props.badge?.issuer_picture
)

const issuerName = computed(() =>
  props.badge?.issuer_name || 'Unknown Issuer'
)

const issuerNpubShort = computed(() => {
  const npub = props.badge?.issuer_npub
  if (!npub) return ''
  return `${npub.slice(0, 12)}...${npub.slice(-6)}`
})

const awardDate = computed(() => {
  const timestamp = props.badge?.created_at || props.badge?.awarded_at
  if (!timestamp) return null
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

/** Limit displayed owners to 5 unless expanded */
const displayedOwners = computed(() =>
  showAllOwners.value ? owners.value : owners.value.slice(0, 5)
)

/** Badge thumbnail (if different from main image) */
const badgeThumb = computed(() => {
  const thumb = props.badge?.badge_thumb || props.badge?.thumb
  // Only show if different from main image
  if (thumb && thumb !== badgeImage.value) return thumb
  return null
})

/** Whether there's extra info to display */
const hasExtraInfo = computed(() =>
  badgeThumb.value || props.badge?.identifier || props.badge?.created_at || props.badge?.awarded_at
)

// ===========================================
// Watchers
// ===========================================

// Reset state when badge changes
watch(() => props.badge, () => {
  imageError.value = false
  avatarError.value = false
  showLightbox.value = false
  owners.value = []
  ownersLoaded.value = false
  showAllOwners.value = false
})

// ===========================================
// Methods
// ===========================================

function onImageError() {
  imageError.value = true
}

function onAvatarError() {
  avatarError.value = true
}

/**
 * Open the image lightbox.
 */
function openLightbox() {
  if (badgeImage.value) {
    showLightbox.value = true
  }
}

/**
 * Discover other users who own this badge.
 * Queries the Nostr network for badge acceptance events.
 */
async function discoverOwners() {
  if (!props.badge?.a_tag) return

  loadingOwners.value = true

  try {
    const response = await api.getBadgeOwners(props.badge.a_tag)
    owners.value = response.data.owners || []
  } catch (error) {
    console.error('Failed to discover owners:', error)
    owners.value = []
  } finally {
    loadingOwners.value = false
    ownersLoaded.value = true
  }
}
</script>

<style scoped>
/* ===========================================
   Panel Backdrop & Container
   =========================================== */
.panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.panel {
  width: 100%;
  max-width: 420px;
  height: 100%;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===========================================
   Panel Header
   =========================================== */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.panel-header h2 {
  font-size: 1.125rem;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* ===========================================
   Panel Content (Scrollable)
   =========================================== */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* ===========================================
   Showcase Section
   =========================================== */
.showcase {
  text-align: center;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1.5rem;
}

.badge-image-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 1.25rem;
}

.badge-glow {
  position: absolute;
  inset: -16px;
  background: radial-gradient(circle, var(--color-primary) 0%, transparent 70%);
  opacity: 0.2;
  border-radius: 50%;
  animation: glow-pulse 3s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.1); opacity: 0.3; }
}

.badge-image {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-lg);
}

.badge-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-image .placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
}

.badge-name {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.badge-description {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.status-badge {
  padding: 0.375rem 0.875rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 600;
}

.status-badge.pending {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-badge.accepted {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.award-date {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* ===========================================
   Section Styling
   =========================================== */
.section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 0.75rem;
}

.section-header .section-title {
  margin: 0;
}

/* ===========================================
   Issuer Card
   =========================================== */
.issuer-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.issuer-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.issuer-avatar.placeholder {
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.issuer-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.issuer-name {
  font-size: 1rem;
  font-weight: 600;
}

.issuer-npub {
  font-size: 0.6875rem;
  color: var(--color-primary);
}

/* ===========================================
   Owners Discovery
   =========================================== */
.discover-btn {
  padding: 0.375rem 0.75rem;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.discover-btn:hover {
  background: var(--color-primary);
  color: white;
}

.owners-hint {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.hint-icon {
  font-size: 1.125rem;
}

.hint-text {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.owners-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.owners-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.owner-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.owner-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.owner-avatar.placeholder {
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.owner-name {
  font-size: 0.875rem;
  color: var(--color-text);
}

.show-more-btn {
  padding: 0.5rem;
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.show-more-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.owners-empty {
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* ===========================================
   Technical Details
   =========================================== */
.tech-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.tech-section summary {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
}

.tech-section summary:hover {
  color: var(--color-text);
}

.tech-content {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tech-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tech-label {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.tech-value {
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  white-space: nowrap;
}

/* ===========================================
   Panel Footer
   =========================================== */
.panel-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
}

.btn-danger {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

.btn-primary:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ===========================================
   Panel Transitions
   =========================================== */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.3s ease;
}

.panel-enter-active .panel,
.panel-leave-active .panel {
  transition: transform 0.3s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

.panel-enter-from .panel,
.panel-leave-to .panel {
  transform: translateX(100%);
}

/* ===========================================
   Scrollbar Styling
   =========================================== */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-subtle);
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 480px) {
  .panel {
    max-width: 100%;
  }
}

/* ===========================================
   Image Lightbox
   =========================================== */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  cursor: zoom-out;
}

.lightbox-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  cursor: default;
}

/* Lightbox Transitions */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.3s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

/* ===========================================
   Clickable Badge Image
   =========================================== */
.badge-image-wrapper.clickable {
  cursor: zoom-in;
}

.badge-image-wrapper.clickable:hover .badge-glow {
  opacity: 0.35;
}

.badge-image-wrapper.clickable:hover .badge-image {
  transform: scale(1.02);
}

.badge-image-wrapper .badge-image {
  transition: transform 0.2s ease;
}

.image-hint {
  position: absolute;
  bottom: -1.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
}

.badge-image-wrapper.clickable:hover .image-hint {
  opacity: 1;
}

/* ===========================================
   Info Grid (Badge Metadata)
   =========================================== */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.info-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.info-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}
</style>
