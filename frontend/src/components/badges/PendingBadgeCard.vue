<template>
  <!--
    PendingBadgeCard
    Horizontal card for displaying pending badges awaiting acceptance.
    Features accept button and view details action.
  -->
  <div class="pending-card">
    <!-- Badge Image -->
    <div class="badge-image">
      <img v-if="badgeImage" :src="badgeImage" :alt="badgeName" @error="onImageError" />
      <div v-else class="placeholder">
        <Icon name="award" size="lg" />
      </div>
    </div>

    <!-- Badge Info -->
    <div class="badge-info">
      <h3 class="badge-name">{{ badgeName }}</h3>
      <p v-if="badgeDescription" class="badge-description">{{ badgeDescription }}</p>

      <!-- Issuer -->
      <div class="issuer">
        <img v-if="issuerPicture" :src="issuerPicture" class="issuer-avatar" @error="onAvatarError" />
        <div v-else class="issuer-avatar placeholder">
          <Icon name="user" size="xs" />
        </div>
        <div class="issuer-details">
          <span class="issuer-label">From</span>
          <span class="issuer-name">{{ issuerName }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn-accept" :disabled="loading" @click.stop="$emit('accept', badge)">
        <span v-if="loading" class="spinner"></span>
        {{ loading ? 'Adding...' : 'Accept' }}
      </button>
      <button class="btn-view" @click.stop="$emit('view', badge, true)">
        Details
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * PendingBadgeCard Component
 *
 * Displays a pending badge in a horizontal card format.
 * Used in the Pending tab of the inbox.
 */

import { ref, computed } from 'vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  badge: { type: Object, required: true },
  loading: { type: Boolean, default: false }
})

defineEmits(['accept', 'view'])

// Image error states
const imageError = ref(false)
const avatarError = ref(false)

// Computed properties for flexible data access
const badgeName = computed(() => props.badge.badge_name || props.badge.name || 'Unknown Badge')
const badgeDescription = computed(() => props.badge.badge_description || props.badge.description || '')
const badgeImage = computed(() => imageError.value ? null : (props.badge.badge_image || props.badge.image))
const issuerPicture = computed(() => avatarError.value ? null : props.badge.issuer_picture)
const issuerName = computed(() => props.badge.issuer_name || 'Unknown')

function onImageError() { imageError.value = true }
function onAvatarError() { avatarError.value = true }
</script>

<style scoped>
.pending-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-primary-soft) 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all 0.2s;
}

.pending-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

/* Badge Image */
.badge-image {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-image .placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-muted);
}

/* Badge Info */
.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.badge-description {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Issuer */
.issuer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.issuer-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.issuer-avatar.placeholder {
  background: var(--color-surface-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.issuer-details {
  display: flex;
  flex-direction: column;
}

.issuer-label {
  font-size: 0.625rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.issuer-name {
  font-size: 0.8125rem;
  color: var(--color-primary);
  font-weight: 500;
}

/* Actions */
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-accept {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-accept:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-accept:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-view {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-view:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mobile */
@media (max-width: 640px) {
  .pending-card {
    flex-direction: column;
    text-align: center;
  }

  .issuer {
    justify-content: center;
  }

  .actions {
    flex-direction: row;
    width: 100%;
  }

  .btn-accept, .btn-view {
    flex: 1;
  }
}
</style>
