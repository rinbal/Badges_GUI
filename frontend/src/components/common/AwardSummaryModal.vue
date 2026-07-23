<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="summary-overlay" @click.self="$emit('cancel')">
        <div class="summary-modal">
          <!-- Header -->
          <div class="summary-header">
            <h3>Review & Confirm</h3>
            <p>Please review before publishing to Nostr</p>
          </div>

          <!-- Badge Info -->
          <div class="summary-badge">
            <img v-if="badge?.image" :src="badge.image" :alt="badge.name" class="badge-img" @error="e => e.target.style.opacity = '0.2'" />
            <div v-else class="badge-img placeholder">
              <Icon name="award" size="md" />
            </div>
            <div class="badge-info">
              <strong>{{ badge?.name }}</strong>
              <span v-if="badge?.description" class="badge-desc">{{ badge.description }}</span>
            </div>
          </div>

          <!-- Issuer -->
          <div class="summary-section">
            <div class="section-label">Issued by</div>
            <div class="issuer-row">
              <img v-if="issuerPicture" :src="issuerPicture" class="issuer-avatar" />
              <div v-else class="issuer-avatar placeholder">
                <Icon name="user" size="xs" />
              </div>
              <span class="issuer-name">{{ issuerName }}</span>
            </div>
          </div>

          <!-- Recipients -->
          <div class="summary-section">
            <div class="section-label">
              Awarding to
              <span class="recipient-count">{{ recipients.length }}</span>
            </div>
            <div class="recipients-scroll">
              <div v-for="npub in recipients" :key="npub" class="summary-recipient">
                <div v-if="profiles[npub]?.picture" class="r-avatar">
                  <img :src="profiles[npub].picture" @error="e => e.target.style.display = 'none'" />
                </div>
                <div v-else class="r-avatar placeholder">
                  <span>{{ profiles[npub]?.initials || '?' }}</span>
                </div>
                <div class="r-info">
                  <span v-if="profiles[npub]?.displayName" class="r-name">{{ profiles[npub].displayName }}</span>
                  <span class="r-npub">{{ formatNpub(npub) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Warning -->
          <div class="summary-warning">
            <Icon name="info" size="sm" class="warning-icon" />
            <span>This will publish the badge award to Nostr relays immediately. You can revoke it later from your issued badges.</span>
          </div>

          <!-- Actions -->
          <div class="summary-actions">
            <button class="btn-back" @click="$emit('cancel')">
              <Icon name="arrow-left" size="xs" />
              Go Back
            </button>
            <button
              class="btn-confirm"
              @click="$emit('confirm')"
            >
              <Icon name="send" size="xs" />
              Confirm & Award
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import Icon from '@/components/common/Icon.vue'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  badge: {
    type: Object,
    default: null
  },
  recipients: {
    type: Array,
    default: () => []
  },
  profiles: {
    type: Object,
    default: () => ({})
  },
  issuerName: {
    type: String,
    default: ''
  },
  issuerPicture: {
    type: String,
    default: null
  }
})

defineEmits(['confirm', 'cancel'])

function formatNpub(npub) {
  if (npub.length <= 20) return npub
  return `${npub.slice(0, 12)}...${npub.slice(-6)}`
}
</script>

<style scoped>
.summary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.summary-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Header */
.summary-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.summary-header h3 {
  font-size: 1.125rem;
  margin: 0 0 0.25rem;
}

.summary-header p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Badge */
.summary-badge {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--color-surface-elevated);
}

.badge-img {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  object-fit: cover;
  flex-shrink: 0;
}

.badge-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-info strong {
  display: block;
  font-size: 1rem;
  margin-bottom: 0.125rem;
}

.badge-desc {
  display: block;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* Sections */
.summary-section {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
}

.section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  margin-bottom: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recipient-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.375rem;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 700;
}

/* Issuer */
.issuer-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.issuer-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.issuer-avatar.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  color: var(--color-text-muted);
}

.issuer-name {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Recipients */
.recipients-scroll {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.summary-recipient {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.summary-recipient:last-child {
  border-bottom: none;
}

.r-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.r-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.r-avatar.placeholder {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.r-info {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  min-width: 0;
}

.r-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Warning */
.summary-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin: 0 1.5rem;
  padding: 0.75rem;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.warning-icon {
  color: rgb(251, 191, 36);
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

/* Actions */
.summary-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn-back {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  border-color: var(--color-text-muted);
  background: var(--color-surface-elevated);
}

.btn-confirm {
  flex: 1.5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-confirm:hover {
  background: var(--color-primary-hover);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .summary-modal,
.modal-leave-active .summary-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .summary-modal,
.modal-leave-to .summary-modal {
  transform: scale(0.95) translateY(8px);
}

/* Mobile */
@media (max-width: 640px) {
  .summary-modal {
    max-height: 90vh;
  }

  .summary-header,
  .summary-section,
  .summary-actions {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .summary-warning {
    margin-left: 1rem;
    margin-right: 1rem;
  }

  .summary-badge {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .summary-actions {
    flex-direction: column-reverse;
  }

  .btn-confirm,
  .btn-back {
    flex: unset;
    width: 100%;
  }
}
</style>
