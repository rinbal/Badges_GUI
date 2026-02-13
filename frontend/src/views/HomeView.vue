<template>
  <div class="home">
    <!-- =========================================
         1. Hero Section
         ========================================= -->
    <section class="hero">
      <div class="hero-content">
        <!-- Animated Gradient Logo -->
        <h1 class="hero-title">
          <GradientText
            text="BadgeBox"
            :colors="['#9d4edd', '#f59e0b', '#9d4edd', '#f59e0b']"
            :animation-speed="6"
          />
        </h1>
        <p class="hero-subtitle">
          Create, award, and collect verifiable badges on the decentralized Nostr network.
          No databases, no middlemen — just cryptographic proof.
        </p>

        <!-- CTAs: Different for logged in vs logged out -->
        <div class="hero-actions">
          <template v-if="isAuthenticated">
            <router-link to="/creator" class="btn btn-primary btn-lg">
              <Icon name="sparkles" size="md" />
              <span>Create Badge</span>
            </router-link>
            <router-link to="/inbox" class="btn btn-secondary btn-lg">
              <Icon name="inbox" size="md" />
              <span>My Inbox</span>
              <span v-if="badgesStore.pendingCount > 0" class="badge-count">
                {{ badgesStore.pendingCount }}
              </span>
            </router-link>
          </template>
          <template v-else>
            <button @click="openLoginModal" class="btn btn-primary btn-lg">
              <Icon name="key" size="md" />
              <span>Connect with Nostr</span>
            </button>
            <router-link to="/surf" class="btn btn-secondary btn-lg">
              <Icon name="globe" size="md" />
              <span>Explore Badges</span>
            </router-link>
          </template>
        </div>
      </div>
    </section>

    <!-- =========================================
         2. Badge Showcase Carousel
         ========================================= -->
    <section class="badge-showcase">
      <div class="section-header">
        <h2>Popular Badges</h2>
        <router-link to="/surf" class="browse-link">
          Browse all
          <Icon name="arrow-right" size="sm" />
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="isLoadingShowcase" class="carousel-loading">
        <BadgeCardSkeleton v-for="i in 4" :key="i" />
      </div>

      <!-- Carousel -->
      <div v-else-if="showcaseBadges.length > 0" class="carousel-container">
        <div class="carousel-track" :style="marqueeStyle">
          <div
            v-for="badge in showcaseBadges"
            :key="badge.a_tag"
            class="carousel-item"
          >
            <SurfBadgeCard
              :badge="badge"
              @click="handleBadgeClick(badge)"
            />
          </div>
          <!-- Duplicate set for seamless loop -->
          <div
            v-for="badge in showcaseBadges"
            :key="'dup-' + badge.a_tag"
            class="carousel-item"
            aria-hidden="true"
          >
            <SurfBadgeCard
              :badge="badge"
              @click="handleBadgeClick(badge)"
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="showcase-empty">
        <Icon name="award" size="lg" />
        <p>No badges to display</p>
      </div>
    </section>

    <!-- =========================================
         3. How It Works
         ========================================= -->
    <section class="how-it-works">
      <h2>How it works</h2>
      <div class="steps">
        <div class="step">
          <div class="step-icon step-icon-create">
            <Icon name="sparkles" size="md" />
          </div>
          <div class="step-content">
            <h3>Create or Choose</h3>
            <p>Design a custom badge or pick from ready-made templates</p>
          </div>
        </div>
        <div class="step-connector">
          <Icon name="chevron-right" size="sm" />
        </div>
        <div class="step">
          <div class="step-icon step-icon-award">
            <Icon name="send" size="md" />
          </div>
          <div class="step-content">
            <h3>Award</h3>
            <p>Send badges to any Nostr user via their npub address</p>
          </div>
        </div>
        <div class="step-connector">
          <Icon name="chevron-right" size="sm" />
        </div>
        <div class="step">
          <div class="step-icon step-icon-accept">
            <Icon name="check-circle" size="md" />
          </div>
          <div class="step-content">
            <h3>Accept & Display</h3>
            <p>Recipients accept badges to add them to their profile</p>
          </div>
        </div>
      </div>
    </section>

    <!-- =========================================
         4. Quick Actions (Logged in only)
         ========================================= -->
    <section v-if="isAuthenticated" class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="actions-grid">
        <router-link to="/creator" class="action-card action-card-create">
          <div class="action-icon">
            <Icon name="sparkles" size="lg" />
          </div>
          <div class="action-content">
            <h3>Create Badge</h3>
            <p>Design and publish new badges</p>
          </div>
        </router-link>

        <router-link to="/inbox" class="action-card action-card-inbox">
          <div class="action-icon">
            <Icon name="inbox" size="lg" />
          </div>
          <div class="action-content">
            <h3>My Inbox</h3>
            <p>Badges awaiting your action</p>
          </div>
          <span v-if="badgesStore.pendingCount > 0" class="action-badge">
            {{ badgesStore.pendingCount }}
          </span>
        </router-link>

        <router-link to="/requests" class="action-card action-card-requests">
          <div class="action-icon">
            <Icon name="mail" size="lg" />
          </div>
          <div class="action-content">
            <h3>Requests</h3>
            <p>Manage badge requests</p>
          </div>
          <span v-if="requestsStore.pendingCount > 0" class="action-badge">
            {{ requestsStore.pendingCount }}
          </span>
        </router-link>

        <router-link to="/issued" class="action-card action-card-issued">
          <div class="action-icon">
            <Icon name="certificate" size="lg" />
          </div>
          <div class="action-content">
            <h3>Issued Badges</h3>
            <p>Badges you've created</p>
          </div>
        </router-link>
      </div>
    </section>

    <!-- =========================================
         5. New to Nostr (Logged out only)
         ========================================= -->
    <section v-if="!isAuthenticated" class="new-to-nostr">
      <div class="nostr-content">
        <h3>New to Nostr?</h3>
        <p>
          Nostr is a decentralized protocol for social networking. You own your identity
          with cryptographic keys instead of usernames and passwords controlled by corporations.
        </p>
        <div class="nostr-benefits">
          <div class="benefit">
            <Icon name="key" size="md" />
            <span>Own your data</span>
          </div>
          <div class="benefit">
            <Icon name="shield" size="md" />
            <span>Censorship resistant</span>
          </div>
          <div class="benefit">
            <Icon name="globe" size="md" />
            <span>Works everywhere</span>
          </div>
        </div>
        <a
          href="https://nostr.how/en/get-started"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-outline"
        >
          <span>Get Started with Nostr</span>
          <Icon name="external-link" size="sm" />
        </a>
      </div>
    </section>

    <!-- =========================================
         6. Protocol Section
         ========================================= -->
    <section class="protocol-section">
      <div class="protocol-header">
        <Icon name="bolt" size="lg" class="protocol-icon" />
        <h2>Built on Open Standards</h2>
        <p>Interoperable with any Nostr client that supports NIP-58</p>
      </div>

      <div class="protocol-cards">
        <!-- NIP-58 Core -->
        <div class="protocol-card">
          <div class="protocol-card-header">
            <span class="protocol-card-emoji">🏅</span>
            <h3>NIP-58 Core</h3>
            <button
              class="info-btn"
              @click="toggleProtocolInfo('nip58')"
              :class="{ active: activeProtocolInfo === 'nip58' }"
              aria-label="Toggle NIP-58 info"
            >
              <Icon name="info" size="xs" />
            </button>
          </div>
          <div v-if="activeProtocolInfo === 'nip58'" class="info-accordion">
            <p>NIP-58 defines how badges work on Nostr. Creators publish badge definitions, award them to users, and recipients can display them on their profile.</p>
            <a
              href="https://github.com/nostr-protocol/nips/blob/master/58.md"
              target="_blank"
              rel="noopener noreferrer"
              class="info-link"
            >
              Read the spec <Icon name="external-link" size="xs" />
            </a>
          </div>
          <div class="kind-chips">
            <button class="kind-chip" @click="showKindInfo('30009')">
              <code>30009</code>
              <span>Definition</span>
            </button>
            <button class="kind-chip" @click="showKindInfo('8')">
              <code>8</code>
              <span>Award</span>
            </button>
            <button class="kind-chip" @click="showKindInfo('30008')">
              <code>30008</code>
              <span>Profile</span>
            </button>
          </div>
        </div>

        <!-- Request Extension -->
        <div class="protocol-card protocol-card-extension">
          <div class="protocol-card-header">
            <span class="protocol-card-emoji">✨</span>
            <h3>Request Extension</h3>
            <span class="new-tag">NEW on NOSTR</span>
            <button
              class="info-btn"
              @click="toggleProtocolInfo('request')"
              :class="{ active: activeProtocolInfo === 'request' }"
              aria-label="Toggle request extension info"
            >
              <Icon name="info" size="xs" />
            </button>
          </div>
          <div v-if="activeProtocolInfo === 'request'" class="info-accordion">
            <p>Our extension to NIP-58 enables users to request badges from creators. Submit proof of eligibility, track your requests, and get notified when approved!</p>
            <span class="info-status">📝 PR coming soon</span>
          </div>
          <div class="kind-chips">
            <button class="kind-chip" @click="showKindInfo('30058')">
              <code>30058</code>
              <span>Request</span>
            </button>
            <button class="kind-chip" @click="showKindInfo('30059')">
              <code>30059</code>
              <span>Response</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Kind Info Modal -->
    <Transition name="modal">
      <div
        v-if="activeKindInfo"
        class="kind-modal-overlay"
        @click="activeKindInfo = null"
        @keydown.escape="activeKindInfo = null"
      >
        <div class="kind-modal" @click.stop>
          <button
            class="modal-close"
            @click="activeKindInfo = null"
            aria-label="Close modal"
          >
            <Icon name="x" size="sm" />
          </button>
          <code class="kind-code">kind: {{ activeKindInfo }}</code>
          <h4>{{ kindInfoData[activeKindInfo]?.title }}</h4>
          <p>{{ kindInfoData[activeKindInfo]?.description }}</p>
        </div>
      </div>
    </Transition>

    <!-- =========================================
         7. Footer
         ========================================= -->
    <footer class="home-footer">
      <p class="footer-line">
        Built by
        <a href="https://github.com/rinbal" target="_blank" rel="noopener noreferrer">rinbal</a>
      </p>
     <!-- <p class="footer-line footer-secondary">
        Payment infrastructure by
        <a href="https://aurorapay.me" target="_blank" rel="noopener noreferrer">AuroraPay</a>
      </p> -->
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useRequestsStore } from '@/stores/requests'
import { useUIStore } from '@/stores/ui'
import { api } from '@/api/client'
import Icon from '@/components/common/Icon.vue'
import GradientText from '@/components/common/GradientText.vue'
import SurfBadgeCard from '@/components/surf/SurfBadgeCard.vue'
import BadgeCardSkeleton from '@/components/surf/BadgeCardSkeleton.vue'

