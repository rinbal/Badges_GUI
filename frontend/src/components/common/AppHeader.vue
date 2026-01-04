<template>
  <header class="header">
    <div class="header-content">
      <router-link to="/" class="logo">
        <Icon name="award" size="lg" class="logo-icon" />
        <span class="logo-text">Nostr Badges</span>
      </router-link>

      <nav class="nav">
        <router-link to="/creator" class="nav-link">
          <Icon name="sparkles" size="md" class="nav-icon" />
          <span class="nav-text">Creator</span>
        </router-link>
        <router-link to="/inbox" class="nav-link">
          <Icon name="inbox" size="md" class="nav-icon" />
          <span class="nav-text">Inbox</span>
          <span v-if="badgesStore.pendingCount > 0" class="badge-count">
            {{ badgesStore.pendingCount }}
          </span>
        </router-link>
      </nav>

      <div class="header-actions">
        <template v-if="authStore.isAuthenticated">
          <ProfileDropdown />
        </template>
        <template v-else>
          <router-link to="/login" class="btn-login">
            <Icon name="key" size="sm" />
            <span>Login</span>
          </router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { useBadgesStore } from '@/stores/badges'
import ProfileDropdown from '@/components/common/ProfileDropdown.vue'
import Icon from '@/components/common/Icon.vue'

const authStore = useAuthStore()
const badgesStore = useBadgesStore()
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
  color: var(--color-primary);
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
  flex-shrink: 0;
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

.btn-login {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
}
</style>
