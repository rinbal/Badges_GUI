/**
 * Auth Store - Manages authentication state and user profile
 *
 * Supports three auth methods:
 * - nip07:  Browser extension (nos2x, Alby) - signs in browser
 * - nsec:   Private key entered manually - backend signs
 * - amber:  Amber Android app via NIP-46 remote signing - signs on phone
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import {
  isNip07Available,
  waitForNip07,
  getPublicKey as getNip07PublicKey,
  signEvent as nip07SignEvent
} from '@/utils/nip07'
import { generateSecretKey, getPublicKey, nip19, SimplePool } from 'nostr-tools'
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'
import { createSigner as createNostrCoreSigner } from '@/services/signer'

// ── NIP-46 config ─────────────────────────────────────────────────────────────
// Relays used for the NIP-46 handshake between BadgeBox and Amber.
// All relays are included in the nostrconnect:// URI so Amber subscribes to all
// of them. Signing requests go through whichever relay responds first, giving
// redundancy if one relay is down or slow.
const NIP46_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
]

// Module-level instances - not reactive (Pinia can't wrap WebSocket objects)
let _bunkerSigner = null
let _bunkerPool = null
let _nostrCoreSigner = null  // Cached nostr-core Signer

// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore('auth', () => {
  // State - Authentication
  const authMethod = ref(sessionStorage.getItem('authMethod') || null) // 'nip07' | 'nsec' | 'amber' | null
  const nsec = ref(sessionStorage.getItem('nsec') || null)
  const npub = ref(sessionStorage.getItem('npub') || null)
  const hex = ref(sessionStorage.getItem('hex') || null)

  // State - Profile (all Nostr kind 0 fields)
  const profile = ref(JSON.parse(sessionStorage.getItem('profile') || 'null'))

  const isLoading = ref(false)
  const error = ref(null)

  // ── Getters ────────────────────────────────────────────────────────────────

  const isAuthenticated = computed(() => !!npub.value && !!authMethod.value)
  const isNip07 = computed(() => authMethod.value === 'nip07')
  const isNsec = computed(() => authMethod.value === 'nsec')
  const isAmber = computed(() => authMethod.value === 'amber')

  /**
   * True for any auth method where signing happens on the client side
   * (NIP-07 extension or Amber app). The backend receives a signed event,
   * never an nsec key.
   */
  const isClientSigning = computed(() => isNip07.value || isAmber.value)

  const shortNpub = computed(() => {
    if (!npub.value) return null
    return `${npub.value.slice(0, 12)}...${npub.value.slice(-4)}`
  })

  const displayName = computed(() => {
    if (!profile.value) return shortNpub.value || 'Anonymous'
    return profile.value.display_name || profile.value.name || shortNpub.value || 'Anonymous'
  })

  const profilePicture = computed(() => profile.value?.picture || null)
  const profileBanner = computed(() => profile.value?.banner || null)
  const profileAbout = computed(() => profile.value?.about || null)
  const profileNip05 = computed(() => profile.value?.nip05 || null)
  const profileLud16 = computed(() => profile.value?.lud16 || null)
  const profileWebsite = computed(() => profile.value?.website || null)

  // ── NIP-07 login ──────────────────────────────────────────────────────────

  async function checkNip07Available() {
    return await waitForNip07(1000)
  }

  async function loginWithExtension() {
    isLoading.value = true
    error.value = null

    try {
      const available = await waitForNip07(1500)
      if (!available) {
        throw new Error('No Nostr extension detected. Please install nos2x, Alby, or similar.')
      }

      const { hex: hexPubkey, npub: npubKey } = await getNip07PublicKey()

      _nostrCoreSigner = null // Clear cached signer for new session
      authMethod.value = 'nip07'
      npub.value = npubKey
      hex.value = hexPubkey
      nsec.value = null

      sessionStorage.setItem('authMethod', 'nip07')
      sessionStorage.setItem('npub', npubKey)
      sessionStorage.setItem('hex', hexPubkey)
      sessionStorage.removeItem('nsec')

      await fetchProfile(npubKey)

      return { success: true }
    } catch (err) {
      error.value = err.message || 'Failed to connect with extension'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // ── nsec login ────────────────────────────────────────────────────────────

  async function login(privateKey) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.validateKey(privateKey)
      const data = response.data

      if (data.valid) {
        _nostrCoreSigner = null // Clear cached signer for new session
        authMethod.value = 'nsec'
        nsec.value = privateKey
        npub.value = data.npub
        hex.value = data.hex

        sessionStorage.setItem('authMethod', 'nsec')
        sessionStorage.setItem('nsec', privateKey)
        sessionStorage.setItem('npub', data.npub)
        sessionStorage.setItem('hex', data.hex)

        await fetchProfile(data.npub)

        return { success: true }
      } else {
        error.value = data.error || 'Invalid key'
        return { success: false, error: error.value }
      }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // ── Amber / NIP-46 login ──────────────────────────────────────────────────

  /**
   * Generate a NIP-46 connection URI and an ephemeral local keypair.
   * Call this to start the Amber connect flow. Display the returned
   * connectUri as a QR code; pass localSk to finalizeAmberLogin() on success.
   *
   * @returns {{ localSk: Uint8Array, connectUri: string }}
   */
  function prepareAmberConnect() {
    const localSk = generateSecretKey()          // Uint8Array - stays in memory only
    const localPk = getPublicKey(localSk)         // hex pubkey embedded in URI

    const secretBytes = new Uint8Array(16)
    crypto.getRandomValues(secretBytes)
    const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const params = new URLSearchParams({
      secret,
      metadata: JSON.stringify({
        name: 'BadgeBox',
        url: window.location.origin,
        description: 'Nostr Badge Platform'
      })
    })
    // URLSearchParams doesn't deduplicate keys, so append each relay separately
    // producing: ?secret=...&metadata=...&relay=wss://relay1&relay=wss://relay2&...
    NIP46_RELAYS.forEach(r => params.append('relay', r))

    const connectUri = `nostrconnect://${localPk}?${params.toString()}`
    return { localSk, connectUri }
  }

  /**
   * Called by LoginView after BunkerSigner.fromURI() resolves.
   * Sets auth state, persists reconnect data, and fetches the user profile.
   *
   * @param {BunkerSigner} signer
   * @param {Uint8Array} localSk  - the ephemeral key used for this connection
   */
  async function finalizeAmberLogin(signer, localSk) {
    _bunkerSigner = signer

    const pubkeyHex = await signer.getPublicKey()
    const npubKey = nip19.npubEncode(pubkeyHex)

    authMethod.value = 'amber'
    hex.value = pubkeyHex
    npub.value = npubKey
    nsec.value = null

    sessionStorage.setItem('authMethod', 'amber')
    sessionStorage.setItem('hex', pubkeyHex)
    sessionStorage.setItem('npub', npubKey)
    sessionStorage.removeItem('nsec')

    // Store what's needed to restore the signer on next page load.
    // bunkerPubkey is the Amber app's relay-facing identity key - used to reconstruct
    // the bunker:// URI. It is always set after a successful fromURI() connection.
    const localSkHex = Array.from(localSk).map(b => b.toString(16).padStart(2, '0')).join('')
    const bunkerPubkey = signer.bp.pubkey
    localStorage.setItem('amberSession', JSON.stringify({
      localSkHex,
      bunkerPubkey,
      relayUrls: NIP46_RELAYS
    }))

    // Fetch profile in background - don't block the login navigation on it
    fetchProfile(npubKey)
  }

  /**
   * Silently restore an Amber signer from localStorage on page reload.
   * No QR re-scan needed - uses the stored connection params.
   * Returns true on success, false if data is missing or reconnect fails.
   */
  async function reconnectAmber() {
    const stored = JSON.parse(localStorage.getItem('amberSession') || 'null')
    if (!stored?.localSkHex || !stored?.bunkerPubkey) return false

    try {
      const localSk = new Uint8Array(
        stored.localSkHex.match(/.{2}/g).map(b => parseInt(b, 16))
      )
      // Support both old single-relay sessions (relayUrl) and new multi-relay sessions (relayUrls)
      const relays = stored.relayUrls ?? (stored.relayUrl ? [stored.relayUrl] : NIP46_RELAYS)
      const relayParams = relays.map(r => `relay=${encodeURIComponent(r)}`).join('&')
      const bunkerUri = `bunker://${stored.bunkerPubkey}?${relayParams}`
      const bp = await parseBunkerInput(bunkerUri)

      _bunkerPool = new SimplePool()
      _bunkerSigner = BunkerSigner.fromBunker(localSk, bp, { pool: _bunkerPool })

      return true
    } catch (err) {
      console.warn('Amber reconnect failed:', err)
      localStorage.removeItem('amberSession')
      _bunkerSigner = null
      _bunkerPool = null
      return false
    }
  }

  /**
   * Call once on app startup (App.vue onMounted).
   * Restores an Amber signer if the last session used Amber.
   */
  async function initAuth() {
    if (authMethod.value === 'amber') {
      const ok = await reconnectAmber()
      if (!ok) logout()
    }
  }

  // ── Event signing ─────────────────────────────────────────────────────────

  /**
   * Sign an event using the current auth method.
   * Returns the signed event for nip07/amber, or null for nsec (backend signs).
   * Used by existing badge/request/blossom code - DO NOT CHANGE this API.
   */
  async function signEvent(unsignedEvent) {
    if (authMethod.value === 'nip07') {
      return await nip07SignEvent(unsignedEvent)
    }
    if (authMethod.value === 'amber') {
      if (!_bunkerSigner) throw new Error('Amber is not connected')
      return await _bunkerSigner.signEvent(unsignedEvent)
    }
    return null // nsec - backend signs using X-Nsec header
  }

  // ── Unified Signer (nostr-core) ────────────────────────────────────────

  /**
   * Get a nostr-core compatible Signer for the current auth method.
   * Used by chat and future features that need encrypt/decrypt support.
   * Returns null if no auth or signer creation fails.
   */
  function getSigner() {
    if (_nostrCoreSigner) return _nostrCoreSigner

    try {
      _nostrCoreSigner = createNostrCoreSigner(authMethod.value, {
        nsec: nsec.value,
        bunkerSigner: _bunkerSigner
      })
      return _nostrCoreSigner
    } catch {
      return null
    }
  }

  /**
   * Clear cached signer so next getSigner() creates a fresh one.
   * Call this when a signer operation fails (e.g. extension disconnected).
   */
  function resetSigner() {
    _nostrCoreSigner = null
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  async function fetchProfile(pubkey) {
    try {
      const response = await api.getProfile(pubkey || npub.value)
      const data = response.data

      profile.value = {
        name: data.name || null,
        display_name: data.display_name || null,
        picture: data.picture || null,
        banner: data.banner || null,
        about: data.about || null,
        nip05: data.nip05 || null,
        lud16: data.lud16 || null,
        website: data.website || null,
        created_at: data.created_at || null
      }

      sessionStorage.setItem('profile', JSON.stringify(profile.value))
    } catch (err) {
      console.warn('Failed to fetch profile:', err)
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  function logout() {
    if (_bunkerSigner) {
      _bunkerSigner.close()
      _bunkerSigner = null
    }
    _bunkerPool = null
    localStorage.removeItem('amberSession')

    // Clear cached signer
    _nostrCoreSigner = null

    // Clean up Nostr relay pool and cache
    import('@/services/outbox').then(({ closePool, clearRelayCache }) => {
      clearRelayCache()
      closePool()
    }).catch(() => {})

    authMethod.value = null
    nsec.value = null
    npub.value = null
    hex.value = null
    profile.value = null

    sessionStorage.removeItem('authMethod')
    sessionStorage.removeItem('nsec')
    sessionStorage.removeItem('npub')
    sessionStorage.removeItem('hex')
    sessionStorage.removeItem('profile')
  }

  return {
    // State
    authMethod,
    nsec,
    npub,
    hex,
    profile,
    isLoading,
    error,

    // Getters
    isAuthenticated,
    isNip07,
    isNsec,
    isAmber,
    isClientSigning,
    shortNpub,
    displayName,
    profilePicture,
    profileBanner,
    profileAbout,
    profileNip05,
    profileLud16,
    profileWebsite,

    // Actions
    checkNip07Available,
    loginWithExtension,
    login,
    prepareAmberConnect,
    finalizeAmberLogin,
    reconnectAmber,
    initAuth,
    logout,
    fetchProfile,
    signEvent,
    getSigner,
    resetSigner
  }
})
