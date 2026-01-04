<template>
  <!--
    ProfileView
    Public profile page displaying user info and their badge collection.
    Uses skeleton loading states and the collection badge card components.
  -->
  <div class="profile">
    <!-- Loading State (Skeleton) -->
    <ProfileSkeleton v-if="isLoading" />

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon-wrapper">
        <Icon name="alert-circle" size="xl" />
      </div>
      <h2>Profile not found</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">
        <Icon name="home" size="sm" />
        Go Home
      </router-link>
    </div>

    <!-- Profile Content -->
    <template v-else-if="profile">
      <!-- ========================================
           PROFILE HEADER CARD
           Banner, avatar, and profile metadata
           ======================================== -->
      <header class="profile-header">
        <!-- Banner -->
        <div class="profile-banner" :class="{ 'has-image': profile.banner && !bannerError }">
          <img
            v-if="profile.banner && !bannerError"
            :src="profile.banner"
            alt="Profile banner"
            @error="onBannerError"
          />
          <div v-else class="banner-gradient"></div>
        </div>

        <!-- Avatar positioned over banner -->
        <div class="avatar-wrapper">
          <div class="profile-avatar">
            <img
              v-if="profile.picture && !avatarError"
              :src="profile.picture"
              :alt="displayName"
              @error="onAvatarError"
            />
            <div v-else class="avatar-placeholder">
              <Icon name="user" size="xl" />
            </div>
          </div>
        </div>

        <!-- Profile Info Section -->
        <div class="profile-content">
          <!-- Name & Verification -->
          <div class="profile-identity">
            <h1 class="profile-name">{{ displayName }}</h1>
            <div v-if="profile.nip05" class="nip05-badge">
              <Icon name="check-circle" size="sm" class="nip05-icon" />
              <span>{{ profile.nip05 }}</span>
            </div>
          </div>

          <!-- About/Bio -->
          <p v-if="profile.about" class="profile-about">{{ profile.about }}</p>

          <!-- Metadata Grid -->
          <div class="profile-meta">
            <!-- npub -->
            <div class="meta-item meta-npub">
              <Icon name="key" size="sm" class="meta-icon" />
              <code class="npub-text">{{ truncatedNpub }}</code>
              <button @click="copyNpub" class="copy-btn" title="Copy full npub">
                <Icon :name="copied ? 'check' : 'copy'" size="xs" />
              </button>
            </div>

            <!-- Website -->
            <a
              v-if="profile.website"
              :href="websiteUrl"
              target="_blank"
              rel="noopener"
              class="meta-item meta-link"
            >
              <Icon name="globe" size="sm" class="meta-icon" />
              <span>{{ cleanWebsiteUrl }}</span>
              <Icon name="external-link" size="xs" class="external-icon" />
            </a>

            <!-- Lightning Address -->
            <a
              v-if="profile.lud16"
              :href="`lightning:${profile.lud16}`"
              class="meta-item meta-link meta-lightning"
            >
              <Icon name="bolt" size="sm" class="meta-icon" />
              <span>{{ profile.lud16 }}</span>
            </a>
          </div>
        </div>
      </header>

      <!-- ========================================
           BADGES COLLECTION
           Grid of accepted badges
           ======================================== -->
      <section class="badges-section">
        <div class="section-header">
          <div class="section-title">
            <Icon name="award" size="md" class="section-icon" />
            <h2>Collection</h2>
          </div>
          <span class="badge-count">{{ badges.accepted.length }} badges</span>
        </div>

        <!-- Empty State -->
        <div v-if="badges.accepted.length === 0" class="empty-badges">
          <div class="empty-icon-wrapper">
            <Icon name="medal" size="xl" />
          </div>
          <p>No badges displayed yet</p>
          <span class="empty-hint">Badges accepted by this user will appear here</span>
        </div>

        <!-- Badges Grid -->
        <div v-else class="badges-grid">
          <CollectionBadgeCard
            v-for="badge in badges.accepted"
            :key="badge.award_event_id"
            :badge="badge"
            @click="openBadgeDetail"
          />
        </div>
      </section>
    </template>

    <!-- Badge Detail Panel (Read-only for public profiles) -->
    <BadgeDetailPanel
      :badge="selectedBadge"
      :is-open="showBadgePanel"
      :is-pending="false"
      :loading="false"
      :read-only="true"
      @close="closeBadgePanel"
    />
  </div>
</template>

