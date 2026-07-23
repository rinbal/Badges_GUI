<template>
  <div class="profile-dropdown" ref="dropdownRef">
    <!-- Trigger Button -->
    <button
      class="profile-trigger"
      @click="toggleDropdown"
      :class="{ active: isOpen }"
    >
      <img
        v-if="authStore.profilePicture && !avatarError"
        :src="authStore.profilePicture"
        :alt="authStore.displayName"
        class="trigger-avatar"
        @error="handleAvatarError"
      />
      <div v-else class="trigger-avatar-placeholder">
        <Icon name="user" size="sm" />
      </div>
      <Icon
        name="chevron-down"
        size="xs"
        class="trigger-chevron"
        :class="{ open: isOpen }"
      />
    </button>

    <!-- Dropdown Panel -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-panel">
        <!-- Social header -->
        <header class="pcard">
          <div class="pcard-banner" :style="bannerStyle"></div>

          <div class="pcard-main">
            <img
              v-if="authStore.profilePicture && !avatarError"
              :src="authStore.profilePicture"
              :alt="authStore.displayName"
              class="pcard-avatar"
              @error="handleAvatarError"
            />
            <div v-else class="pcard-avatar pcard-avatar--ph">
              <Icon name="user" size="lg" />
            </div>

            <div class="pcard-id">
              <h3 class="pcard-name">{{ authStore.displayName }}</h3>
              <div v-if="authStore.profileNip05" class="pcard-nip05">
                <Icon name="check" size="xs" />
                <span>{{ authStore.profileNip05 }}</span>
              </div>
            </div>

            <div class="pcard-links">
              <a
                v-if="authStore.profileWebsite"
                :href="websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="pcard-link"
                title="Website"
              >
                <Icon name="globe" size="sm" />
              </a>
              <a
                v-if="authStore.profileLud16"
                :href="`lightning:${authStore.profileLud16}`"
                class="pcard-link pcard-link--zap"
                title="Lightning address"
              >
                <Icon name="zap" size="sm" />
              </a>
            </div>
          </div>

          <div v-if="authStore.profileAbout" class="pcard-about">
            <p class="pcard-about-text" :class="{ clamped: !bioExpanded }">{{ authStore.profileAbout }}</p>
            <button
              v-if="bioTruncatable"
              class="pcard-about-toggle"
              @click="bioExpanded = !bioExpanded"
            >
              {{ bioExpanded ? 'Read less' : 'Read more' }}
            </button>
          </div>

          <div class="pcard-footer">
            <button class="pcard-npub" @click="copyNpub" title="Copy npub">
              <code>{{ authStore.shortNpub }}</code>
              <Icon :name="copied ? 'check' : 'copy'" size="xs" class="pcard-npub-copy" />
            </button>
            <span v-if="authBadge" class="auth-badge" :class="authBadge.cls">
              <Icon :name="authBadge.icon" size="xs" />
              <span>{{ authBadge.label }}</span>
            </span>
          </div>
        </header>

        <!-- Actions, grouped with divider lines -->
        <nav class="menu">
          <router-link
            :to="`/profile/${authStore.npub}`"
            class="menu-item"
            @click="closeDropdown"
          >
            <Icon name="user" size="sm" class="menu-icon" />
            <span>View Profile</span>
          </router-link>

          <div class="menu-label">Chat</div>
          <button @click="openDmsPanel" class="menu-item">
            <Icon name="mail" size="sm" class="menu-icon" />
            <span>Messages</span>
          </button>
          <button @click="openChat" class="menu-item">
            <Icon name="message-circle" size="sm" class="menu-icon" />
            <span>Feedback & Support</span>
          </button>

          <div class="menu-label">Settings</div>
          <button @click="openRelays" class="menu-item">
            <Icon name="server" size="sm" class="menu-icon" />
            <span>Relays</span>
            <span class="relay-status-badge" :class="relayStatusClass">
              {{ relayStore.connectedCount }}/{{ relayStore.relayCount }}
            </span>
          </button>

          <div class="menu-sep"></div>
          <button @click="handleLogout" class="menu-item menu-item--danger">
            <Icon name="logout" size="sm" class="menu-icon" />
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </Transition>

    <!-- Relay Manager Modal (outside dropdown so it persists when dropdown closes) -->
    <RelayManager :visible="showRelayManager" @close="showRelayManager = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'
import { useRelayStore } from '@/stores/relays'
import Icon from '@/components/common/Icon.vue'
import RelayManager from '@/components/common/RelayManager.vue'

const router = useRouter()
const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()
const relayStore = useRelayStore()

const dropdownRef = ref(null)
const isOpen = ref(false)
const copied = ref(false)
const avatarError = ref(false)
const showRelayManager = ref(false)
const bioExpanded = ref(false)

// Long bios collapse to two lines behind a "Read more" toggle.
const bioTruncatable = computed(() => (authStore.profileAbout || '').length > 90)

