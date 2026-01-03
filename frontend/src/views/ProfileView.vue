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
      <span class="error-icon">❌</span>
      <h2>Profile not found</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">Go Home</router-link>
    </div>

    <!-- Profile Content -->
    <template v-else-if="profile">
      <!-- ========================================
           PROFILE HEADER
           User avatar, name, and about
           ======================================== -->
      <header class="profile-header">
        <!-- Banner (if available) -->
        <div v-if="profile.banner" class="profile-banner">
          <img :src="profile.banner" alt="Profile banner" @error="onBannerError" />
        </div>

        <div class="profile-main">
          <div class="profile-avatar">
            <img v-if="profile.picture" :src="profile.picture" :alt="displayName" @error="onAvatarError" />
            <span v-else class="avatar-placeholder">👤</span>
          </div>

          <div class="profile-info">
            <h1>{{ displayName }}</h1>

            <!-- NIP-05 Verification -->
            <div v-if="profile.nip05" class="profile-nip05">
              <span class="nip05-badge">✓</span>
              <span>{{ profile.nip05 }}</span>
            </div>

            <code class="profile-npub">{{ profile.npub }}</code>

            <p v-if="profile.about" class="profile-about">{{ profile.about }}</p>

            <!-- Profile Links -->
            <div v-if="profile.website || profile.lud16" class="profile-links">
              <a v-if="profile.website" :href="profile.website" target="_blank" rel="noopener" class="profile-link">
                <span class="link-icon">🌐</span>
                {{ cleanWebsiteUrl }}
              </a>
              <span v-if="profile.lud16" class="profile-link lightning">
                <span class="link-icon">⚡</span>
                {{ profile.lud16 }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <!-- ========================================
           BADGES COLLECTION
           Grid of accepted badges
           ======================================== -->
      <section class="badges-section">
        <div class="section-header">
          <h2>Collection</h2>
          <span class="badge-count">{{ badges.accepted.length }} badges</span>
        </div>

        <!-- Empty State -->
        <div v-if="badges.accepted.length === 0" class="empty-badges">
          <span class="empty-icon">🏅</span>
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
import { api } from '@/api/client'
import ProfileSkeleton from '@/components/profile/ProfileSkeleton.vue'
import CollectionBadgeCard from '@/components/badges/CollectionBadgeCard.vue'
import BadgeDetailPanel from '@/components/badges/BadgeDetailPanel.vue'

const route = useRoute()
const authStore = useAuthStore()

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

// ===========================================
// Computed Properties
// ===========================================

const pubkey = computed(() => route.params.pubkey || authStore.npub)

const displayName = computed(() => {
  if (!profile.value) return 'Unknown'
  return profile.value.display_name || profile.value.name || 'Anonymous'
})

const cleanWebsiteUrl = computed(() => {
  if (!profile.value?.website) return ''
  return profile.value.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
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
  if (profile.value) profile.value.banner = null
}

function onAvatarError() {
  avatarError.value = true
  if (profile.value) profile.value.picture = null
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

.error-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
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
   Profile Header
   =========================================== */
.profile-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  margin-bottom: 2rem;
  overflow: hidden;
}

.profile-banner {
  height: 160px;
  overflow: hidden;
  background: var(--color-surface-elevated);
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-main {
  display: flex;
  gap: 2rem;
  padding: 2rem;
}

.profile-header:has(.profile-banner) .profile-main {
  margin-top: -3rem;
}

.profile-avatar {
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid var(--color-surface);
  box-shadow: var(--shadow-md);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 4rem;
}

.profile-info {
  flex: 1;
  min-width: 0;
  padding-top: 0.5rem;
}

.profile-info h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.profile-nip05 {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-success);
}

.nip05-badge {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-success);
  color: white;
  border-radius: 50%;
  font-size: 0.625rem;
}

.profile-npub {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  word-break: break-all;
  margin-bottom: 1rem;
}

.profile-about {
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.profile-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.profile-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-primary);
  text-decoration: none;
}

.profile-link:hover {
  text-decoration: underline;
}

.profile-link.lightning {
  color: var(--color-warning);
}

.link-icon {
  font-size: 0.875rem;
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

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  opacity: 0.5;
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
}

/* ===========================================
   Mobile Responsive
   =========================================== */
@media (max-width: 640px) {
  .profile-main {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-info {
    padding-top: 0;
  }

  .profile-links {
    justify-content: center;
  }

  .badges-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
