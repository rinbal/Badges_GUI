<template>
  <div :class="['request-card', `state-${request.state}`]">
    <!-- Badge Info -->
    <div class="badge-section" @click="$emit('view-badge', request)">
      <div class="badge-image-container">
        <img
          v-if="request.badge_image"
          :src="request.badge_image"
          :alt="request.badge_name"
          class="badge-image"
        />
        <div v-else class="badge-placeholder">
          <IconAward :size="24" />
        </div>
      </div>
      <div class="badge-info">
        <h3 class="badge-name">{{ request.badge_name }}</h3>
        <span class="badge-hint">Your badge</span>
      </div>
    </div>

    <!-- Requester Info -->
    <div class="requester-section" @click="$emit('view-requester', request)">
      <UserAvatar
        :picture="request.requester_profile?.picture"
        :name="request.requester_profile?.name || request.requester_profile?.display_name"
        :pubkey="request.requester_pubkey"
        size="md"
        clickable
      />
      <div class="requester-info">
        <span class="requester-name">
          {{ request.requester_profile?.name || request.requester_profile?.display_name || 'Anonymous' }}
        </span>
        <span class="request-time">{{ formatTime(request.created_at) }}</span>
      </div>
    </div>

    <!-- Request Message -->
    <div v-if="request.content" class="request-message">
      <IconQuote :size="14" class="quote-icon" />
      <p>{{ truncatedMessage }}</p>
    </div>

    <!-- Proofs -->
    <div v-if="request.proofs && request.proofs.length > 0" class="proofs-section">
      <span class="proofs-label">
        <IconLink :size="14" />
        {{ request.proofs.length }} proof{{ request.proofs.length !== 1 ? 's' : '' }} attached
      </span>
    </div>

    <!-- State Badge -->
    <div class="state-section">
      <span :class="['state-badge', request.state]">
        <IconClock v-if="request.state === 'pending'" :size="14" />
        <IconCheck v-else-if="request.state === 'fulfilled'" :size="14" />
        <IconX v-else-if="request.state === 'denied'" :size="14" />
        {{ stateLabel }}
      </span>
      <span v-if="request.denial_reason" class="denial-reason">
        {{ request.denial_reason }}
      </span>
    </div>

    <!-- Actions (only for pending) -->
    <div v-if="request.state === 'pending'" class="actions-section">
      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('deny', request)"
      >
        <IconX :size="16" />
        Deny
      </button>
      <button
        class="btn btn-primary"
        :disabled="loading"
        @click="$emit('award', request)"
      >
        <div v-if="loading" class="spinner-sm"></div>
        <IconAward v-else :size="16" />
        Award Badge
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'
import {
  IconAward,
  IconQuote,
  IconLink,
  IconClock,
  IconCheck,
  IconX
} from '@tabler/icons-vue'

const props = defineProps({
  request: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['award', 'deny', 'view-requester', 'view-badge'])

const truncatedMessage = computed(() => {
  const msg = props.request.content || ''
  if (msg.length <= 150) return msg
  return msg.slice(0, 150) + '...'
})

const stateLabel = computed(() => {
  const labels = {
    pending: 'Pending',
    fulfilled: 'Awarded',
    denied: 'Denied'
  }
  return labels[props.request.state] || props.request.state
})

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now - date

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000)
    return mins <= 1 ? 'Just now' : `${mins}m ago`
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  }

  // Older - show date
  return date.toLocaleDateString()
}
</script>

<style scoped>
.request-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  transition: all 0.2s ease;
}

.request-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-sm);
}

.request-card.state-fulfilled {
  border-left: 3px solid var(--color-success);
}

.request-card.state-denied {
  border-left: 3px solid var(--color-danger);
  opacity: 0.8;
}

/* Badge Section */
.badge-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  margin: -0.5rem -0.5rem 0.75rem -0.5rem;
  border-radius: var(--radius-md);
  transition: background 0.2s ease;
}

.badge-section:hover {
  background: var(--color-surface-elevated);
}

.badge-image-container {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-elevated);
}

.badge-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.125rem 0;
}

.badge-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Requester Section */
.requester-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.625rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  transition: background 0.2s ease;
}

.requester-section:hover {
  background: var(--color-primary-soft);
}

.requester-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.requester-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.request-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Request Message */
.request-message {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-border);
  margin-bottom: 0.75rem;
}

.quote-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.request-message p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  font-style: italic;
}

/* Proofs Section */
.proofs-section {
  margin-bottom: 0.75rem;
}

.proofs-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

/* State Section */
.state-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.state-badge.pending {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.state-badge.fulfilled {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.state-badge.denied {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.denial-reason {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-style: italic;
}

/* Actions Section */
.actions-section {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mobile */
@media (max-width: 480px) {
  .request-card {
    padding: 1rem;
  }

  .actions-section {
    flex-direction: column;
  }
}
</style>
