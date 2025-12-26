<template>
  <header class="header">
    <div class="header-content">
      <router-link to="/" class="logo">
        <span class="logo-icon">🏅</span>
        <span class="logo-text">Nostr Badges</span>
      </router-link>
      
      <nav class="nav">
        <router-link to="/creator" class="nav-link">
          <span class="nav-icon">✨</span>
          <span class="nav-text">Creator</span>
        </router-link>
        <router-link to="/inbox" class="nav-link">
          <span class="nav-icon">📬</span>
          <span class="nav-text">Inbox</span>
          <span v-if="badgesStore.pendingCount > 0" class="badge-count">
            {{ badgesStore.pendingCount }}
          </span>
        </router-link>
      </nav>
      
      <div class="header-actions">
        <template v-if="authStore.isAuthenticated">
          <router-link :to="`/profile/${authStore.npub}`" class="profile-link">
            <img 
              v-if="authStore.profilePicture" 
              :src="authStore.profilePicture" 
              :alt="authStore.displayName"
              class="profile-avatar"
              @error="handleAvatarError"
            />
            <div v-else class="profile-avatar-placeholder">👤</div>
            <div class="profile-info">
              <span class="profile-name">{{ authStore.displayName }}</span>
              <span class="profile-npub">{{ authStore.shortNpub }}</span>
            </div>
          </router-link>
          <button @click="handleLogout" class="btn-logout" title="Logout">
            ⬅️
          </button>
        </template>
        <template v-else>
          <router-link to="/login" class="btn-login">
            🔐 Login
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const badgesStore = useBadgesStore()
const uiStore = useUIStore()

const avatarError = ref(false)

function handleAvatarError() {
  avatarError.value = true
}

function handleLogout() {
  authStore.logout()
  badgesStore.clearBadges()
  uiStore.showInfo('Logged out successfully')
  router.push('/')
}
</script>

<style scoped>
.header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.25rem;
  color: var(--color-text);
}

.logo-icon {
  font-size: 1.5rem;
}

.nav {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  font-weight: 500;
}

.nav-link:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.nav-link.router-link-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.nav-icon {
  font-size: 1.1rem;
}

.badge-count {
  background: var(--color-accent);
  color: white;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.profile-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  padding: 0.375rem 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.profile-link:hover {
  background: var(--color-surface-hover);
}

.profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.profile-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.btn-login {
  padding: 0.5rem 1.25rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-login:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-logout {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.btn-logout:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

@media (max-width: 768px) {
  .header-content {
    padding: 0.75rem 1rem;
  }
  
  .logo-text {
    display: none;
  }
  
  .nav-text {
    display: none;
  }
  
  .profile-info {
    display: none;
  }
}
</style>
