/**
 * Badges Store - Manages badge data
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

export const useBadgesStore = defineStore('badges', () => {
  // State
  const templates = ref([])
  const pendingBadges = ref([])
  const acceptedBadges = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const pendingCount = computed(() => pendingBadges.value.length)
  const acceptedCount = computed(() => acceptedBadges.value.length)

  // Actions
  async function fetchTemplates() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.getTemplates()
      templates.value = response.data
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
    } finally {
      isLoading.value = false
    }
  }

  async function createTemplate(template) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.createTemplate(template)
      templates.value.push(response.data)
      return { success: true, template: response.data }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  async function createAndAwardBadge(badge, recipients) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.createAndAward({
        ...badge,
        recipients
      })
      return { success: response.data.success, data: response.data }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPendingBadges() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.getPendingBadges()
      pendingBadges.value = response.data
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAcceptedBadges() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.getAcceptedBadges()
      acceptedBadges.value = response.data
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
    } finally {
      isLoading.value = false
    }
  }

  async function acceptBadge(a_tag, award_event_id) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.acceptBadge(a_tag, award_event_id)
      if (response.data.success) {
        // Refresh lists
        await fetchPendingBadges()
        await fetchAcceptedBadges()
      }
      return { success: response.data.success, data: response.data }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  async function removeBadge(a_tag, award_event_id) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await api.removeBadge(a_tag, award_event_id)
      if (response.data.success) {
        // Refresh lists
        await fetchPendingBadges()
        await fetchAcceptedBadges()
      }
      return { success: response.data.success, data: response.data }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  function clearBadges() {
    pendingBadges.value = []
    acceptedBadges.value = []
  }

  return {
    // State
    templates,
    pendingBadges,
    acceptedBadges,
    isLoading,
    error,
    // Getters
    pendingCount,
    acceptedCount,
    // Actions
    fetchTemplates,
    createTemplate,
    createAndAwardBadge,
    fetchPendingBadges,
    fetchAcceptedBadges,
    acceptBadge,
    removeBadge,
    clearBadges
  }
})

