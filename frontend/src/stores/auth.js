/**
 * Auth Store - Manages authentication state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const nsec = ref(sessionStorage.getItem('nsec') || null)
  const npub = ref(sessionStorage.getItem('npub') || null)
  const hex = ref(sessionStorage.getItem('hex') || null)
  const profileName = ref(sessionStorage.getItem('profileName') || null)
  const profilePicture = ref(sessionStorage.getItem('profilePicture') || null)
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!nsec.value)
  
  const shortNpub = computed(() => {
    if (!npub.value) return null
    return `${npub.value.slice(0, 8)}...${npub.value.slice(-4)}`
  })

  const displayName = computed(() => {
    return profileName.value || shortNpub.value || 'Anonymous'
  })

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
      
      profileName.value = data.name || data.display_name || null
      profilePicture.value = data.picture || null
      
      if (profileName.value) {
        sessionStorage.setItem('profileName', profileName.value)
      }
      if (profilePicture.value) {
        sessionStorage.setItem('profilePicture', profilePicture.value)
      }
    } catch (err) {
      // Profile fetch is optional, don't fail login
      console.warn('Failed to fetch profile:', err)
    }
  }

  function logout() {
    nsec.value = null
    npub.value = null
    hex.value = null
    profileName.value = null
    profilePicture.value = null
    sessionStorage.removeItem('nsec')
    sessionStorage.removeItem('npub')
    sessionStorage.removeItem('hex')
    sessionStorage.removeItem('profileName')
    sessionStorage.removeItem('profilePicture')
  }

  return {
    // State
    nsec,
    npub,
    hex,
    profileName,
    profilePicture,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    shortNpub,
    displayName,
    // Actions
    login,
    logout,
    fetchProfile
  }
})
