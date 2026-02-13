<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Badge Preview (if available) -->
          <div v-if="badge" class="badge-preview">
            <img
              v-if="(badge.image || badge.thumb) && !imageError"
              :src="badge.thumb || badge.image"
              :alt="badge.name"
              class="badge-preview-image"
              @error="imageError = true"
            />
            <div v-else class="badge-preview-placeholder">
              <IconAward :size="32" />
            </div>
          </div>

          <!-- Content -->
          <div class="modal-body">
            <h2 class="modal-title">Log in to continue</h2>
            <p class="modal-text">
              Connect with your Nostr identity to request
              <strong v-if="badge?.name">{{ badge.name }}</strong>
              <template v-else>badges</template>
              and explore full badge details.
            </p>
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <router-link
              to="/login"
              class="btn btn-primary"
              @click="close"
            >
              <IconKey :size="18" />
              <span>Connect with Nostr</span>
            </router-link>
            <button class="btn btn-ghost" @click="close">
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { IconAward, IconKey } from '@tabler/icons-vue'

defineProps({
  badge: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const isOpen = ref(false)
const imageError = ref(false)

onMounted(() => {
  isOpen.value = true
})

function close() {
  isOpen.value = false
  setTimeout(() => {
    emit('close')
  }, 200)
}
</script>

<style scoped>
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

.modal-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 360px;
  overflow: hidden;
  text-align: center;
}

/* Badge Preview */
.badge-preview {
  padding: 1.5rem 1.5rem 0;
  display: flex;
  justify-content: center;
}

.badge-preview-image {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  object-fit: cover;
  border: 2px solid var(--color-border);
}

.badge-preview-placeholder {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-soft) 0%, var(--color-surface-elevated) 100%);
  color: var(--color-primary);
}

/* Body */
.modal-body {
  padding: 1.25rem 1.5rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem 0;
}

.modal-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

/* Actions */
.modal-actions {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.btn-ghost:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
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
</style>
