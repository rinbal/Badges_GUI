/**
 * Relay Store - Central relay management using nostr-core
 *
 * Uses the shared outbox pool (single pool for the whole app).
 * Manages user's relay list with read/write permissions,
 * connection status, and NIP-11 relay info.
 * Persists to localStorage.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchRelayInfo, normalizeURL, nip65 } from 'nostr-core'
import { getPool, FALLBACK_RELAYS, INDEXER_RELAYS } from '@/services/outbox'
import { useAuthStore } from '@/stores/auth'

const STORAGE_KEY = 'badgebox_relays'

// Curated free, verified-reachable relays. 0xchat is kept as the NIP-29 group host.
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://relay.0xchat.com', read: true, write: true },
  { url: 'wss://nostr.mom', read: true, write: true },
  { url: 'wss://purplepag.es', read: true, write: false },
  { url: 'wss://relay.nos.social', read: true, write: false },
  { url: 'wss://relay.snort.social', read: true, write: false }
]

function norm(url) {
  try { return normalizeURL(url.trim()) } catch { return null }
}

function makeRelay(url, read, write) {
  return { url: norm(url) || url, read, write, status: 'disconnected', info: null, infoLoading: false }
}

export const useRelayStore = defineStore('relays', () => {
  const relays = ref([])
  const isInitialized = ref(false)

  // Getters
  const relayCount = computed(() => relays.value.length)
  const readRelays = computed(() => relays.value.filter(r => r.read).map(r => r.url))
  const writeRelays = computed(() => relays.value.filter(r => r.write).map(r => r.url))
  const connectedCount = computed(() => relays.value.filter(r => r.status === 'connected').length)

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    if (isInitialized.value) return

    const stored = loadFromStorage()
    if (stored && stored.length > 0) {
      relays.value = stored.map(r => makeRelay(r.url, r.read, r.write))
    } else {
      relays.value = DEFAULT_RELAYS.map(r => makeRelay(r.url, r.read, r.write))
    }
    saveToStorage()
    isInitialized.value = true
    connectAll()

    // Adopt the user's published NIP-65 list (kind 10002) as the source of truth.
    const authStore = useAuthStore()
    if (authStore.hex) loadFromNostr(authStore.hex)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function addRelay(url, { read = true, write = true } = {}) {
    const normalized = norm(url)
    if (!normalized) return { success: false, error: 'Invalid relay URL' }
    if (relays.value.some(r => r.url === normalized)) return { success: false, error: 'Relay already exists' }

    const relay = makeRelay(url, read, write)
    relays.value.push(relay)
    saveToStorage()
    schedulePublish()
    connectOne(relay)
    fetchInfo(relay)
    return { success: true }
  }

  function removeRelay(url) {
    relays.value = relays.value.filter(r => r.url !== url)
    saveToStorage()
    schedulePublish()
  }

  function toggleRead(url) {
    const r = find(url)
    if (r) { r.read = !r.read; saveToStorage(); schedulePublish() }
  }

  function toggleWrite(url) {
    const r = find(url)
    if (r) { r.write = !r.write; saveToStorage(); schedulePublish() }
  }

  function resetToDefaults() {
    relays.value = DEFAULT_RELAYS.map(r => makeRelay(r.url, r.read, r.write))
    saveToStorage()
    schedulePublish()
    connectAll()
    relays.value.forEach(r => fetchInfo(r))
  }

  // ── Connections ──────────────────────────────────────────────────────────

  async function connectOne(relay) {
    relay.status = 'connecting'
    try {
      await getPool().ensureRelay(relay.url, { connectionTimeout: 5000 })
      relay.status = 'connected'
    } catch {
      relay.status = 'error'
    }
  }

  async function connectAll() {
    await Promise.allSettled(relays.value.map(r => connectOne(r)))
  }

  async function reconnectRelay(url) {
    const r = find(url)
    if (!r) return
    try { getPool().close([url]) } catch { /* ok */ }
    await connectOne(r)
  }

  function refreshConnectionStatus() {
    connectAll()
  }

  // ── NIP-11 Info ──────────────────────────────────────────────────────────

  async function fetchInfo(relay) {
    if (relay.info || relay.infoLoading) return
    relay.infoLoading = true
    try {
      relay.info = await fetchRelayInfo(relay.url)
    } catch {
      relay.info = null
    } finally {
      relay.infoLoading = false
    }
  }

  function fetchAllInfo() {
    relays.value.forEach(r => fetchInfo(r))
  }

  // ── NIP-65 (kind 10002 relay list) ─────────────────────────────────────────

  const isPublishing = ref(false)
  let _publishTimer = null

  /**
   * Load the user's published relay list (kind 10002) and adopt it as the
   * source of truth, so the app routes to and from the relays they actually
   * announced (the NIP-65 outbox model). No-op when no list has been published.
   */
  async function loadFromNostr(pubkey) {
    if (!pubkey) return
    try {
      const events = await getPool().querySync(
        [...FALLBACK_RELAYS, ...INDEXER_RELAYS],
        { kinds: [10002], authors: [pubkey] },
        { maxWait: 5000 }
      )
      if (!events.length) return

      const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
      const entries = nip65.parseRelayList(latest).filter(e => norm(e.url))
      if (!entries.length) return

      relays.value = entries.map(e => makeRelay(e.url, e.read, e.write))
      saveToStorage()
      connectAll()
      relays.value.forEach(r => fetchInfo(r))
    } catch (err) {
      console.warn('Failed to load relay list from Nostr:', err)
    }
  }

  /**
   * Publish the current relay list as a kind 10002 event so other clients can
   * discover where to reach and read from this user. Signed with the active
   * signer, published to the user's write relays plus the indexer relays.
   */
  async function publishRelayList() {
    const authStore = useAuthStore()
    const signer = authStore.getSigner()
    if (!signer || relays.value.length === 0) return { success: false }

    isPublishing.value = true
    try {
      const template = nip65.createRelayListEventTemplate(
        relays.value.map(r => ({ url: r.url, read: r.read, write: r.write }))
      )
      const signed = await signer.signEvent(template)
      const targets = [...new Set([...writeRelays.value, ...FALLBACK_RELAYS, ...INDEXER_RELAYS])]
      await getPool().publish(targets, signed)
      return { success: true }
    } catch (err) {
      console.warn('Failed to publish relay list:', err)
      return { success: false, error: err.message }
    } finally {
      isPublishing.value = false
    }
  }

  /** Debounced auto-publish after edits, so the network stays in sync. */
  function schedulePublish() {
    if (_publishTimer) clearTimeout(_publishTimer)
    _publishTimer = setTimeout(() => { publishRelayList() }, 1500)
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(
        relays.value.map(({ url, read, write }) => ({ url, read, write }))
      ))
    } catch { /* ok */ }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed.filter(r => r.url && typeof r.url === 'string')
    } catch { return null }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function find(url) {
    return relays.value.find(r => r.url === url)
  }

  return {
    relays, isInitialized, isPublishing,
    relayCount, readRelays, writeRelays, connectedCount,
    init, addRelay, removeRelay, toggleRead, toggleWrite, resetToDefaults,
    connectAll, reconnectRelay, refreshConnectionStatus,
    fetchInfo, fetchAllInfo,
    loadFromNostr, publishRelayList
  }
})
