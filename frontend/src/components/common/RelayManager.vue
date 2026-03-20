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
              <button
                class="add-btn"
                :disabled="!newRelayUrl.trim()"
                @click="handleAdd"
              >
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
              <button class="reset-link" @click="relayStore.resetToDefaults()">
                Restore defaults
              </button>
            </div>

            <TransitionGroup v-else name="list" tag="div">
              <div v-for="relay in relayStore.relays" :key="relay.url" class="relay-item">
                <!-- Status + URL -->
                <div class="relay-main">
                  <span
                    class="status-indicator"
                    :class="relayStore.connectionStatus[relay.url] || 'disconnected'"
                    :title="statusLabel(relayStore.connectionStatus[relay.url])"
                  ></span>
                  <div class="relay-url-col">
                    <span class="relay-url">{{ stripProtocol(relay.url) }}</span>
                    <span v-if="infoName(relay.url)" class="relay-name">{{ infoName(relay.url) }}</span>
                  </div>
                </div>

                <!-- Permissions -->
                <div class="relay-perms">
                  <button
                    :class="['perm-btn', { active: relay.read }]"
                    @click="relayStore.toggleRead(relay.url)"
                    title="Read"
                  >R</button>
                  <button
                    :class="['perm-btn', { active: relay.write }]"
                    @click="relayStore.toggleWrite(relay.url)"
                    title="Write"
                  >W</button>
                </div>

                <!-- Actions -->
                <div class="relay-actions">
                  <button
                    class="action-icon-btn"
                    @click="toggleExpanded(relay.url)"
                    :title="expandedRelay === relay.url ? 'Hide info' : 'Show info'"
                  >
                    <Icon :name="expandedRelay === relay.url ? 'chevron-up' : 'chevron-down'" size="xs" />
                  </button>
                  <button
                    class="action-icon-btn reconnect"
                    @click="relayStore.reconnectRelay(relay.url)"
                    :title="relayStore.connectionStatus[relay.url] === 'connecting' ? 'Connecting...' : 'Reconnect'"
                    :disabled="relayStore.connectionStatus[relay.url] === 'connecting'"
                  >
                    <Icon name="refresh" size="xs" :spin="relayStore.connectionStatus[relay.url] === 'connecting'" />
                  </button>
                  <button
                    class="action-icon-btn danger"
                    @click="handleRemove(relay.url)"
                    title="Remove relay"
                  >
                    <Icon name="trash" size="xs" />
                  </button>
                </div>

                <!-- Expanded Info Panel -->
                <Transition name="expand">
                  <div v-if="expandedRelay === relay.url" class="relay-info-panel">
                    <div v-if="relayStore.isLoadingInfo[relay.url]" class="info-loading">
                      <Icon name="refresh" size="xs" spin />
                      Fetching relay info...
                    </div>
                    <div v-else-if="relayStore.relayInfo[relay.url]" class="info-grid">
                      <div v-if="relayStore.relayInfo[relay.url].name" class="info-row">
                        <span class="info-label">Name</span>
                        <span class="info-value">{{ relayStore.relayInfo[relay.url].name }}</span>
                      </div>
                      <div v-if="relayStore.relayInfo[relay.url].description" class="info-row">
                        <span class="info-label">Description</span>
                        <span class="info-value desc">{{ relayStore.relayInfo[relay.url].description }}</span>
                      </div>
                      <div v-if="relayStore.relayInfo[relay.url].software" class="info-row">
                        <span class="info-label">Software</span>
                        <span class="info-value mono">{{ formatSoftware(relayStore.relayInfo[relay.url]) }}</span>
                      </div>
                      <div v-if="relayStore.relayInfo[relay.url].supported_nips?.length" class="info-row">
                        <span class="info-label">NIPs</span>
                        <div class="nip-tags">
                          <span
                            v-for="nip in relayStore.relayInfo[relay.url].supported_nips.slice(0, 20)"
                            :key="nip"
                            class="nip-tag"
                          >{{ nip }}</span>
                          <span v-if="relayStore.relayInfo[relay.url].supported_nips.length > 20" class="nip-tag more">
                            +{{ relayStore.relayInfo[relay.url].supported_nips.length - 20 }}
                          </span>
                        </div>
                      </div>
                      <div v-if="relayStore.relayInfo[relay.url].limitation" class="info-row">
                        <span class="info-label">Limits</span>
                        <div class="limit-tags">
                          <span v-if="relayStore.relayInfo[relay.url].limitation.auth_required" class="limit-tag warn">Auth required</span>
                          <span v-if="relayStore.relayInfo[relay.url].limitation.payment_required" class="limit-tag warn">Payment required</span>
                          <span v-if="relayStore.relayInfo[relay.url].limitation.max_content_length" class="limit-tag">
                            Max {{ formatNumber(relayStore.relayInfo[relay.url].limitation.max_content_length) }} chars
                          </span>
                        </div>
                      </div>
                      <div v-if="relayStore.relayInfo[relay.url].contact" class="info-row">
                        <span class="info-label">Contact</span>
                        <span class="info-value mono">{{ relayStore.relayInfo[relay.url].contact }}</span>
                      </div>
                    </div>
                    <div v-else class="info-empty">
                      Could not fetch relay info
                    </div>
                  </div>
                </Transition>
              </div>
            </TransitionGroup>
          </div>

          <!-- Footer -->
          <div class="relay-footer">
            <button class="footer-btn" @click="relayStore.refreshConnectionStatus()">
              <Icon name="refresh" size="xs" />
              Reconnect All
            </button>
            <button class="footer-btn danger" @click="handleResetDefaults">
              Reset to Defaults
            </button>
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