// Stores
const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const requestsStore = useRequestsStore()
const uiStore = useUIStore()

// Computed
const isAuthenticated = computed(() => authStore.isAuthenticated)

// Local State
const isLoadingShowcase = ref(true)
const showcaseBadgesRaw = ref([])
const activeProtocolInfo = ref(null) // 'nip58' | 'request' | null
const activeKindInfo = ref(null) // '30009' | '8' | etc | null

// Computed: Filter badges to only those with images (show more for carousel)
const showcaseBadges = computed(() => {
  return showcaseBadgesRaw.value
    .filter(badge => badge.image || badge.thumb)
    .slice(0, 12)
})

// Marquee animation: compute duration and offset from item count
// Each item is 180px wide + 1rem (16px) gap = 196px per item
const ITEM_WIDTH = 196 // 180px card + 16px gap
const SCROLL_SPEED = 40 // pixels per second

const marqueeStyle = computed(() => {
  const count = showcaseBadges.value.length
  if (!count) return {}
  const setWidth = count * ITEM_WIDTH
  const duration = setWidth / SCROLL_SPEED
  return {
    '--set-width': `${setWidth}px`,
    '--marquee-duration': `${duration}s`
  }
})

// Kind info data
const kindInfoData = {
  '30009': {
    title: 'Badge Definition',
    description: 'The blueprint for a badge. Contains the name, description, image, and criteria. Created by badge issuers.'
  },
  '8': {
    title: 'Badge Award',
    description: 'Issued when someone awards a badge to a recipient. Links the badge definition to the person receiving it.'
  },
  '30008': {
    title: 'Profile Badges',
    description: 'A user\'s curated collection of accepted badges. Controls which badges appear on their Nostr profile.'
  },
  '30058': {
    title: 'Badge Request',
    description: 'Sent by users to request a badge from a creator. Can include proof of eligibility and a personal message.'
  },
  '30059': {
    title: 'Request Response',
    description: 'The creator\'s response to a request. Can approve (triggers badge award) or deny with a reason.'
  }
}

