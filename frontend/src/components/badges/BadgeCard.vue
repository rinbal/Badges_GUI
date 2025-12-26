<template>
  <div :class="['badge-card', { 'badge-card-pending': isPending }]">
    <div class="badge-image-container">
      <img 
        v-if="badge.image" 
        :src="badge.image" 
        :alt="badge.badge_name || badge.name"
        class="badge-image"
        @error="handleImageError"
      />
      <div v-else class="badge-placeholder">
        🏅
      </div>
    </div>
    
    <div class="badge-content">
      <h3 class="badge-name">{{ badge.badge_name || badge.name }}</h3>
      <p v-if="badge.badge_description || badge.description" class="badge-description">
        {{ badge.badge_description || badge.description }}
      </p>
      
      <div class="badge-issuer">
        <span class="issuer-label">Issued by</span>
        <span class="issuer-name">{{ badge.issuer_name || 'Unknown' }}</span>
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
import { ref } from 'vue'

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

function handleImageError(e) {
  e.target.style.display = 'none'
  e.target.parentElement.innerHTML = '<div class="badge-placeholder">🏅</div>'
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
}

.badge-issuer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.issuer-label {
  color: var(--color-text-muted);
}

.issuer-name {
  color: var(--color-primary);
  font-weight: 500;
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
  
  .badge-actions {
    justify-content: center;
  }
}
</style>

