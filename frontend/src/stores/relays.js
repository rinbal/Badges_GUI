/**
 * Relay Store - Central relay management using nostr-core
 *
 * Manages the user's relay list with read/write permissions,
 * connection status monitoring, and NIP-11 relay info fetching.
 * Persists to localStorage and can publish/load NIP-65 relay list events.
 */

import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { RelayPool, fetchRelayInfo, normalizeURL } from 'nostr-core'

const STORAGE_KEY = 'badgebox_relays'

// Sensible defaults — used when no user config exists
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://relay.snort.social', read: true, write: false },
  { url: 'wss://nostr.wine', read: true, write: false }
]

export const useRelayStore = defineStore('relays', () => {
  // =========================================================================
  // State
  // =========================================================================

  // User's relay list: [{ url, read, write }]
  const relays = ref([])

  // Connection status per URL: { url: 'connected' | 'connecting' | 'disconnected' | 'error' }
  const connectionStatus = reactive({})

  // NIP-11 relay info cache: { url: RelayInfo }
  const relayInfo = reactive({})

  // Loading states
  const isLoadingInfo = reactive({})
  const isInitialized = ref(false)

  // Shared pool instance
  let _pool = null

  // =========================================================================
  // Getters
  // =========================================================================

  const relayCount = computed(() => relays.value.length)

  const readRelays = computed(() =>
    relays.value.filter(r => r.read).map(r => r.url)
  )

  const writeRelays = computed(() =>
    relays.value.filter(r => r.write).map(r => r.url)
  )

  const allUrls = computed(() =>
    relays.value.map(r => r.url)
  )

  const connectedCount = computed(() =>
    Object.values(connectionStatus).filter(s => s === 'connected').length
  )

  const hasErrors = computed(() =>
    Object.values(connectionStatus).some(s => s === 'error')
  )

  // =========================================================================
  // Pool Management
  // =========================================================================

  function getPool() {
    if (!_pool) {
      _pool = new RelayPool()
    }
    return _pool
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  function init() {
    if (isInitialized.value) return

    const stored = loadFromStorage()
    if (stored && stored.length > 0) {
      relays.value = stored
    } else {
      relays.value = DEFAULT_RELAYS.map(r => ({ ...r }))
    }

    isInitialized.value = true
    refreshConnectionStatus()
  }

  // =========================================================================
  // Relay CRUD
  // =========================================================================

  function addRelay(url, { read = true, write = true } = {}) {
    const normalized = normalizeUrl(url)
    if (!normalized) return { success: false, error: 'Invalid relay URL' }

    if (relays.value.some(r => r.url === normalized)) {
      return { success: false, error: 'Relay already exists' }
    }

    relays.value.push({ url: normalized, read, write })
    saveToStorage()
    checkConnection(normalized)
    fetchInfo(normalized)
    return { success: true }
  }

  function removeRelay(url) {
    const idx = relays.value.findIndex(r => r.url === url)
    if (idx === -1) return

    relays.value.splice(idx, 1)
    delete connectionStatus[url]
    delete relayInfo[url]
    saveToStorage()

    // Disconnect from pool
    try {
      const pool = getPool()
      pool.close([url])
    } catch { /* ignore */ }
  }

  function toggleRead(url) {
    const relay = relays.value.find(r => r.url === url)
    if (!relay) return
    relay.read = !relay.read
    saveToStorage()
  }

  function toggleWrite(url) {
    const relay = relays.value.find(r => r.url === url)
    if (!relay) return
    relay.write = !relay.write
    saveToStorage()
  }

  function setRelayPermissions(url, { read, write }) {
    const relay = relays.value.find(r => r.url === url)
    if (!relay) return
    if (read !== undefined) relay.read = read
    if (write !== undefined) relay.write = write
    saveToStorage()
  }

  function resetToDefaults() {
    // Disconnect all current relays
    try {
      const pool = getPool()
      pool.close(allUrls.value)
    } catch { /* ignore */ }

    relays.value = DEFAULT_RELAYS.map(r => ({ ...r }))
    Object.keys(connectionStatus).forEach(k => delete connectionStatus[k])
    Object.keys(relayInfo).forEach(k => delete relayInfo[k])
    Object.keys(isLoadingInfo).forEach(k => delete isLoadingInfo[k])
    saveToStorage()
    refreshConnectionStatus()
  }

  // =========================================================================
  // Connection Status
  // =========================================================================

  async function checkConnection(url) {
    connectionStatus[url] = 'connecting'

    try {
      const pool = getPool()
      await pool.ensureRelay(url, { connectionTimeout: 5000 })
      connectionStatus[url] = 'connected'
    } catch {
      connectionStatus[url] = 'error'
    }
  }

  async function refreshConnectionStatus() {
    const promises = relays.value.map(r => checkConnection(r.url))
    await Promise.allSettled(promises)
  }

  async function reconnectRelay(url) {
    // Close existing connection first
    try {
      const pool = getPool()
      pool.close([url])
    } catch { /* ignore */ }

    await checkConnection(url)
  }

  // =========================================================================
  // NIP-11 Relay Info
  // =========================================================================

  async function fetchInfo(url) {
    if (relayInfo[url] || isLoadingInfo[url]) return

    isLoadingInfo[url] = true

    try {
      const info = await fetchRelayInfo(url)
      relayInfo[url] = info
    } catch {
      relayInfo[url] = null
    } finally {
      isLoadingInfo[url] = false
    }
  }

  async function fetchAllInfo() {
    const promises = relays.value.map(r => fetchInfo(r.url))
    await Promise.allSettled(promises)
  }

  function getInfo(url) {
    return relayInfo[url] || null
  }

  // =========================================================================
  // Persistence (localStorage)
  // =========================================================================

  function saveToStorage() {
    try {
      const data = relays.value.map(({ url, read, write }) => ({ url, read, write }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return null
      return parsed.filter(r => r.url && typeof r.url === 'string')
    } catch {
      return null
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function normalizeUrl(url) {
    try {
      let normalized = url.trim()
      // Add wss:// if missing
      if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
        normalized = 'wss://' + normalized
      }
      // Use nostr-core's normalizer if available
      try {
        normalized = normalizeURL(normalized)
      } catch { /* use as-is */ }
      // Basic validation
      new URL(normalized)
      return normalized
    } catch {
      return null
    }
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  function destroy() {
    if (_pool) {
      try { _pool.close() } catch { /* ignore */ }
      _pool = null
    }
  }

  return {
    // State
    relays,
    connectionStatus,
    relayInfo,
    isLoadingInfo,
    isInitialized,

    // Getters
    relayCount,
    readRelays,
    writeRelays,
    allUrls,
    connectedCount,
    hasErrors,

    // Pool
    getPool,

    // Init
    init,

    // CRUD
    addRelay,
    removeRelay,
    toggleRead,
    toggleWrite,
    setRelayPermissions,
    resetToDefaults,

    // Connection
    checkConnection,
    refreshConnectionStatus,
    reconnectRelay,

    // NIP-11
    fetchInfo,
    fetchAllInfo,
    getInfo,

    // Cleanup
    destroy
  }
})
