<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Close Button -->
          <button class="modal-close" @click="close" title="Close">
            ✕
          </button>
          
          <!-- Badge Showcase -->
          <div class="badge-showcase">
            <!-- Badge Image - Featured -->
            <div class="badge-image-wrapper">
              <div class="badge-glow"></div>
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
            </div>
            
            <!-- Badge Info -->
            <div class="badge-info">
              <h2 class="badge-name">{{ badgeName }}</h2>
              
              <p v-if="badgeDescription" class="badge-description">
                {{ badgeDescription }}
              </p>
              
              <!-- Badge Meta -->
              <div class="badge-meta">
                <div class="meta-item">
                  <span class="meta-label">Status</span>
                  <span :class="['meta-value', 'status-badge', isPending ? 'pending' : 'accepted']">
                    {{ isPending ? '⏳ Pending' : '✓ Accepted' }}
                  </span>
                </div>
                
                <div v-if="badge.created_at || badge.awarded_at" class="meta-item">
                  <span class="meta-label">Awarded</span>
                  <span class="meta-value">{{ formatDate(badge.created_at || badge.awarded_at) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Issuer Section -->
          <div class="issuer-section">
            <h3 class="section-title">Issued by</h3>
            <div class="issuer-card">
              <img 
                v-if="issuerPicture" 
                :src="issuerPicture" 
                :alt="issuerDisplayName"
                class="issuer-avatar"
                @error="handleAvatarError"
              />
              <div v-else class="issuer-avatar-placeholder">👤</div>
              
              <div class="issuer-info">
                <span class="issuer-name">{{ issuerDisplayName }}</span>
                <code class="issuer-npub">{{ badge.issuer_npub }}</code>
              </div>
            </div>
          </div>
          
          <!-- Technical Details (Collapsible) -->
          <details class="tech-details">
            <summary>Technical Details</summary>
            <div class="tech-content">
              <div class="tech-row">
                <span class="tech-label">Badge ID (a-tag)</span>
                <code class="tech-value">{{ badge.a_tag }}</code>
              </div>
              <div class="tech-row">
                <span class="tech-label">Award Event ID</span>
                <code class="tech-value">{{ badge.award_event_id }}</code>
              </div>
              <div v-if="badge.identifier" class="tech-row">
                <span class="tech-label">Identifier</span>
                <code class="tech-value">{{ badge.identifier }}</code>
              </div>
            </div>
          </details>
          
          <!-- Actions -->
          <div class="modal-actions">
            <button @click="close" class="btn btn-secondary">
              Close
            </button>
            <button 
              v-if="isPending"
              @click="handleAccept"
              class="btn btn-primary"
              :disabled="loading"
            >
              {{ loading ? 'Accepting...' : '✓ Accept Badge' }}
            </button>
            <button 
              v-else
              @click="handleRemove"
              class="btn btn-danger-outline"
              :disabled="loading"
            >
              {{ loading ? 'Removing...' : 'Remove from Profile' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  badge: {
    type: Object,
    default: () => ({})
  },
  isPending: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'accept', 'remove'])

const imageError = ref(false)
const avatarError = ref(false)

// Reset error states when badge changes
watch(() => props.badge, () => {
  imageError.value = false
  avatarError.value = false
})

// Computed properties
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

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function handleImageError() {
  imageError.value = true
}

function handleAvatarError() {
  avatarError.value = true
}

function close() {
  emit('close')
}

function handleAccept() {
  emit('accept', props.badge)
}

function handleRemove() {
  emit('remove', props.badge)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

.modal-container {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.modal-close:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* Badge Showcase */
.badge-showcase {
  padding: 2.5rem 2rem 1.5rem;
  text-align: center;
  background: linear-gradient(180deg, var(--color-primary-soft) 0%, transparent 100%);
}

.badge-image-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 1.5rem;
}

.badge-glow {
  position: absolute;
  inset: -20px;
  background: radial-gradient(circle, var(--color-primary) 0%, transparent 70%);
  opacity: 0.2;
  border-radius: 50%;
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.1); opacity: 0.3; }
}

.badge-image-container {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
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
  font-size: 4rem;
  background: var(--color-surface-elevated);
}

.badge-info {
  max-width: 360px;
  margin: 0 auto;
}

.badge-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.badge-description {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.badge-meta {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-value {
  font-size: 0.875rem;
  color: var(--color-text);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
}

.status-badge.pending {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-badge.accepted {
  background: var(--color-success-soft);
  color: var(--color-success);
}

/* Issuer Section */
.issuer-section {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--color-border);
}

.section-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 0.75rem 0;
}

.issuer-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.issuer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.issuer-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.issuer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.issuer-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.issuer-npub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Technical Details */
.tech-details {
  margin: 0 2rem;
  padding: 1rem 0;
  border-top: 1px solid var(--color-border);
}

.tech-details summary {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  user-select: none;
}

.tech-details summary:hover {
  color: var(--color-text-muted);
}

.tech-content {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tech-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tech-label {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.tech-value {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--color-surface-elevated);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  white-space: nowrap;
}

/* Actions */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.9375rem;
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

.btn-secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.btn-danger-outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn-danger-outline:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

/* Scrollbar styling */
.modal-container::-webkit-scrollbar {
  width: 6px;
}

.modal-container::-webkit-scrollbar-track {
  background: transparent;
}

.modal-container::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.modal-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-subtle);
}
</style>