const relayStatusClass = computed(() => {
  if (relayStore.relayCount === 0) return 'offline'
  if (relayStore.connectedCount === relayStore.relayCount) return 'online'
  if (relayStore.connectedCount > 0) return 'partial'
  return 'offline'
})

// Compact label for the current login method, shown as a chip in the header.
const authBadge = computed(() => {
  if (authStore.isNip07) return { label: 'Extension', cls: 'auth-extension', icon: 'extension' }
  if (authStore.isAmber) return { label: 'Amber', cls: 'auth-amber', icon: 'key' }
  if (authStore.isRemoteLogin) return { label: 'Remote', cls: 'auth-amber', icon: 'key' }
  if (authStore.isNsec) return { label: 'Private key', cls: 'auth-nsec', icon: 'key' }
  return null
})

function openChat() {
  uiStore.openChat()
  closeDropdown()
}

function openDmsPanel() {
  uiStore.openDms()
  closeDropdown()
}

function openRelays() {
  showRelayManager.value = true
  closeDropdown()
}

const bannerStyle = computed(() => {
  if (authStore.profileBanner) {
    return {
      backgroundImage: `url(${authStore.profileBanner})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)'
  }
})

const websiteUrl = computed(() => {
  const website = authStore.profileWebsite
  if (!website) return '#'
  return website.startsWith('http') ? website : `https://${website}`
})

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  } else {
    isOpen.value = true
  }
}

function closeDropdown() {
  isOpen.value = false
  bioExpanded.value = false
}

function handleAvatarError() {
  avatarError.value = true
}

async function copyNpub() {
  try {
    await navigator.clipboard.writeText(authStore.npub)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    uiStore.showError('Failed to copy')
  }
}

function handleLogout() {
  authStore.logout()
  badgesStore.clearBadges()
  uiStore.showInfo('Logged out successfully')
  closeDropdown()
  router.push('/')
}

// Close on click outside
function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  relayStore.init()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.profile-dropdown {
  position: relative;
}

/* ── Trigger ─────────────────────────────────────────────────────────────── */
.profile-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-trigger:hover,
.profile-trigger.active {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-soft);
}

.trigger-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.trigger-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.trigger-chevron {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.trigger-chevron.open {
  transform: rotate(180deg);
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 300px;
  max-width: calc(100vw - 1.5rem);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1000;
}

/* ── Social header card ──────────────────────────────────────────────────── */
.pcard-banner {
  height: 58px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
}

.pcard-main {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0 1rem;
  margin-top: -28px;
}

.pcard-avatar {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-surface);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.pcard-avatar--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.pcard-id {
  flex: 1;
  min-width: 0;
  padding-bottom: 0.125rem;
}

.pcard-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pcard-nip05 {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--color-primary);
}

.pcard-nip05 span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pcard-links {
  display: flex;
  gap: 0.375rem;
  padding-bottom: 0.25rem;
  flex-shrink: 0;
}

.pcard-link {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: all 0.15s ease;
}

.pcard-link:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.pcard-link--zap {
  color: var(--color-warning);
}

.pcard-link--zap:hover {
  color: var(--color-warning);
  border-color: var(--color-warning);
}

.pcard-about {
  margin: 0.625rem 1rem 0;
}

.pcard-about-text {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  word-break: break-word;
}

.pcard-about-text.clamped {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pcard-about-toggle {
  margin-top: 0.25rem;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}

.pcard-about-toggle:hover {
  text-decoration: underline;
}

.pcard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 1rem 0.875rem;
}

.pcard-npub {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  padding: 0.25rem 0.5rem 0.25rem 0.625rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-subtle);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pcard-npub:hover {
  border-color: var(--color-primary);
  color: var(--color-text-muted);
}

.pcard-npub code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pcard-npub-copy {
  flex-shrink: 0;
}

/* Auth method chip */
.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.1875rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.625rem;
  font-weight: 600;
}

.auth-extension {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.auth-amber {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.15) 100%);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.auth-nsec {
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

/* ── Menu ────────────────────────────────────────────────────────────────── */
.menu {
  border-top: 1px solid var(--color-border);
  padding: 0.375rem;
}

.menu-label {
  padding: 0.5rem 0.75rem 0.375rem;
  margin-top: 0.25rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}

.menu-sep {
  height: 1px;
  background: var(--color-border);
  margin: 0.375rem 0.5rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-family: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.menu-item:hover {
  background: var(--color-surface-hover);
}

.menu-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.menu-item--danger {
  color: var(--color-danger);
}

.menu-item--danger:hover {
  background: var(--color-danger-soft);
}

.menu-item--danger .menu-icon {
  color: var(--color-danger);
}

/* Relay Status Badge */
.relay-status-badge {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: var(--font-mono);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}

.relay-status-badge.online {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success);
}

.relay-status-badge.partial {
  background: rgba(251, 191, 36, 0.12);
  color: rgb(217, 163, 15);
}

.relay-status-badge.offline {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Mobile ──────────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .dropdown-panel {
    width: calc(100vw - 1.5rem);
  }
}
</style>
