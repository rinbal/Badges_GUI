<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">Request Badge</h2>
            <button class="close-btn" @click="close">
              <IconX :size="20" />
            </button>
          </div>

          <!-- Content -->
          <div class="modal-content">
            <!-- Badge Preview -->
            <div v-if="badge" class="badge-preview">
              <div class="badge-image-container">
                <img
                  v-if="badge.image || badge.badge_image"
                  :src="badge.image || badge.badge_image"
                  :alt="badge.name || badge.badge_name"
                  class="badge-image"
                />
                <div v-else class="badge-placeholder">
                  <IconAward :size="32" />
                </div>
              </div>
              <div class="badge-info">
                <h3 class="badge-name">{{ badge.name || badge.badge_name || 'Badge' }}</h3>
                <p v-if="badge.description" class="badge-desc">{{ truncatedDescription }}</p>
              </div>
            </div>

            <!-- Message Input -->
            <div class="form-group">
              <label class="form-label">
                <IconMessage :size="16" />
                Message to Issuer
                <span class="optional">(optional)</span>
              </label>
              <textarea
                v-model="message"
                class="form-textarea"
                placeholder="Explain why you deserve this badge..."
                rows="3"
                maxlength="500"
              ></textarea>
              <span class="char-count">{{ message.length }}/500</span>
            </div>

            <!-- Proofs Section -->
            <div class="form-group">
              <label class="form-label">
                <IconLink :size="16" />
                Proof Events
                <span class="optional">(optional)</span>
              </label>
              <p class="form-hint">
                Add Nostr event IDs as proof to support your request
              </p>

              <!-- Added Proofs -->
              <div v-if="proofs.length > 0" class="proofs-list">
                <div
                  v-for="(proof, index) in proofs"
                  :key="index"
                  class="proof-item"
                >
                  <div class="proof-icon">
                    <IconNote v-if="proof.type === 'note'" :size="16" />
                    <IconBolt v-else-if="proof.type === 'zap'" :size="16" />
                  </div>
                  <div class="proof-info">
                    <span class="proof-type">{{ proof.type === 'note' ? 'Note' : 'Zap' }}</span>
                    <span class="proof-id">{{ shortEventId(proof.eventId) }}</span>
                  </div>
                  <button class="remove-proof-btn" @click="removeProof(index)">
                    <IconX :size="14" />
                  </button>
                </div>
              </div>

              <!-- Add Proof Form -->
              <div class="add-proof-form">
                <select v-model="newProofType" class="proof-type-select">
                  <option value="note">Note</option>
                  <option value="zap">Zap</option>
                </select>
                <input
                  v-model="newProofId"
                  type="text"
                  class="proof-input"
                  placeholder="Event ID or nevent..."
                  @keyup.enter="addProof"
                />
                <button
                  class="add-proof-btn"
                  :disabled="!newProofId.trim()"
                  @click="addProof"
                >
                  <IconPlus :size="16" />
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="close">
              Cancel
            </button>
            <button
              class="btn btn-primary"
              :disabled="isSubmitting"
              @click="submitRequest"
            >
              <div v-if="isSubmitting" class="spinner-sm"></div>
              <IconSend v-else :size="16" />
              {{ isSubmitting ? 'Sending...' : 'Send Request' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRequestsStore } from '@/stores/requests'
import {
  IconX,
  IconAward,
  IconMessage,
  IconLink,
  IconNote,
  IconBolt,
  IconPlus,
  IconSend
} from '@tabler/icons-vue'

const props = defineProps({
  badgeATag: {
    type: String,
    required: true
  },
  badge: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'success'])

const ui = useUIStore()
const requestsStore = useRequestsStore()

// State
const isOpen = ref(true)
const isSubmitting = ref(false)
const message = ref('')
const proofs = ref([])
const newProofType = ref('note')
const newProofId = ref('')

// Computed
const truncatedDescription = computed(() => {
  const desc = props.badge?.description || ''
  if (desc.length <= 100) return desc
  return desc.slice(0, 100) + '...'
})

// Methods
function shortEventId(eventId) {
  if (!eventId) return ''
  if (eventId.length <= 16) return eventId
  return `${eventId.slice(0, 8)}...${eventId.slice(-6)}`
}

function addProof() {
  const id = newProofId.value.trim()
  if (!id) return

  // Extract event ID from nevent or note format
  let eventId = id
  if (id.startsWith('nevent1') || id.startsWith('note1')) {
    // For now, just use the raw string - backend will handle decoding
    eventId = id
  }

  // Check for duplicates
  if (proofs.value.some(p => p.eventId === eventId)) {
    ui.showWarning('This proof is already added')
    return
  }

  proofs.value.push({
    type: newProofType.value,
    eventId
  })

  newProofId.value = ''
}

function removeProof(index) {
  proofs.value.splice(index, 1)
}

function close() {
  isOpen.value = false
  setTimeout(() => {
    emit('close')
  }, 200)
}

async function submitRequest() {
  isSubmitting.value = true

  try {
    const result = await requestsStore.createRequest(
      props.badgeATag,
      message.value,
      proofs.value
    )

    if (result.success) {
      ui.showSuccess('Badge request sent!')
      emit('success', result.data)
      close()
    } else {
      ui.showError(result.error || 'Failed to send request')
    }
  } catch (err) {
    ui.showError(err.message || 'Failed to send request')
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
  max-width: 440px;
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

/* Badge Preview */
.badge-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg);
  margin-bottom: 1.5rem;
}

.badge-image-container {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface);
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
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface) 100%);
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
  margin: 0 0 0.25rem 0;
}

.badge-desc {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

/* Form Groups */
.form-group {
  margin-bottom: 1.5rem;
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
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
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

/* Proofs List */
.proofs-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.proof-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.proof-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.proof-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.proof-type {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
}

.proof-id {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.remove-proof-btn {
  background: none;
  border: none;
  padding: 0.375rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-proof-btn:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Add Proof Form */
.add-proof-form {
  display: flex;
  gap: 0.5rem;
}

.proof-type-select {
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  min-width: 80px;
}

.proof-type-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.proof-input {
  flex: 1;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  color: var(--color-text);
  font-family: var(--font-mono);
}

.proof-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.proof-input::placeholder {
  font-family: inherit;
  color: var(--color-text-muted);
}

.add-proof-btn {
  padding: 0.625rem 0.75rem;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-proof-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-proof-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

  .add-proof-form {
    flex-wrap: wrap;
  }

  .proof-type-select {
    width: 100%;
  }

  .proof-input {
    flex: 1;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
