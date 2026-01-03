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
      <div v-else class="trigger-avatar-placeholder">👤</div>
      <span class="trigger-chevron" :class="{ open: isOpen }">▾</span>
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
            <div v-else class="avatar-placeholder">👤</div>
          </div>
        </div>
        
        <!-- Profile Info -->
        <div class="profile-info">
          <h3 class="display-name">{{ authStore.displayName }}</h3>
          
          <div v-if="authStore.profileNip05" class="nip05">
            <span class="verified-icon">✓</span>
            <span>{{ authStore.profileNip05 }}</span>
          </div>
          
          <p v-if="authStore.profileAbout" class="about">
            {{ truncatedAbout }}
          </p>
          
          <div class="npub-row">
            <code class="npub">{{ authStore.shortNpub }}</code>
            <button @click="copyNpub" class="copy-btn" title="Copy full npub">
              {{ copied ? '✓' : '📋' }}
            </button>
          </div>

          <!-- Auth Method Indicator -->
          <div class="auth-method">
            <span v-if="authStore.isNip07" class="auth-badge auth-extension">
              <span class="auth-icon">&#129418;</span>
              <span>Extension</span>
            </span>
            <span v-else-if="authStore.isNsec" class="auth-badge auth-nsec">
              <span class="auth-icon">🔑</span>
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
              🌐
            </a>
            <a 
              v-if="authStore.profileLud16" 
              :href="`lightning:${authStore.profileLud16}`"
              class="quick-link"
              title="Lightning Address"
            >
              ⚡
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
            <span class="action-icon">👤</span>
            <span>View Profile</span>
          </router-link>
          <button @click="handleLogout" class="action-btn action-logout">
            <span class="action-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const dropdownRef = ref(null)
const isOpen = ref(false)
const copied = ref(false)
const avatarError = ref(false)

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
  font-size: 1rem;
}

.trigger-chevron {
  font-size: 0.75rem;
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
  font-size: 1.75rem;
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
  font-size: 0.625rem;
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
  font-size: 0.75rem;
}

.auth-extension {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
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
  border-radius: 50%;
  text-decoration: none;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.quick-link:hover {
  background: var(--color-primary-soft);
  transform: scale(1.1);
}

/* Dropdown Actions */
.dropdown-actions {
  border-top: 1px solid var(--color-border);
  padding: 0.5rem;
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
  font-size: 1rem;
}

.action-logout:hover {
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