const emit = defineEmits(['close'])

const relayStore = useRelayStore()
const newRelayUrl = ref('')
const addError = ref('')
const expandedRelay = ref(null)

// Fetch relay info when modal becomes visible
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    // Reset local state when opening
    newRelayUrl.value = ''
    addError.value = ''
    expandedRelay.value = null
    if (relayStore.isInitialized) {
      relayStore.fetchAllInfo()
    }
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
  const url = newRelayUrl.value.trim()
  if (!url) return

  const result = relayStore.addRelay(url)
  if (result.success) {
    newRelayUrl.value = ''
    relayStore.fetchInfo(relayStore.relays[relayStore.relays.length - 1].url)
  } else {
    addError.value = result.error
  }
}

function handleRemove(url) {
  relayStore.removeRelay(url)
  if (expandedRelay.value === url) expandedRelay.value = null
}

function handleResetDefaults() {
  relayStore.resetToDefaults()
  expandedRelay.value = null
  relayStore.fetchAllInfo()
}

function toggleExpanded(url) {
  if (expandedRelay.value === url) {
    expandedRelay.value = null
  } else {
    expandedRelay.value = url
    relayStore.fetchInfo(url)
  }
}

function stripProtocol(url) {
  return url.replace(/^wss?:\/\//, '')
}

function infoName(url) {
  return relayStore.relayInfo[url]?.name || null
}

function statusLabel(status) {
  switch (status) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting...'
    case 'error': return 'Connection failed'
    default: return 'Disconnected'
  }
}

function formatSoftware(info) {
  const sw = info.software || ''
  const ver = info.version || ''
  const name = sw.split('/').pop() || sw
  return ver ? `${name} ${ver}` : name
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K'
  return n.toString()
}
</script>

<style scoped>
/* Overlay */
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

/* Header */
.relay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  color: var(--color-primary);
}

.relay-header h3 {
  font-size: 1rem;
  margin: 0;
}

.header-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.125rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

/* Status Dot */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected { background: var(--color-success); }
.status-dot.partial { background: rgb(251, 191, 36); }
.status-dot.error,
.status-dot.disconnected { background: var(--color-danger); }

/* Add Relay */
.add-relay {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.add-input-row {
  display: flex;
  gap: 0.5rem;
}

.add-input-wrapper {
  flex: 1;
}

.add-input-wrapper input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  transition: border-color 0.15s;
}

.add-input-wrapper input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-soft);
}

.add-input-wrapper input.has-error {
  border-color: var(--color-danger);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.875rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.add-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-error {
  margin: 0.375rem 0 0;
  font-size: 0.75rem;
  color: var(--color-danger);
}

/* Relay List */
.relay-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  color: var(--color-text-muted);
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: 0.75rem;
}

.empty-state p {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.reset-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  text-decoration: underline;
}

/* Relay Item */
.relay-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}

.relay-item:hover {
  background: var(--color-surface-elevated);
}

.relay-item:last-child {
  border-bottom: none;
}

.relay-main {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;
}

/* Status Indicator */
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.connected {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.status-indicator.connecting {
  background: rgb(251, 191, 36);
  animation: pulse 1.5s ease infinite;
}

.status-indicator.error {
  background: var(--color-danger);
}

.status-indicator.disconnected {
  background: var(--color-text-subtle);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.relay-url-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.relay-url {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relay-name {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Permissions */
.relay-perms {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.perm-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.perm-btn:hover {
  border-color: var(--color-primary);
}

.perm-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

/* Actions */
.relay-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.action-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.action-icon-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.action-icon-btn.reconnect:hover {
  color: var(--color-primary);
}

.action-icon-btn.danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.action-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Expanded Info Panel */
.relay-info-panel {
  flex-basis: 100%;
  width: 100%;
  padding: 0.75rem 0 0.25rem 1.625rem;
  border-top: 1px dashed var(--color-border);
  margin-top: 0.375rem;
}

.info-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  padding: 0.5rem 0;
}

.info-empty {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  padding: 0.375rem 0;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.info-label {
  width: 72px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-weight: 500;
}

.info-value {
  color: var(--color-text);
  min-width: 0;
}

.info-value.desc {
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.info-value.mono {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
}

/* NIP Tags */
.nip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.nip-tag {
  padding: 0.125rem 0.375rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.nip-tag.more {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Limit Tags */
.limit-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.limit-tag {
  padding: 0.125rem 0.375rem;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  color: var(--color-text-muted);
}

.limit-tag.warn {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(217, 163, 15);
}

/* Footer */
.relay-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.footer-btn.danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .relay-modal,
.modal-leave-active .relay-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relay-modal,
.modal-leave-to .relay-modal {
  transform: scale(0.95) translateY(8px);
}

/* List transition */
.list-enter-active,
.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* Expand transition */
.expand-enter-active {
  transition: opacity 0.2s ease;
}

.expand-leave-active {
  transition: opacity 0.15s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .relay-modal {
    max-height: 92vh;
  }

  .relay-header,
  .add-relay,
  .relay-footer {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .relay-item {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .relay-url {
    font-size: 0.75rem;
  }

  .relay-footer {
    flex-direction: column;
  }
}
</style>