<script setup>
/**
 * ProfileView Component
 *
 * Displays a public Nostr profile with their accepted badges.
 *
 * Features:
 * - Profile header with avatar, banner, and metadata
 * - NIP-05 verification display
 * - Badge collection grid
 * - Badge detail panel slide-over
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { api } from '@/api/client'
import Icon from '@/components/common/Icon.vue'
import ProfileSkeleton from '@/components/profile/ProfileSkeleton.vue'
import CollectionBadgeCard from '@/components/badges/CollectionBadgeCard.vue'
import BadgeDetailPanel from '@/components/badges/BadgeDetailPanel.vue'

const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

// ===========================================
// State
// ===========================================

const isLoading = ref(true)
const error = ref(null)
const profile = ref(null)
const badges = ref({ accepted: [], pending: [] })

// Badge detail panel state
const selectedBadge = ref(null)
const showBadgePanel = ref(false)

// Image error states
const bannerError = ref(false)
const avatarError = ref(false)

// Copy state
const copied = ref(false)

// ===========================================
// Computed Properties
// ===========================================

const pubkey = computed(() => route.params.pubkey || authStore.npub)

const displayName = computed(() => {
  if (!profile.value) return 'Unknown'
  return profile.value.display_name || profile.value.name || 'Anonymous'
})

const truncatedNpub = computed(() => {
  const npub = profile.value?.npub
  if (!npub) return ''
  return `${npub.slice(0, 16)}...${npub.slice(-8)}`
})

const cleanWebsiteUrl = computed(() => {
  if (!profile.value?.website) return ''
  return profile.value.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
})

const websiteUrl = computed(() => {
  const website = profile.value?.website
  if (!website) return '#'
  return website.startsWith('http') ? website : `https://${website}`
})

// ===========================================
// Lifecycle
// ===========================================

onMounted(() => {
  loadProfile()
})

watch(() => route.params.pubkey, () => {
  loadProfile()
})

// ===========================================
// Methods
// ===========================================

async function loadProfile() {
  if (!pubkey.value) {
    error.value = 'No public key provided'
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = null
  bannerError.value = false
  avatarError.value = false

  try {
    const [profileRes, badgesRes] = await Promise.all([
      api.getProfile(pubkey.value),
      api.getProfileBadges(pubkey.value)
    ])

    profile.value = profileRes.data
    badges.value = badgesRes.data
  } catch (err) {
    error.value = err.response?.data?.detail || err.message
  } finally {
    isLoading.value = false
  }
}

function openBadgeDetail(badge) {
  selectedBadge.value = badge
  showBadgePanel.value = true
}

function closeBadgePanel() {
  showBadgePanel.value = false
  // Delay clearing badge to allow transition
  setTimeout(() => {
    selectedBadge.value = null
  }, 300)
}

function onBannerError() {
  bannerError.value = true
}

function onAvatarError() {
  avatarError.value = true
}

async function copyNpub() {
  if (!profile.value?.npub) return
  try {
    await navigator.clipboard.writeText(profile.value.npub)
    copied.value = true
    uiStore.showSuccess('Copied to clipboard')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    uiStore.showError('Failed to copy')
  }
}
</script>

<style scoped>
/* ===========================================
   Layout
   =========================================== */
.profile {
  max-width: 800px;
  margin: 0 auto;
}

/* ===========================================
   Error State
   =========================================== */
.error-state {
  text-align: center;
  padding: 4rem 2rem;
}

.error-icon-wrapper {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-danger-soft);
  border-radius: 50%;
  color: var(--color-danger);
}

.error-state h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.error-state p {
  color: var(--color-text-muted);
  margin: 0 0 1.5rem 0;
}

/* ===========================================
   Profile Header Card
   =========================================== */
.profile-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  margin-bottom: 2rem;
  overflow: hidden;
}

/* Banner */
.profile-banner {
  height: 180px;
  position: relative;
  overflow: hidden;
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent, #7c3aed) 100%);
}

/* Avatar */
.avatar-wrapper {
  display: flex;
  justify-content: center;
  margin-top: -60px;
  position: relative;
  z-index: 1;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid var(--color-surface);
  box-shadow: var(--shadow-lg);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
}

/* Profile Content */
.profile-content {
  padding: 1rem 2rem 2rem;
  text-align: center;
}

.profile-identity {
  margin-bottom: 1rem;
}

.profile-name {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.nip05-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  background: var(--color-success-soft);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  color: var(--color-success);
}

.nip05-icon {
  flex-shrink: 0;
}

.profile-about {
  color: var(--color-text-muted);
  line-height: 1.7;
  margin: 0 0 1.5rem 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* Metadata Grid */
.profile-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  color: var(--color-text);
  transition: all 0.2s ease;
}

.meta-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.meta-npub {
  font-family: var(--font-mono);
}

.npub-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.meta-link {
  text-decoration: none;
  cursor: pointer;
}

.meta-link:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.meta-link:hover .meta-icon {
  color: var(--color-primary);
}

.external-icon {
  color: var(--color-text-subtle);
  margin-left: -0.25rem;
}

.meta-lightning .meta-icon {
  color: var(--color-warning);
}

.meta-lightning:hover {
  border-color: var(--color-warning);
  background: rgba(234, 179, 8, 0.1);
}

/* ===========================================
   Badges Section
   =========================================== */
.badges-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  color: var(--color-primary);
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.badge-count {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  padding: 0.25rem 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
}

/* Empty State */
.empty-badges {
  text-align: center;
  padding: 3rem 2rem;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border-radius: 50%;
  color: var(--color-text-muted);
}

.empty-badges p {
  font-size: 1rem;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* Badges Grid */
.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

/* ===========================================
   Buttons
   =========================================== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 640px) {
  .profile-banner {
    height: 140px;
  }

  .avatar-wrapper {
    margin-top: -50px;
  }

  .profile-avatar {
    width: 100px;
    height: 100px;
  }

  .profile-content {
    padding: 1rem 1.5rem 1.5rem;
  }

  .profile-name {
    font-size: 1.5rem;
  }

  .profile-meta {
    flex-direction: column;
    align-items: center;
  }

  .meta-item {
    width: 100%;
    justify-content: center;
  }

  .badges-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