// Methods
function toggleProtocolInfo(section) {
  activeProtocolInfo.value = activeProtocolInfo.value === section ? null : section
}

function showKindInfo(kind) {
  activeKindInfo.value = kind
}

function handleBadgeClick(badge) {
  if (!isAuthenticated.value) {
    uiStore.openLoginPrompt(badge)
    return
  }
  uiStore.openBadgeDetail(badge.a_tag, badge)
}

function openLoginModal() {
  uiStore.openModal('login')
}

// Keyboard handler for Escape
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (activeKindInfo.value) {
      activeKindInfo.value = null
    }
  }
}

// Fetch showcase badges (public endpoint - works for all users)
async function fetchShowcaseBadges() {
  isLoadingShowcase.value = true

  try {
    // Fetch popular badges - public endpoint, no auth required
    const response = await api.getPopularBadges(18)
    const badges = response.data.badges || []

    // Filter to only those with images and store
    showcaseBadgesRaw.value = badges.filter(b => b.image || b.thumb)
  } catch (err) {
    console.error('Failed to fetch showcase badges:', err)
    // Silent failure - not critical to UX
  } finally {
    isLoadingShowcase.value = false
  }
}

// Lifecycle
onMounted(async () => {
  // Always fetch showcase badges
  fetchShowcaseBadges()

  // Keyboard listener
  window.addEventListener('keydown', handleKeydown)

  // Fetch user data when authenticated
  if (isAuthenticated.value) {
    try {
      await Promise.all([
        badgesStore.fetchPendingBadges(),
        requestsStore.fetchIncomingCount()
      ])
    } catch (err) {
      console.error('Failed to fetch user data:', err)
      // Graceful degradation - counts show 0
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* =========================================
   Layout
   ========================================= */
.home {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
}

/* =========================================
   1. Hero Section
   ========================================= */
.hero {
  text-align: center;
  padding: 3.5rem 0 2.5rem;
}

.hero-content {
  max-width: 640px;
  margin: 0 auto;
}

.hero-title {
  margin: 0 0 1.25rem 0;
  font-size: 4rem;
  line-height: 1.1;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: var(--color-text-muted);
  margin: 0 0 2rem 0;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg);
  text-decoration: none;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-lg {
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-outline:hover {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--color-accent);
  color: #000;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: var(--radius-full);
}

/* =========================================
   2. Badge Showcase Carousel
   ========================================= */
.badge-showcase {
  padding: 2rem 0;
  /* Allow carousel to extend beyond container */
  margin-left: -1rem;
  margin-right: -1rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.section-header h2 {
  font-size: 1.375rem;
  margin: 0;
}

.browse-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
}

.browse-link:hover {
  color: var(--color-primary-hover);
}

/* Carousel Loading */
.carousel-loading {
  display: flex;
  gap: 1rem;
  overflow: hidden;
}

.carousel-loading > * {
  flex: 0 0 180px;
  display: flex;
}

/* Carousel Container */
.carousel-container {
  overflow: hidden;
  position: relative;
}

/* Fade edges to hint there's more content */
.carousel-container::before,
.carousel-container::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2rem;
  z-index: 2;
  pointer-events: none;
}

.carousel-container::before {
  left: 0;
  background: linear-gradient(to right, var(--color-background), transparent);
}

.carousel-container::after {
  right: 0;
  background: linear-gradient(to left, var(--color-background), transparent);
}

/* Carousel Track — infinite marquee via CSS transform */
.carousel-track {
  display: flex;
  gap: 1rem;
  width: max-content;
  padding: 0.5rem 0;
  animation: marquee var(--marquee-duration, 60s) linear infinite;
  will-change: transform;
}

.carousel-container:hover .carousel-track {
  animation-play-state: paused;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(calc(var(--set-width, 0px) * -1));
  }
}

/* Carousel Item */
.carousel-item {
  flex: 0 0 180px;
  display: flex;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .carousel-track {
    animation: none;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .carousel-track::-webkit-scrollbar {
    display: none;
  }
}

.showcase-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.showcase-empty p {
  margin-top: 0.5rem;
}

/* =========================================
   3. How It Works
   ========================================= */
.how-it-works {
  padding: 2rem 0;
  text-align: center;
}

.how-it-works h2 {
  font-size: 1.375rem;
  margin-bottom: 2rem;
}

.steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 1rem;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 180px;
}

.step-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
  color: white;
}

.step-icon-create {
  background: var(--color-primary);
}

.step-icon-award {
  background: var(--color-accent);
}

.step-icon-accept {
  background: var(--color-success);
}

.step-content h3 {
  font-size: 1rem;
  margin-bottom: 0.375rem;
}

.step-content p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

.step-connector {
  display: flex;
  align-items: center;
  color: var(--color-text-subtle);
  padding-top: 1rem;
}

/* =========================================
   4. Quick Actions
   ========================================= */
.quick-actions {
  padding: 2rem 0;
}

.quick-actions h2 {
  font-size: 1.375rem;
  margin-bottom: 1.25rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.action-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: all 0.2s ease;
}

.action-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.action-card-create .action-icon {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.action-card-inbox .action-icon {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.action-card-requests .action-icon {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.action-card-issued .action-icon {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.action-content h3 {
  font-size: 1rem;
  margin: 0 0 0.25rem 0;
  color: var(--color-text);
}

.action-content p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

.action-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: var(--color-accent);
  color: #000;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: var(--radius-full);
}

/* =========================================
   5. New to Nostr
   ========================================= */
.new-to-nostr {
  padding: 2rem;
  margin-top: 1rem;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-accent-soft) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
}

.nostr-content h3 {
  font-size: 1.375rem;
  margin-bottom: 0.75rem;
}

.nostr-content > p {
  color: var(--color-text-muted);
  max-width: 500px;
  margin: 0 auto 1.5rem;
  line-height: 1.6;
}

.nostr-benefits {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.benefit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.benefit svg {
  color: var(--color-primary);
}

/* =========================================
   6. Protocol Section
   ========================================= */
.protocol-section {
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-top: 2rem;
}

.protocol-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.protocol-icon {
  color: var(--color-accent);
  margin-bottom: 0.5rem;
}

.protocol-header h2 {
  font-size: 1.375rem;
  margin: 0 0 0.5rem 0;
}

.protocol-header p {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.9375rem;
}

.protocol-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.protocol-card {
  padding: 1.25rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s ease;
}

.protocol-card:hover {
  border-color: var(--color-primary-soft);
}

.protocol-card-extension {
  background: linear-gradient(135deg, var(--color-surface-elevated) 0%, var(--color-primary-soft) 100%);
}

.protocol-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.protocol-card-emoji {
  font-size: 1.25rem;
}

.protocol-card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.new-tag {
  padding: 0.125rem 0.5rem;
  background: var(--color-primary);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  border-radius: var(--radius-full);
  letter-spacing: 0.05em;
}

.info-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.info-btn:hover,
.info-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.info-accordion {
  padding: 1rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-accordion p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.info-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
}

.info-link:hover {
  text-decoration: underline;
}

.info-status {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
}

.kind-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.kind-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.kind-chip:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.kind-chip:active {
  transform: scale(0.98);
}

.kind-chip code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.kind-chip span {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Kind Info Modal */
.kind-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.kind-modal {
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 340px;
  width: 100%;
  box-shadow: var(--shadow-xl);
}

.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.kind-code {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
}

.kind-modal h4 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.kind-modal p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .kind-modal,
.modal-leave-active .kind-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from .kind-modal {
  transform: scale(0.95);
}

.modal-leave-to .kind-modal {
  transform: scale(0.95);
}

/* =========================================
   7. Footer
   ========================================= */
.home-footer {
  margin-top: 3rem;
  padding: 2rem 0;
  border-top: 1px solid var(--color-border);
  text-align: center;
}

.footer-line {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.footer-line a {
  color: var(--color-text);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-line a:hover {
  color: var(--color-primary);
}

.footer-secondary {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
}

/* =========================================
   Responsive - Tablet (768px)
   ========================================= */
@media (max-width: 768px) {
  .hero-title {
    font-size: 3.25rem;
  }

  .protocol-cards {
    grid-template-columns: 1fr;
  }
}

/* =========================================
   Responsive - Mobile (480px)
   ========================================= */
@media (max-width: 480px) {
  .home {
    padding: 0 0.75rem 1.5rem;
  }

  .hero {
    padding: 2.5rem 0 2rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-actions .btn {
    width: 100%;
    justify-content: center;
  }

  /* Carousel adjustments */
  .carousel-item {
    flex: 0 0 160px;
    display: flex;
  }

  .badge-showcase {
    margin-left: -0.75rem;
    margin-right: -0.75rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  /* How it works - vertical layout */
  .steps {
    flex-direction: column;
    gap: 0.75rem;
  }

  .step {
    flex-direction: row;
    max-width: 100%;
    text-align: left;
    gap: 1rem;
  }

  .step-icon {
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .step-connector {
    transform: rotate(90deg);
    padding: 0;
  }

  /* Quick actions - single column */
  .actions-grid {
    grid-template-columns: 1fr;
  }

  /* New to Nostr */
  .new-to-nostr {
    padding: 1.5rem;
  }

  .nostr-benefits {
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  /* Protocol section */
  .protocol-section {
    padding: 1.5rem;
  }

  .protocol-header h2 {
    font-size: 1.25rem;
  }
}
</style>
