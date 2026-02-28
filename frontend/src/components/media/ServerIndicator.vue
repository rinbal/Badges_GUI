<template>
  <div class="server-indicator" ref="wrapperRef">
    <!-- Trigger button -->
    <button class="indicator-trigger" @click="isOpen = !isOpen">
      <Icon name="server" size="sm" />
      <span class="indicator-text">{{ servers.length }} server{{ servers.length !== 1 ? 's' : '' }}</span>
      <Icon :name="isOpen ? 'chevron-up' : 'chevron-down'" size="xs" />
    </button>

    <!-- Popover -->
    <Transition name="popover">
      <div v-if="isOpen" class="indicator-popover">
        <div class="popover-header">
          <h4>Blossom Servers</h4>
        </div>

        <!-- Server list -->
        <div class="popover-list">
          <div v-for="(server, idx) in servers" :key="idx" class="popover-server">
            <span class="popover-host">{{ hostname(server) }}</span>
            <span v-if="isDefault(server)" class="popover-badge">Default</span>
            <button
              v-else
              class="popover-remove"
              title="Remove"
              @click="removeServer(idx)"
            >
              <Icon name="x" size="xs" />
            </button>
          </div>
        </div>

        <!-- Add server input -->
        <div class="popover-add">
          <input
            v-model="newServer"
            type="url"
            placeholder="https://server.example"
            class="popover-input"
            @keydown.enter="addServer"
          />
          <button class="popover-add-btn" :disabled="!isValidUrl" @click="addServer">
            <Icon name="plus" size="xs" />
          </button>
        </div>
        <p v-if="addError" class="popover-error">{{ addError }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '@/components/common/Icon.vue'
import { DEFAULT_BLOSSOM_SERVERS, getConfiguredServers, setConfiguredServers } from '@/services/blossom.service'

const isOpen = ref(false)
const servers = ref([])
const newServer = ref('')
const addError = ref('')
const wrapperRef = ref(null)

onMounted(() => {
  servers.value = getConfiguredServers()
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

function onClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

const isValidUrl = computed(() => {
  try {
    const url = new URL(newServer.value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
})

function isDefault(server) {
  return DEFAULT_BLOSSOM_SERVERS.includes(server)
}

function hostname(server) {
  try { return new URL(server).hostname }
  catch { return server }
}

function addServer() {
  addError.value = ''
  if (!isValidUrl.value) { addError.value = 'Invalid URL'; return }

  const url = newServer.value.replace(/\/$/, '')
  if (servers.value.includes(url)) { addError.value = 'Already added'; return }

  servers.value.push(url)
  setConfiguredServers(servers.value)
  newServer.value = ''
}

function removeServer(idx) {
  servers.value.splice(idx, 1)
  setConfiguredServers(servers.value)
}
</script>

<style scoped>
.server-indicator {
  position: relative;
}

.indicator-trigger {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.indicator-trigger:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.indicator-text {
  font-variant-numeric: tabular-nums;
}

/* Popover panel */
.indicator-popover {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 300px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  z-index: 50;
  overflow: hidden;
}

.popover-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.popover-header h4 {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);
}

.popover-list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.popover-server {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.popover-server:hover {
  background: var(--color-surface-hover);
}

.popover-host {
  font-size: 0.8125rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-badge {
  font-size: 0.625rem;
  padding: 0.0625rem 0.375rem;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
  flex-shrink: 0;
}

.popover-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  flex-shrink: 0;
}

.popover-remove:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Add server row */
.popover-add {
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.popover-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.8125rem;
  min-width: 0;
}

.popover-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.popover-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.popover-add-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.popover-add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.popover-error {
  color: var(--color-danger);
  font-size: 0.75rem;
  margin: 0;
  padding: 0 0.5rem 0.5rem;
}

/* Popover transition */
.popover-enter-active,
.popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Mobile: full-width popover */
@media (max-width: 480px) {
  .indicator-popover {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
</style>
