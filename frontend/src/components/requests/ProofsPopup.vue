<template>
  <Teleport to="body">
    <div class="popup-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <div class="popup" role="dialog" aria-modal="true">

        <div class="popup-header">
          <span class="popup-title">
            <IconLink :size="16" />
            {{ proofs.length }} Proof{{ proofs.length !== 1 ? 's' : '' }}
          </span>
          <button class="close-btn" @click="$emit('close')">
            <IconX :size="18" />
          </button>
        </div>

        <div class="proof-list">
          <div v-for="(proof, i) in proofs" :key="proof.event_id || i" class="proof-item">

            <div class="proof-icon" :class="proof.proof_type">
              <IconBolt v-if="proof.proof_type === 'zap'" :size="18" />
              <IconFileText v-else :size="18" />
            </div>

            <div class="proof-body">
              <div class="proof-top">
                <span class="proof-type-label">{{ proof.proof_type === 'zap' ? 'Zap' : 'Note' }}</span>
                <span class="proof-status" :class="proof.verified ? 'verified' : 'unverified'">
                  <IconCheck v-if="proof.verified" :size="11" />
                  <IconAlertTriangle v-else :size="11" />
                  {{ proof.verified ? 'Verified' : 'Unverified' }}
                </span>
              </div>

              <p v-if="proof.proof_type === 'zap' && proof.amount_sats" class="proof-detail">
                {{ proof.amount_sats.toLocaleString() }} sats
                <span v-if="proof.sender_name" class="proof-from"> · {{ proof.sender_name }}</span>
              </p>
              <p v-else-if="proof.proof_type !== 'zap' && proof.content" class="proof-detail">
                {{ proof.content }}
              </p>

              <p v-if="proof.error" class="proof-error">{{ proof.error }}</p>

              <span v-if="proof.created_at" class="proof-time">{{ formatTime(proof.created_at) }}</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import {
  IconLink,
  IconX,
  IconBolt,
  IconFileText,
  IconCheck,
  IconAlertTriangle
} from '@tabler/icons-vue'

defineProps({
  proofs: { type: Array, required: true }
})
const emit = defineEmits(['close'])

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts * 1000)
  const diff = Date.now() - date
  if (diff < 3600000) {
    const m = Math.floor(diff / 60000)
    return m <= 1 ? 'Just now' : `${m}m ago`
  }
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString()
}
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.popup {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.close-btn:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

.proof-list {
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.proof-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
}

.proof-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}
.proof-icon.zap {
  background: rgba(250, 200, 0, 0.12);
  color: #f59e0b;
}
.proof-icon.note {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.proof-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.proof-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proof-type-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.proof-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}
.proof-status.verified {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.proof-status.unverified {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.proof-detail {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  word-break: break-word;
}

.proof-from {
  color: var(--color-text-muted);
}

.proof-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger);
}

.proof-time {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}
</style>
