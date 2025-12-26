<template>
  <div :class="['badge-card', { 'badge-card-pending': isPending }]">
    <div class="badge-image-container">
      <img 
        v-if="badgeImage" 
        :src="badgeImage" 
        :alt="badgeName"
        class="badge-image"
        @error="handleImageError"
      />
      <div v-else class="badge-placeholder">
        🏅
      </div>
    </div>
    
    <div class="badge-content">
      <h3 class="badge-name">{{ badgeName }}</h3>
      <p v-if="badgeDescription" class="badge-description">
        {{ badgeDescription }}
      </p>
      
      <div class="badge-issuer">
        <img 
          v-if="issuerPicture" 
          :src="issuerPicture" 
          :alt="issuerDisplayName"
          class="issuer-avatar"
          @error="handleAvatarError"
        />
        <div v-else class="issuer-avatar-placeholder">👤</div>
        
        <div class="issuer-info">
          <span class="issuer-label">Issued by</span>
          <span class="issuer-name">{{ issuerDisplayName }}</span>
          <span class="issuer-npub">{{ shortNpub }}</span>
        </div>
      </div>
    </div>
    
    <div class="badge-actions" v-if="showActions">
      <slot name="actions">
        <button 
          v-if="isPending" 
          @click="$emit('accept', badge)"
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? 'Accepting...' : 'Accept' }}
        </button>
        <button 
          v-else 
          @click="$emit('remove', badge)"
          class="btn btn-danger-outline"
          :disabled="loading"
        >
          {{ loading ? 'Removing...' : 'Remove' }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  badge: {
    type: Object,
    required: true
  },
  isPending: {
    type: Boolean,
    default: false
  },
  showActions: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['accept', 'remove'])

const imageError = ref(false)
const avatarError = ref(false)

// Computed properties for flexible data access
const badgeName = computed(() => 
  props.badge.badge_name || props.badge.name || 'Unknown Badge'
)

const badgeDescription = computed(() => 
  props.badge.badge_description || props.badge.description || ''
)

const badgeImage = computed(() => {
  if (imageError.value) return null
  return props.badge.badge_image || props.badge.image || null
})

const issuerPicture = computed(() => {
  if (avatarError.value) return null
  return props.badge.issuer_picture || null
})

const issuerDisplayName = computed(() => 
  props.badge.issuer_name || 'Unknown'
)

const shortNpub = computed(() => {
  const npub = props.badge.issuer_npub
  if (!npub) return ''
  return `${npub.slice(0, 8)}...${npub.slice(-4)}`
})

function handleImageError(e) {
  imageError.value = true
}

function handleAvatarError(e) {
  avatarError.value = true
}
</script>

<style scoped>
.badge-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  gap: 1.25rem;
  transition: all 0.2s ease;
}

.badge-card:hover {
  border-color: var(--color-primary-soft);
  box-shadow: var(--shadow-md);
}

.badge-card-pending {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-soft) 100%);
}

.badge-image-container {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-placeholder {
  font-size: 2.5rem;
}

.badge-content {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.badge-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.badge-issuer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.issuer-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.issuer-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.issuer-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.issuer-label {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.issuer-name {
  font-size: 0.875rem;
  color: var(--color-primary);
  font-weight: 500;
}

.issuer-npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.badge-actions {
  display: flex;
  align-items: flex-start;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-danger-outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn-danger-outline:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

@media (max-width: 640px) {
  .badge-card {
    flex-direction: column;
    text-align: center;
  }
  
  .badge-image-container {
    margin: 0 auto;
  }
  
  .badge-issuer {
    justify-content: center;
  }
  
  .issuer-info {
    align-items: center;
  }
  
  .badge-actions {
    justify-content: center;
  }
}
</style>
