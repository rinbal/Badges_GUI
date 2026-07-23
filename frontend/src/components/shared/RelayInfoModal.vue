<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-card">

          <!-- Image header -->
          <div class="modal-hero">
            <img src="/relay_info.png" alt="Nostr relay network" class="hero-image" />
            <div class="hero-gradient" />
            <button class="close-btn" @click="close" aria-label="Close">×</button>
          </div>

          <!-- Content -->
          <div class="modal-body">
            <div class="title-row">
              <span class="title-badge">ℹ</span>
              <h2 class="modal-title">Loading may take a moment</h2>
            </div>

            <p class="modal-lead">
              Data is loaded live from <strong>Nostr relays</strong> across the network. This means some things take a little longer than you might expect.
            </p>

            <div class="info-list">
              <div class="info-item">
                <span class="item-icon">⏱</span>
                <div class="item-text">
                  <strong>Expect a short wait</strong>
                  <span>Tabs like <strong>Requests</strong> and <strong>Inbox</strong> may need 5–15 seconds to fully load after opening.</span>
                </div>
              </div>
              <div class="info-item">
                <span class="item-icon">🙏</span>
                <div class="item-text">
                  <strong>Don't refresh right away</strong>
                  <span>If a tab looks empty or incomplete, just wait. It's still fetching from the relay network.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-dismiss" @click="close">Got it, let's go!</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['close'])

const isOpen = ref(false)

onMounted(() => {
  isOpen.value = true
})

function close() {
  isOpen.value = false
  setTimeout(() => emit('close'), 220)
}
</script>

<style scoped>
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1.25rem;
}

/* Card */
.modal-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.04);
}

/* Hero image area */
.modal-hero {
  position: relative;
  height: 180px;
  background: var(--color-surface-elevated);
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 0.75rem;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 40%,
    var(--color-surface) 100%
  );
  pointer-events: none;
}

/* Close button */
.close-btn {
  position: absolute;
  top: 0.625rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  border: none;
  color: white;
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.6);
}

/* Body */
.modal-body {
  padding: 0 1.5rem 0.25rem;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.625rem;
}

.title-badge {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.modal-lead {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.55;
  margin: 0 0 1.125rem;
}

/* Info list */
.info-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0.875rem 1rem;
}

.item-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 0.0625rem;
}

.item-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.item-text strong {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.item-text span {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* Footer */
.modal-footer {
  padding: 1.125rem 1.5rem 1.5rem;
}

.btn-dismiss {
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.btn-dismiss:hover {
  background: var(--color-primary-hover);
}

.btn-dismiss:active {
  transform: scale(0.98);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.94) translateY(8px);
  opacity: 0;
}
</style>
