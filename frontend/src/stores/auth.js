/**
 * Auth Store - Manages authentication state and user profile
 * Supports both NIP-07 browser extension and raw nsec authentication
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

export const useAuthStore = defineStore('auth', () => {
  // State - Authentication
  const authMethod = ref(sessionStorage.getItem('authMethod') || null) // 'nip07' | 'nsec' | null
  const nsec = ref(sessionStorage.getItem('nsec') || null)
  const npub = ref(sessionStorage.getItem('npub') || null)
  const hex = ref(sessionStorage.getItem('hex') || null)

  // State - Profile (all Nostr kind 0 fields)
  const profile = ref(JSON.parse(sessionStorage.getItem('profile') || 'null'))

  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!npub.value && !!authMethod.value)
  const isNip07 = computed(() => authMethod.value === 'nip07')
  const isNsec = computed(() => authMethod.value === 'nsec')
  
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

  // Actions

  /**
   * Check if NIP-07 extension is available
   */
  async function checkNip07Available() {
    return await waitForNip07(1000)
  }

  /**
   * Login with NIP-07 browser extension (recommended)
   */
  async function loginWithExtension() {
    isLoading.value = true
    error.value = null

    try {
      // Check if extension is available
      const available = await waitForNip07(1500)
      if (!available) {
        throw new Error('No Nostr extension detected. Please install nos2x, Alby, or similar.')
      }

      // Get public key from extension
      const { hex: hexPubkey, npub: npubKey } = await getNip07PublicKey()

      // Set auth state
      authMethod.value = 'nip07'
      npub.value = npubKey
      hex.value = hexPubkey
      nsec.value = null // No nsec with NIP-07

      // Store in session
      sessionStorage.setItem('authMethod', 'nip07')
      sessionStorage.setItem('npub', npubKey)
      sessionStorage.setItem('hex', hexPubkey)
      sessionStorage.removeItem('nsec')

      // Fetch profile data
      await fetchProfile(npubKey)

      return { success: true }
    } catch (err) {
      error.value = err.message || 'Failed to connect with extension'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Login with raw nsec (fallback method)
   */
  async function login(privateKey) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.validateKey(privateKey)
      const data = response.data

      if (data.valid) {
        authMethod.value = 'nsec'
        nsec.value = privateKey
        npub.value = data.npub
        hex.value = data.hex

        // Store in session (cleared when browser closes)
        sessionStorage.setItem('authMethod', 'nsec')
        sessionStorage.setItem('nsec', privateKey)
        sessionStorage.setItem('npub', data.npub)
        sessionStorage.setItem('hex', data.hex)

        // Fetch profile data
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

  /**
   * Sign an event using the current auth method
   * @param {Object} unsignedEvent - Event without id, pubkey, sig
   * @returns {Promise<Object|null>} - Signed event or null if nsec method (backend signs)
   */
  async function signEvent(unsignedEvent) {
    if (authMethod.value === 'nip07') {
      return await nip07SignEvent(unsignedEvent)
    }
    // For nsec, return null - backend will sign
    return null
  }

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
      // Profile fetch is optional, don't fail login
      console.warn('Failed to fetch profile:', err)
    }
  }

  function logout() {
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
    logout,
    fetchProfile,
    signEvent
  }
})
