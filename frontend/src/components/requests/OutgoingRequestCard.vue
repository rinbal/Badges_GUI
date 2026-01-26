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
        <span class="issuer-name">by {{ issuerName }}</span>
      </div>
      <IconChevronRight :size="18" class="chevron" />
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

    <!-- State and Time -->
    <div class="meta-section">
      <span :class="['state-badge', request.state]">
        <IconClock v-if="request.state === 'pending'" :size="14" />
        <IconCheck v-else-if="request.state === 'fulfilled'" :size="14" />
        <IconX v-else-if="request.state === 'denied'" :size="14" />
        <IconArrowBack v-else-if="request.state === 'withdrawn'" :size="14" />
        {{ stateLabel }}
      </span>
      <span class="request-time">{{ formatTime(request.created_at) }}</span>
    </div>

    <!-- Denial Reason -->
    <div v-if="request.state === 'denied' && request.denial_reason" class="denial-box">
      <IconAlertCircle :size="16" />
      <span>{{ request.denial_reason }}</span>
    </div>

    <!-- Actions (only for pending) -->
    <div v-if="request.state === 'pending'" class="actions-section">
      <button
        class="btn btn-danger-outline"
        :disabled="loading"
        @click="$emit('withdraw', request)"
      >
        <div v-if="loading" class="spinner-sm"></div>
        <IconArrowBack v-else :size="16" />
        Withdraw Request
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconAward,
  IconChevronRight,
  IconQuote,
  IconLink,
  IconClock,
  IconCheck,
  IconX,
  IconArrowBack,
  IconAlertCircle
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

defineEmits(['withdraw', 'view-badge'])

const truncatedMessage = computed(() => {
  const msg = props.request.content || ''
  if (msg.length <= 150) return msg
  return msg.slice(0, 150) + '...'
})

const issuerName = computed(() =>
  props.request.issuer_profile?.name ||
  props.request.issuer_profile?.display_name ||
  'Unknown Issuer'
)

const stateLabel = computed(() => {
  const labels = {
    pending: 'Awaiting Review',
    fulfilled: 'Awarded',
    denied: 'Denied',
    withdrawn: 'Withdrawn'
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
}

.request-card.state-withdrawn {
  border-left: 3px solid var(--color-text-muted);
  opacity: 0.7;
}

/* Badge Section */
.badge-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.issuer-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
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

/* Meta Section */
.meta-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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

.state-badge.withdrawn {
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
}

.request-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Denial Box */
.denial-box {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--color-danger-soft);
  border-radius: var(--radius-md);
  color: var(--color-danger);
}

.denial-box svg {
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

.denial-box span {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-text);
}

/* Actions Section */
.actions-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.btn {
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
  width: 100%;
}

.btn-danger-outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn-danger-outline:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

.btn-danger-outline:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-danger);
  border-top-color: transparent;
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
}
</style>
