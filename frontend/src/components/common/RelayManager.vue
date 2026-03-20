<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="relay-overlay" @click.self="$emit('close')">
        <div class="relay-modal">
          <!-- Header -->
          <div class="relay-header">
            <div class="header-left">
              <Icon name="server" size="md" class="header-icon" />
              <div>
                <h3>Relay Management</h3>
                <p class="header-sub">
                  <span class="status-dot" :class="overallStatus"></span>
                  {{ relayStore.connectedCount }}/{{ relayStore.relayCount }} connected
                </p>
              </div>
            </div>
            <button class="close-btn" @click="$emit('close')" title="Close">
              <Icon name="x" size="sm" />
            </button>
          </div>

          <!-- Add Relay -->
          <div class="add-relay">
            <div class="add-input-row">
              <div class="add-input-wrapper">
                <input
                  v-model="newRelayUrl"
                  type="text"
                  placeholder="wss://relay.example.com"
                  :class="{ 'has-error': addError }"
                  @keydown.enter.prevent="handleAdd"
                />
              </div>
              <button class="add-btn" :disabled="!newRelayUrl.trim()" @click="handleAdd">
                <Icon name="plus" size="xs" />
                Add
              </button>
            </div>
            <p v-if="addError" class="add-error">{{ addError }}</p>
          </div>

          <!-- Relay List -->
          <div class="relay-list">
            <div v-if="relayStore.relays.length === 0" class="empty-state">
              <Icon name="server" size="lg" class="empty-icon" />
              <p>No relays configured</p>
              <button class="reset-link" @click="relayStore.resetToDefaults()">Restore defaults</button>
            </div>

            <div v-else>
              <div v-for="relay in relayStore.relays" :key="relay.url" class="relay-item">
                <div class="relay-main">
                  <span class="status-indicator" :class="relay.status" :title="statusLabel(relay.status)"></span>
                  <div class="relay-url-col">
                    <span class="relay-url">{{ stripProtocol(relay.url) }}</span>
                    <span v-if="relay.info?.name" class="relay-name">{{ relay.info.name }}</span>
                  </div>
                </div>

                <div class="relay-perms">
                  <button :class="['perm-btn', { active: relay.read }]" @click="relayStore.toggleRead(relay.url)" title="Read">R</button>
                  <button :class="['perm-btn', { active: relay.write }]" @click="relayStore.toggleWrite(relay.url)" title="Write">W</button>
                </div>

                <div class="relay-actions">
                  <button class="action-icon-btn" @click="toggleExpanded(relay.url)" :title="expandedRelay === relay.url ? 'Hide info' : 'Show info'">
                    <Icon :name="expandedRelay === relay.url ? 'chevron-up' : 'chevron-down'" size="xs" />
                  </button>
                  <button
                    class="action-icon-btn reconnect"
                    @click="relayStore.reconnectRelay(relay.url)"
                    :title="relay.status === 'connecting' ? 'Connecting...' : 'Reconnect'"
                    :disabled="relay.status === 'connecting'"
                  >
                    <Icon name="refresh" size="xs" :spin="relay.status === 'connecting'" />
                  </button>
                  <button class="action-icon-btn danger" @click="handleRemove(relay.url)" title="Remove relay">
                    <Icon name="trash" size="xs" />
                  </button>
                </div>

                <!-- Expanded Info -->
                <Transition name="expand">
                  <div v-if="expandedRelay === relay.url" class="relay-info-panel">
                    <div v-if="relay.infoLoading" class="info-loading">
                      <Icon name="refresh" size="xs" spin /> Fetching relay info...
                    </div>
                    <div v-else-if="relay.info" class="info-grid">
                      <div v-if="relay.info.name" class="info-row">
                        <span class="info-label">Name</span>
                        <span class="info-value">{{ relay.info.name }}</span>
                      </div>
                      <div v-if="relay.info.description" class="info-row">
                        <span class="info-label">Description</span>
                        <span class="info-value desc">{{ relay.info.description }}</span>
                      </div>
                      <div v-if="relay.info.software" class="info-row">
                        <span class="info-label">Software</span>
                        <span class="info-value mono">{{ formatSoftware(relay.info) }}</span>
                      </div>
                      <div v-if="relay.info.supported_nips?.length" class="info-row">
                        <span class="info-label">NIPs</span>
                        <div class="nip-tags">
                          <span v-for="nip in relay.info.supported_nips.slice(0, 20)" :key="nip" class="nip-tag">{{ nip }}</span>
                          <span v-if="relay.info.supported_nips.length > 20" class="nip-tag more">+{{ relay.info.supported_nips.length - 20 }}</span>
                        </div>
                      </div>
                      <div v-if="relay.info.limitation" class="info-row">
                        <span class="info-label">Limits</span>
                        <div class="limit-tags">
                          <span v-if="relay.info.limitation.auth_required" class="limit-tag warn">Auth required</span>
                          <span v-if="relay.info.limitation.payment_required" class="limit-tag warn">Payment required</span>
                          <span v-if="relay.info.limitation.max_content_length" class="limit-tag">Max {{ formatNumber(relay.info.limitation.max_content_length) }} chars</span>
                        </div>
                      </div>
                      <div v-if="relay.info.contact" class="info-row">
                        <span class="info-label">Contact</span>
                        <span class="info-value mono">{{ relay.info.contact }}</span>
                      </div>
                    </div>
                    <div v-else class="info-empty">Could not fetch relay info</div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="relay-footer">
            <button class="footer-btn" @click="relayStore.refreshConnectionStatus()">
              <Icon name="refresh" size="xs" /> Reconnect All
            </button>
            <button class="footer-btn danger" @click="handleResetDefaults">Reset to Defaults</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRelayStore } from '@/stores/relays'
