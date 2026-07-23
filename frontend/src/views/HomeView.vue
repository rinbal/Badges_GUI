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
          No databases, no middlemen. Just cryptographic proof.
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
         2b. Community Chat (embedded NIP-29 group)
         ========================================= -->
    <section class="community-chat-section">
      <GroupChat />
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

        <button class="action-card action-card-support" @click="uiStore.openChat()">
          <div class="action-icon">
            <Icon name="message-circle" size="lg" />
          </div>
          <div class="action-content">
            <h3>Feedback & Support</h3>
            <p>Chat with the developer</p>
          </div>
        </button>
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
        <div class="nostr-ctas">
          <a
            href="https://nostrid.mybuho.de"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-outline"
          >
            <span>Get your own Identity</span>
            <Icon name="external-link" size="sm" />
          </a>
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
      </div>
    </section>

    <!-- =========================================
         6. Footer
         ========================================= -->
    <footer class="home-footer">
      <p class="footer-line">
        Built by
        <a href="https://github.com/rinbal" target="_blank" rel="noopener noreferrer">rinbal</a>
        <span class="footer-dot">·</span>
        <router-link to="/about">About BadgeBox</router-link>
      </p>
     <!-- <p class="footer-line footer-secondary">
        Payment infrastructure by
        <a href="https://aurorapay.me" target="_blank" rel="noopener noreferrer">AuroraPay</a>
      </p> -->
      <p class="footer-line footer-version">
        <AppVersion />
      </p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useRequestsStore } from '@/stores/requests'
import { useUIStore } from '@/stores/ui'
import { api } from '@/api/client'
import Icon from '@/components/common/Icon.vue'
import GradientText from '@/components/common/GradientText.vue'
import SurfBadgeCard from '@/components/surf/SurfBadgeCard.vue'
import BadgeCardSkeleton from '@/components/surf/BadgeCardSkeleton.vue'
import GroupChat from '@/components/chat/GroupChat.vue'
import AppVersion from '@/components/common/AppVersion.vue'

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

// Methods
function handleBadgeClick(badge) {
  if (!isAuthenticated.value) {
    uiStore.openLoginPrompt(badge)
    return
  }
  uiStore.openBadgeDetail(badge.a_tag, badge)
}

function openLoginModal() {
  uiStore.openLoginPrompt()
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

/* Carousel Track - infinite marquee via CSS transform */
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
  grid-template-columns: repeat(3, 1fr);
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
  text-align: left;
  cursor: pointer;
  font-family: inherit;
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

.action-card-support .action-icon {
  background: rgba(157, 78, 221, 0.12);
  color: #9d4edd;
}

.community-chat-section {
  margin-top: 3rem;
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

.nostr-ctas {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.benefit svg {
  color: var(--color-primary);
}

/* =========================================
   6. Footer
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

.footer-dot {
  margin: 0 0.5rem;
  color: var(--color-text-subtle);
}
.footer-version {
  margin-top: 0.75rem;
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

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
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
    grid-template-columns: 1fr !important;
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
}
</style>
