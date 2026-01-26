<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">Deny Request</h2>
            <button class="close-btn" @click="close">
              <IconX :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <!-- Request Info -->
            <div v-if="request" class="request-info">
              <div class="requester-row">
                <UserAvatar
                  :picture="request.requester_profile?.picture"
                  :name="request.requester_profile?.name || request.requester_profile?.display_name"
                  :pubkey="request.requester_pubkey"
                  size="md"
                />
                <div class="requester-info">
                  <span class="requester-name">
                    {{ request.requester_profile?.name || request.requester_profile?.display_name || 'Anonymous' }}
                  </span>
                  <span class="badge-name">requested {{ request.badge_name }}</span>
                </div>
              </div>

              <div v-if="request.content" class="request-message">
                <IconQuote :size="14" class="quote-icon" />
                <p>{{ request.content }}</p>
              </div>
            </div>

            <!-- Reason Input -->
            <div class="form-group">
              <label class="form-label">
                <IconMessageX :size="16" />
                Reason for Denial
                <span class="optional">(optional)</span>
              </label>
              <p class="form-hint">
                Let the requester know why their request was denied
              </p>
              <textarea
                v-model="reason"
                class="form-textarea"
                placeholder="e.g., Requirements not met, missing proof..."
                rows="3"
                maxlength="500"
              ></textarea>
              <span class="char-count">{{ reason.length }}/500</span>
            </div>

            <!-- Warning -->
            <div class="warning-box">
              <IconAlertTriangle :size="16" />
              <p>
                This denial is <strong>soft</strong> - the user can submit a new request later.
                You can also revoke this denial if you change your mind.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="close">
              Cancel
            </button>
            <button
              class="btn btn-danger"
              :disabled="isSubmitting"
              @click="submitDenial"
            >
              <div v-if="isSubmitting" class="spinner-sm"></div>
              <IconX v-else :size="16" />
              {{ isSubmitting ? 'Denying...' : 'Deny Request' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRequestsStore } from '@/stores/requests'
import UserAvatar from './UserAvatar.vue'
import {
  IconX,
  IconQuote,
  IconMessageX,
  IconAlertTriangle
} from '@tabler/icons-vue'

const props = defineProps({
  request: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const ui = useUIStore()
const requestsStore = useRequestsStore()

// State
const isOpen = ref(true)
const isSubmitting = ref(false)
const reason = ref('')

// Methods
function close() {
  isOpen.value = false
  setTimeout(() => {
    emit('close')
  }, 200)
}

async function submitDenial() {
  if (!props.request) return

  isSubmitting.value = true

  try {
    const result = await requestsStore.denyRequest(
      props.request.event_id,
      props.request.badge_a_tag,
      props.request.requester_pubkey,
      reason.value
    )

    if (result.success) {
      ui.showSuccess('Request denied')
      emit('success', result.data)
      close()
    } else {
      ui.showError(result.error || 'Failed to deny request')
    }
  } catch (err) {
    ui.showError(err.message || 'Failed to deny request')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal Container */
.modal-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Modal Content */
.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* Request Info */
.request-info {
  margin-bottom: 1.5rem;
}

.requester-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.requester-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.requester-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
}

.badge-name {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.request-message {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-border);
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

/* Form Groups */
.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.optional {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem 0;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-text);
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}

.form-textarea::placeholder {
  color: var(--color-text-muted);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

/* Warning Box */
.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--color-warning-soft);
  border-radius: var(--radius-md);
  color: var(--color-warning);
}

.warning-box svg {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.warning-box p {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.warning-box strong {
  color: var(--color-text);
}

/* Modal Footer */
.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-danger {
  background: var(--color-danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-hover);
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-border);
  color: var(--color-text);
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

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
  opacity: 0;
}

/* Responsive */
@media (max-width: 480px) {
  .modal-container {
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