import Icon from '@/components/common/Icon.vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

defineEmits(['close'])

const relayStore = useRelayStore()
const newRelayUrl = ref('')
const addError = ref('')
const expandedRelay = ref(null)

watch(() => props.visible, (v) => {
  if (v) {
    newRelayUrl.value = ''
    addError.value = ''
    expandedRelay.value = null
    if (relayStore.isInitialized) relayStore.fetchAllInfo()
  }
})

const overallStatus = computed(() => {
  if (relayStore.relayCount === 0) return 'disconnected'
  if (relayStore.connectedCount === relayStore.relayCount) return 'connected'
  if (relayStore.connectedCount > 0) return 'partial'
  return 'error'
})

function handleAdd() {
  addError.value = ''
  if (!newRelayUrl.value.trim()) return
  const result = relayStore.addRelay(newRelayUrl.value)
  if (result.success) { newRelayUrl.value = '' } else { addError.value = result.error }
}

function handleRemove(url) {
  relayStore.removeRelay(url)
  if (expandedRelay.value === url) expandedRelay.value = null
}

function handleResetDefaults() {
  relayStore.resetToDefaults()
  expandedRelay.value = null
}

function toggleExpanded(url) {
  if (expandedRelay.value === url) {
    expandedRelay.value = null
  } else {
    expandedRelay.value = url
    const relay = relayStore.relays.find(r => r.url === url)
    if (relay) relayStore.fetchInfo(relay)
  }
}

function stripProtocol(url) { return url.replace(/^wss?:\/\//, '').replace(/\/$/, '') }
function statusLabel(s) {
  return { connected: 'Connected', connecting: 'Connecting...', error: 'Connection failed' }[s] || 'Disconnected'
}
function formatSoftware(info) {
  const name = (info.software || '').split('/').pop() || info.software || ''
  return info.version ? `${name} ${info.version}` : name
}
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return String(n)
}
</script>

<style scoped>
.relay-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.relay-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-width: 540px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.relay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.header-left { display: flex; align-items: center; gap: 0.75rem; }
.header-icon { color: var(--color-primary); }
.relay-header h3 { font-size: 1rem; margin: 0; }
.header-sub { font-size: 0.75rem; color: var(--color-text-muted); margin: 0.125rem 0 0; display: flex; align-items: center; gap: 0.375rem; }

.close-btn {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md);
  color: var(--color-text-muted); cursor: pointer; transition: all 0.15s;
}
.close-btn:hover { background: var(--color-surface-hover); color: var(--color-text); }

.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.connected { background: var(--color-success); }
.status-dot.partial { background: rgb(251, 191, 36); }
.status-dot.error, .status-dot.disconnected { background: var(--color-danger); }

.add-relay { padding: 1rem 1.5rem; border-bottom: 1px solid var(--color-border); }
.add-input-row { display: flex; gap: 0.5rem; }
.add-input-wrapper { flex: 1; }
.add-input-wrapper input {
  width: 100%; padding: 0.5rem 0.75rem; background: var(--color-surface-elevated);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  font-family: var(--font-mono); font-size: 0.8125rem; color: var(--color-text); transition: border-color 0.15s;
}
.add-input-wrapper input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-soft); }
.add-input-wrapper input.has-error { border-color: var(--color-danger); }

