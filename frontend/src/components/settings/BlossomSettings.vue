<template>
  <div class="blossom-settings">
    <div class="settings-header" @click="isExpanded = !isExpanded">
      <div class="settings-title">
        <Icon name="server" size="md" />
        <h3>Blossom Servers</h3>
      </div>
      <Icon :name="isExpanded ? 'chevron-up' : 'chevron-down'" size="sm" />
    </div>

    <div v-if="isExpanded" class="settings-body">
      <p class="settings-hint">Configure which Blossom servers to use for media uploads</p>

      <!-- Server list -->
      <div class="server-list">
        <div v-for="(server, idx) in servers" :key="idx" class="server-item">
          <div class="server-info">
            <span class="server-host">{{ hostname(server) }}</span>
            <span v-if="isDefault(server)" class="server-badge">Default</span>
          </div>
          <button
            v-if="!isDefault(server)"
            class="server-remove"
            title="Remove server"
            @click="removeServer(idx)"
          >
            <Icon name="x" size="xs" />
          </button>
        </div>
      </div>

      <!-- Add server -->
      <div class="add-server">
        <input
          v-model="newServer"
          type="url"
          placeholder="https://your-blossom-server.com"
          class="add-input"
          @keydown.enter="addServer"
        />
        <button class="add-btn" :disabled="!isValidUrl" @click="addServer">
          <Icon name="plus" size="sm" />
          Add
        </button>
      </div>
      <p v-if="addError" class="add-error">{{ addError }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '@/components/common/Icon.vue'
import { DEFAULT_BLOSSOM_SERVERS, getConfiguredServers, setConfiguredServers } from '@/services/blossom.service'

const isExpanded = ref(false)
const servers = ref([])
const newServer = ref('')
const addError = ref('')

onMounted(() => {
  servers.value = getConfiguredServers()
})

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
  try {
    return new URL(server).hostname
  } catch {
    return server
  }
}

function addServer() {
  addError.value = ''
  if (!isValidUrl.value) {
    addError.value = 'Enter a valid URL'
    return
  }

  const url = newServer.value.replace(/\/$/, '')
  if (servers.value.includes(url)) {
    addError.value = 'Server already added'
    return
  }

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
.blossom-settings {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.settings-header:hover {
  background: var(--color-surface-hover);
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.settings-title h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.settings-body {
  padding: 0 1.25rem 1.25rem;
}

.settings-hint {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  margin: 0 0 1rem;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.server-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.server-host {
  color: var(--color-text);
  font-size: 0.875rem;
  font-family: var(--font-mono);
}

.server-badge {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.server-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.server-remove:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.add-server {
  display: flex;
  gap: 0.5rem;
}

.add-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875rem;
}

.add-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.add-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: 0.5rem 0 0;
}
</style>
