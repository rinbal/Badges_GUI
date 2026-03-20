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
import { fetchRelayInfo, normalizeURL } from 'nostr-core'
import { getPool } from '@/services/outbox'

const STORAGE_KEY = 'badgebox_relays'

const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://relay.0xchat.com', read: true, write: true },
  { url: 'wss://nostr.mom', read: true, write: true },
  { url: 'wss://purplepag.es', read: true, write: false },
  { url: 'wss://relay.nos.social', read: true, write: false },
  { url: 'wss://relay.snort.social', read: true, write: false },
  { url: 'wss://nostr.wine', read: true, write: false }
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
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function addRelay(url, { read = true, write = true } = {}) {
    const normalized = norm(url)
    if (!normalized) return { success: false, error: 'Invalid relay URL' }
    if (relays.value.some(r => r.url === normalized)) return { success: false, error: 'Relay already exists' }

    const relay = makeRelay(url, read, write)
    relays.value.push(relay)
    saveToStorage()
    connectOne(relay)
    fetchInfo(relay)
    return { success: true }
  }

  function removeRelay(url) {
    relays.value = relays.value.filter(r => r.url !== url)
    saveToStorage()
  }

  function toggleRead(url) {
    const r = find(url)
    if (r) { r.read = !r.read; saveToStorage() }
  }

  function toggleWrite(url) {
    const r = find(url)
    if (r) { r.write = !r.write; saveToStorage() }
  }

  function resetToDefaults() {
    relays.value = DEFAULT_RELAYS.map(r => makeRelay(r.url, r.read, r.write))
    saveToStorage()
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
    relays, isInitialized,
    relayCount, readRelays, writeRelays, connectedCount,
    init, addRelay, removeRelay, toggleRead, toggleWrite, resetToDefaults,
    connectAll, reconnectRelay, refreshConnectionStatus,
    fetchInfo, fetchAllInfo
  }
})
