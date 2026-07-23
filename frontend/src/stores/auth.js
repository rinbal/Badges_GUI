/**
 * Auth Store - Manages authentication state and user profile
 *
 * Supports three auth methods:
 * - nip07:  Browser extension (nos2x, Alby) - signs in browser
 * - nsec:   Private key entered manually - backend signs
 * - nip46:  Remote signer (Amber, nsec.app, any bunker) - signs on the device,
 *           connected over NIP-46. See services/nip46.js.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import {
  waitForNip07,
  getPublicKey as getNip07PublicKey,
  signEvent as nip07SignEvent
} from '@/utils/nip07'
import { nip19 } from 'nostr-core'
import { createSigner as createNostrCoreSigner } from '@/services/signer'
import {
  createNostrConnectURI,
  awaitNostrConnect,
  connectBunker,
  restoreNip46Signer
} from '@/services/nip46'

// Module-level instances - not reactive (Pinia can't wrap WebSocket objects)
let _remoteSigner = null      // NIP-46 client (Amber / bunker) when authMethod === 'nip46'
let _pendingHandshake = null  // in-flight nostrconnect:// handshake (QR pairing)
let _nostrCoreSigner = null   // Cached nostr-core Signer

// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore('auth', () => {
  // State - Authentication
  const authMethod = ref(sessionStorage.getItem('authMethod') || null) // 'nip07' | 'nsec' | 'nip46' | null
  // For NIP-46 logins, which pairing the user chose: 'amber' (QR) or 'remote' (pasted link).
  const nip46Kind = ref(sessionStorage.getItem('nip46Kind') || null)
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
  const isRemoteSigner = computed(() => authMethod.value === 'nip46')
  // The two NIP-46 pairings, shown as distinct options in the UI.
  const isAmber = computed(() => isRemoteSigner.value && nip46Kind.value === 'amber')
  const isRemoteLogin = computed(() => isRemoteSigner.value && nip46Kind.value === 'remote')

  /**
   * True for any auth method where signing happens on the client side
   * (NIP-07 extension or a remote signer). The backend receives a signed event,
   * never an nsec key.
   */
  const isClientSigning = computed(() => isNip07.value || isRemoteSigner.value)

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

  // ── Remote signer login (NIP-46: Amber, nsec.app, bunker) ─────────────────────

  /**
   * Begin the QR pairing flow. Returns a nostrconnect:// URI to render as a QR
   * code / deep link. Follow with completeNostrConnect() to await approval.
   *
   * @returns {{ uri: string }}
   */
  function beginNostrConnect() {
    _pendingHandshake = createNostrConnectURI({ name: 'BadgeBox', url: window.location.origin })
    return { uri: _pendingHandshake.uri }
  }

  /**
   * Await approval of the pending Amber QR pairing, then finalize login.
   * Pass an AbortSignal to cancel. Throws AbortError on cancel.
   */
  async function completeNostrConnect(signal) {
    if (!_pendingHandshake) throw new Error('No pairing in progress.')
    const { signer, record } = await awaitNostrConnect(_pendingHandshake, signal)
    _pendingHandshake = null
    await finalizeRemoteLogin(signer, record, 'amber')
  }

  /**
   * Connect via a pasted bunker:// or nostrconnect:// link, then finalize login.
   */
  async function connectWithBunkerUri(uri) {
    const { signer, record } = await connectBunker(uri)
    await finalizeRemoteLogin(signer, record, 'remote')
  }

  /**
   * Shared finalize path for any remote-signer connection. Sets auth state,
   * persists the reconnect record (never the user key), and fetches the profile.
   *
   * @param {string} kind - 'amber' (QR pairing) or 'remote' (pasted link)
   */
  async function finalizeRemoteLogin(signer, record, kind) {
    _remoteSigner = signer
    _nostrCoreSigner = null

    const pubkeyHex = await signer.getPublicKey()
    const npubKey = nip19.npubEncode(pubkeyHex)

    authMethod.value = 'nip46'
    nip46Kind.value = kind
    hex.value = pubkeyHex
    npub.value = npubKey
    nsec.value = null

    sessionStorage.setItem('authMethod', 'nip46')
    sessionStorage.setItem('nip46Kind', kind)
    sessionStorage.setItem('hex', pubkeyHex)
    sessionStorage.setItem('npub', npubKey)
    sessionStorage.removeItem('nsec')

    // Enough to silently rebuild the session on reload. Contains no user key,
    // only this app's ephemeral pairing key + the signer's pubkey and relays.
    localStorage.setItem('nip46Session', JSON.stringify({ ...record, userPubkey: pubkeyHex, kind }))

    // Fetch profile in background - don't block the login navigation on it
    fetchProfile(npubKey)
  }

  /**
   * Silently restore a remote signer from localStorage on page reload.
   * No QR re-scan needed - uses the stored pairing record.
   * Returns true on success, false if data is missing or reconnect fails.
   */
  async function reconnectRemoteSigner() {
    const stored = JSON.parse(localStorage.getItem('nip46Session') || 'null')
    if (!stored?.clientSecretKey || !stored?.remotePubkey) return false

    try {
      _remoteSigner = await restoreNip46Signer(stored, stored.userPubkey)
      _nostrCoreSigner = null
      if (stored.kind) {
        nip46Kind.value = stored.kind
        sessionStorage.setItem('nip46Kind', stored.kind)
      }
      return true
    } catch (err) {
      console.warn('Remote signer reconnect failed:', err)
      localStorage.removeItem('nip46Session')
      _remoteSigner = null
      return false
    }
  }

  /**
   * Call once on app startup (App.vue onMounted).
   * Restores a remote signer if the last session used one.
   */
  async function initAuth() {
    if (authMethod.value === 'nip46') {
      const ok = await reconnectRemoteSigner()
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
    if (authMethod.value === 'nip46') {
      if (!_remoteSigner) throw new Error('Remote signer is not connected')
      return await _remoteSigner.signEvent(unsignedEvent)
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

    // The NIP-46 client already implements the nostr-core Signer interface.
    if (authMethod.value === 'nip46') {
      _nostrCoreSigner = _remoteSigner
      return _nostrCoreSigner
    }

    try {
      _nostrCoreSigner = createNostrCoreSigner(authMethod.value, { nsec: nsec.value })
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
    if (_remoteSigner) {
      _remoteSigner.close()
      _remoteSigner = null
    }
    _pendingHandshake = null
    localStorage.removeItem('nip46Session')

    // Clear cached signer
    _nostrCoreSigner = null

    // Clean up Nostr relay pool and cache
    import('@/services/outbox').then(({ closePool, clearRelayCache }) => {
      clearRelayCache()
      closePool()
    }).catch(() => {})

    authMethod.value = null
    nip46Kind.value = null
    nsec.value = null
    npub.value = null
    hex.value = null
    profile.value = null

    sessionStorage.removeItem('authMethod')
    sessionStorage.removeItem('nip46Kind')
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
    isRemoteSigner,
    isAmber,
    isRemoteLogin,
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
    beginNostrConnect,
    completeNostrConnect,
    connectWithBunkerUri,
    initAuth,
    logout,
    fetchProfile,
    signEvent,
    getSigner,
    resetSigner
  }
})
