<template>
  <div class="profile-dropdown" ref="dropdownRef">
    <!-- Trigger Button -->
    <button
      class="profile-trigger"
      @click="toggleDropdown"
      :class="{ active: isOpen }"
    >
      <img
        v-if="authStore.profilePicture"
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
        <!-- Banner & Avatar Header -->
        <div class="profile-header">
          <div 
            class="banner"
            :style="bannerStyle"
          ></div>
          <div class="avatar-container">
            <img 
              v-if="authStore.profilePicture" 
              :src="authStore.profilePicture" 
              :alt="authStore.displayName"
              class="avatar"
              @error="handleAvatarError"
            />
            <div v-else class="avatar-placeholder">
              <Icon name="user" size="lg" />
            </div>
          </div>
        </div>
        
        <!-- Profile Info -->
        <div class="profile-info">
          <h3 class="display-name">{{ authStore.displayName }}</h3>
          
          <div v-if="authStore.profileNip05" class="nip05">
            <Icon name="check" size="xs" class="verified-icon" />
            <span>{{ authStore.profileNip05 }}</span>
          </div>
          
          <p v-if="authStore.profileAbout" class="about">
            {{ truncatedAbout }}
          </p>
          
          <div class="npub-row">
            <code class="npub">{{ authStore.shortNpub }}</code>
            <button @click="copyNpub" class="copy-btn" title="Copy full npub">
              <Icon :name="copied ? 'check' : 'copy'" size="xs" />
            </button>
          </div>

          <!-- Auth Method Indicator -->
          <div class="auth-method">
            <span v-if="authStore.isNip07" class="auth-badge auth-extension">
              <Icon name="extension" size="sm" class="auth-icon" />
              <span>Extension</span>
            </span>
            <span v-else-if="authStore.isAmber" class="auth-badge auth-amber">
              <Icon name="key" size="sm" class="auth-icon" />
              <span>Amber</span>
            </span>
            <span v-else-if="authStore.isNsec" class="auth-badge auth-nsec">
              <Icon name="key" size="sm" class="auth-icon" />
              <span>Private Key</span>
            </span>
          </div>
          
          <!-- Quick Links -->
          <div class="quick-links">
            <a
              v-if="authStore.profileWebsite"
              :href="websiteUrl"
              target="_blank"
              class="quick-link"
              title="Website"
            >
              <Icon name="globe" size="sm" />
            </a>
            <a
              v-if="authStore.profileLud16"
              :href="`lightning:${authStore.profileLud16}`"
              class="quick-link"
              title="Lightning Address"
            >
              <Icon name="zap" size="sm" />
            </a>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="dropdown-actions">
          <router-link
            :to="`/profile/${authStore.npub}`"
            class="action-btn"
            @click="closeDropdown"
          >
            <Icon name="user" size="sm" class="action-icon" />
            <span>View Profile</span>
          </router-link>
          <div class="action-divider-label">Chat</div>
          <button @click="openCommunityPanel" class="action-btn">
            <Icon name="hash" size="sm" class="action-icon" />
            <span>Community</span>
          </button>
          <button @click="openDmsPanel" class="action-btn">
            <Icon name="mail" size="sm" class="action-icon" />
            <span>Messages</span>
          </button>
          <button @click="openChat" class="action-btn">
            <Icon name="message-circle" size="sm" class="action-icon" />
            <span>Feedback & Support</span>
          </button>
          <div class="action-divider-label">Settings</div>
          <button @click="openRelays" class="action-btn">
            <Icon name="server" size="sm" class="action-icon" />
            <span>Relays</span>
            <span class="relay-status-badge" :class="relayStatusClass">
              {{ relayStore.connectedCount }}/{{ relayStore.relayCount }}
            </span>
          </button>
          <button @click="handleLogout" class="action-btn action-logout">
            <Icon name="logout" size="sm" class="action-icon" />
            <span>Logout</span>
          </button>
        </div>
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

const relayStatusClass = computed(() => {
  if (relayStore.relayCount === 0) return 'offline'
  if (relayStore.connectedCount === relayStore.relayCount) return 'online'
  if (relayStore.connectedCount > 0) return 'partial'
  return 'offline'
})

function openChat() {
  uiStore.openChat()
  closeDropdown()
}

function openDmsPanel() {
  uiStore.openDms()
  closeDropdown()
}

function openCommunityPanel() {
  uiStore.openCommunity()
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

const truncatedAbout = computed(() => {
  const about = authStore.profileAbout || ''
  return about.length > 100 ? about.slice(0, 100) + '...' : about
})

const websiteUrl = computed(() => {
  const website = authStore.profileWebsite
  if (!website) return '#'
  return website.startsWith('http') ? website : `https://${website}`
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function closeDropdown() {
  isOpen.value = false
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

/* Dropdown Panel */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 280px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1000;
}

/* Profile Header with Banner */
.profile-header {
  position: relative;
  padding-bottom: 2rem;
}

.banner {
  height: 72px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
}

.avatar-container {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--color-surface);
  box-shadow: var(--shadow-md);
}

.avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  border: 3px solid var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

/* Profile Info */
.profile-info {
  padding: 0.5rem 1rem 1rem;
  text-align: center;
}

.display-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.nip05 {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  margin-bottom: 0.5rem;
}

.verified-icon {
  flex-shrink: 0;
}

.about {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0 0 0.75rem 0;
}

.npub-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  background: var(--color-surface-elevated);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
}

.copy-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
}

/* Auth Method Indicator */
.auth-method {
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 500;
}

.auth-icon {
  flex-shrink: 0;
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

.quick-links {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.quick-link {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  text-decoration: none;
  color: var(--color-text-muted);
  transition: all 0.2s ease;
}

.quick-link:hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-2px);
}

.quick-link[title="Lightning Address"] {
  color: var(--color-warning);
}

.quick-link[title="Lightning Address"]:hover {
  background: rgba(234, 179, 8, 0.15);
  border-color: var(--color-warning);
}

/* Dropdown Actions */
.dropdown-actions {
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
}

.action-divider-label {
  padding: 0.375rem 1rem 0.125rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-subtle);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--color-surface-hover);
}

.action-icon {
  flex-shrink: 0;
}

.action-logout:hover {
  background: var(--color-danger-soft);
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

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

