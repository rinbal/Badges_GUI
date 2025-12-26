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
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!nsec.value)
  
  const shortNpub = computed(() => {
    if (!npub.value) return null
    return `${npub.value.slice(0, 12)}...${npub.value.slice(-8)}`
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

  function logout() {
    nsec.value = null
    npub.value = null
    hex.value = null
    sessionStorage.removeItem('nsec')
    sessionStorage.removeItem('npub')
    sessionStorage.removeItem('hex')
  }

  return {
    // State
    nsec,
    npub,
    hex,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    shortNpub,
    // Actions
    login,
    logout
  }
})