.add-btn {
  display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem 0.875rem;
  background: var(--color-primary); color: white; border: none; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.add-btn:hover:not(:disabled) { background: var(--color-primary-hover); }
.add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.add-error { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--color-danger); }

.relay-list { flex: 1; overflow-y: auto; min-height: 0; }

.empty-state { text-align: center; padding: 3rem 1.5rem; color: var(--color-text-muted); }
.empty-icon { opacity: 0.4; margin-bottom: 0.75rem; }
.empty-state p { margin: 0 0 0.75rem; font-size: 0.875rem; }
.reset-link { background: none; border: none; color: var(--color-primary); font-size: 0.8125rem; cursor: pointer; text-decoration: underline; }

.relay-item {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--color-border); transition: background 0.15s;
}
.relay-item:hover { background: var(--color-surface-elevated); }
.relay-item:last-child { border-bottom: none; }

.relay-main { display: flex; align-items: center; gap: 0.625rem; flex: 1; min-width: 0; }

.status-indicator { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-indicator.connected { background: var(--color-success); box-shadow: 0 0 6px rgba(34, 197, 94, 0.4); }
.status-indicator.connecting { background: rgb(251, 191, 36); animation: pulse 1.5s ease infinite; }
.status-indicator.error { background: var(--color-danger); }
.status-indicator.disconnected { background: var(--color-text-subtle); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.relay-url-col { display: flex; flex-direction: column; min-width: 0; }
.relay-url { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.relay-name { font-size: 0.6875rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.relay-perms { display: flex; gap: 0.25rem; flex-shrink: 0; }
.perm-btn {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: 0.625rem; font-weight: 700; color: var(--color-text-subtle); cursor: pointer; transition: all 0.15s;
}
.perm-btn:hover { border-color: var(--color-primary); }
.perm-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

.relay-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.action-icon-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: var(--radius-sm);
  color: var(--color-text-subtle); cursor: pointer; transition: all 0.15s;
}
.action-icon-btn:hover { background: var(--color-surface-hover); color: var(--color-text); }
.action-icon-btn.reconnect:hover { color: var(--color-primary); }
.action-icon-btn.danger:hover { background: var(--color-danger-soft); color: var(--color-danger); }
.action-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.relay-info-panel { flex-basis: 100%; width: 100%; padding: 0.75rem 0 0.25rem 1.625rem; border-top: 1px dashed var(--color-border); margin-top: 0.375rem; }
.info-loading { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted); padding: 0.5rem 0; }
.info-empty { font-size: 0.75rem; color: var(--color-text-subtle); padding: 0.375rem 0; }
.info-grid { display: flex; flex-direction: column; gap: 0.5rem; }
.info-row { display: flex; gap: 0.75rem; font-size: 0.75rem; }
.info-label { width: 72px; flex-shrink: 0; color: var(--color-text-muted); font-weight: 500; }
.info-value { color: var(--color-text); min-width: 0; }
.info-value.desc { line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.info-value.mono { font-family: var(--font-mono); font-size: 0.6875rem; }

.nip-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.nip-tag { padding: 0.125rem 0.375rem; background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.625rem; font-weight: 600; color: var(--color-text-muted); }
.nip-tag.more { background: var(--color-primary-soft); border-color: var(--color-primary); color: var(--color-primary); }

.limit-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.limit-tag { padding: 0.125rem 0.375rem; background: var(--color-surface-elevated); border-radius: var(--radius-sm); font-size: 0.625rem; color: var(--color-text-muted); }
.limit-tag.warn { background: rgba(251, 191, 36, 0.1); color: rgb(217, 163, 15); }

.relay-footer {
  display: flex; gap: 0.75rem; padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border); background: var(--color-surface-elevated);
}
.footer-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.375rem;
  padding: 0.625rem; background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); font-size: 0.8125rem; font-weight: 500; color: var(--color-text);
  cursor: pointer; transition: all 0.15s;
}
.footer-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.footer-btn.danger:hover { border-color: var(--color-danger); color: var(--color-danger); background: var(--color-danger-soft); }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .relay-modal, .modal-leave-active .relay-modal { transition: transform 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relay-modal, .modal-leave-to .relay-modal { transform: scale(0.95) translateY(8px); }

.expand-enter-active { transition: opacity 0.2s ease; }
.expand-leave-active { transition: opacity 0.15s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .relay-modal { max-height: 92vh; }
  .relay-header, .add-relay, .relay-footer { padding-left: 1rem; padding-right: 1rem; }
  .relay-item { padding-left: 1rem; padding-right: 1rem; }
  .relay-url { font-size: 0.75rem; }
  .relay-footer { flex-direction: column; }
}
</style>
