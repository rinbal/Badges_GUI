/**
 * Auth Store - Manages authentication state and user profile
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State - Authentication
  const nsec = ref(sessionStorage.getItem('nsec') || null)
  const npub = ref(sessionStorage.getItem('npub') || null)
  const hex = ref(sessionStorage.getItem('hex') || null)
  
  // State - Profile (all Nostr kind 0 fields)
  const profile = ref(JSON.parse(sessionStorage.getItem('profile') || 'null'))
  
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!nsec.value)
  
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
  async function login(privateKey) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.validateKey(privateKey)
      const data = response.data
      
      if (data.valid) {
        nsec.value = privateKey
        npub.value = data.npub
        hex.value = data.hex
        
        // Store in session (cleared when browser closes)
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
    nsec.value = null
    npub.value = null
    hex.value = null
    profile.value = null
    sessionStorage.removeItem('nsec')
    sessionStorage.removeItem('npub')
    sessionStorage.removeItem('hex')
    sessionStorage.removeItem('profile')
  }

  return {
    // State
    nsec,
    npub,
    hex,
    profile,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    shortNpub,
    displayName,
    profilePicture,
    profileBanner,
    profileAbout,
    profileNip05,
    profileLud16,
    profileWebsite,
    // Actions
    login,
    logout,
    fetchProfile
  }
})
