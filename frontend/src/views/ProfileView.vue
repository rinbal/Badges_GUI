<template>
  <div class="profile">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <LoadingSpinner text="Loading profile..." />
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">❌</span>
      <h2>Profile not found</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">Go Home</router-link>
    </div>
    
    <!-- Profile Content -->
    <template v-else-if="profile">
      <!-- Profile Header -->
      <header class="profile-header">
        <div class="profile-avatar">
          <img v-if="profile.picture" :src="profile.picture" :alt="displayName" />
          <span v-else class="avatar-placeholder">👤</span>
        </div>
        
        <div class="profile-info">
          <h1>{{ displayName }}</h1>
          <code class="profile-npub">{{ profile.npub }}</code>
          <p v-if="profile.about" class="profile-about">{{ profile.about }}</p>
        </div>
      </header>
      
      <!-- Badges Section -->
      <section class="badges-section">
        <h2>🏅 Badges ({{ badges.accepted.length }})</h2>
        
        <div v-if="badges.accepted.length === 0" class="empty-badges">
          <p>No badges displayed yet.</p>
        </div>
        
        <div v-else class="badges-grid">
          <BadgeCard
            v-for="badge in badges.accepted"
            :key="badge.award_event_id"
            :badge="badge"
            :show-actions="false"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BadgeCard from '@/components/badges/BadgeCard.vue'

const route = useRoute()
const authStore = useAuthStore()

const isLoading = ref(true)
const error = ref(null)
const profile = ref(null)
const badges = ref({ accepted: [], pending: [] })

const pubkey = computed(() => route.params.pubkey || authStore.npub)

const displayName = computed(() => {
  if (!profile.value) return 'Unknown'
  return profile.value.display_name || profile.value.name || 'Anonymous'
})

onMounted(() => {
  loadProfile()
})

watch(() => route.params.pubkey, () => {
  loadProfile()
})

async function loadProfile() {
  if (!pubkey.value) {
    error.value = 'No public key provided'
    isLoading.value = false
    return
  }
  
  isLoading.value = true
  error.value = null
  
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
</script>

<style scoped>
.profile {
  max-width: 800px;
  margin: 0 auto;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

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

.profile-header {
  display: flex;
  gap: 2rem;
  padding: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  margin-bottom: 2rem;
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
}

.profile-info h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.profile-npub {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  word-break: break-all;
  margin-bottom: 1rem;
}

.profile-about {
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.badges-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 2rem;
}

.badges-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1.5rem 0;
}

.empty-badges {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}

.badges-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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

@media (max-width: 640px) {
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>

