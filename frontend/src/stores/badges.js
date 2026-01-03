/**
 * Badges Store - Manages badge data
 *
 * Template Types:
 * - App Templates: Official templates provided by the app (read-only, from backend)
 * - User Templates: Custom templates created by the user (editable/deletable)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

// Template source constants
const TEMPLATE_SOURCE = Object.freeze({
  APP: 'app',
  USER: 'user'
})

export const useBadgesStore = defineStore('badges', () => {
  // State
  const appTemplatesRaw = ref([])    // App templates from API (read-only)
  const userTemplates = ref([])      // User-created templates from API
  const pendingBadges = ref([])
  const acceptedBadges = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  // Getters

  /**
   * App templates (official, read-only) enriched with source metadata
   */
  const appTemplates = computed(() =>
    appTemplatesRaw.value.map(t => ({
      ...t,
      source: TEMPLATE_SOURCE.APP,
      readonly: true
    }))
  )

  /**
   * User templates enriched with source metadata
   */
  const templates = computed(() =>
    userTemplates.value.map(t => ({
      ...t,
      source: TEMPLATE_SOURCE.USER,
      readonly: false
    }))
  )

  /**
   * All templates combined (app + user)
   */
  const allTemplates = computed(() => [...appTemplates.value, ...templates.value])

  /**
   * User template count for UI display
   */
  const userTemplateCount = computed(() => userTemplates.value.length)

  /**
   * App template count for UI display
   */
  const appTemplateCount = computed(() => appTemplatesRaw.value.length)

  const pendingCount = computed(() => pendingBadges.value.length)
  const acceptedCount = computed(() => acceptedBadges.value.length)

  // Actions

  /**
   * Fetch app templates from API (read-only)
   */
  async function fetchAppTemplates() {
    try {
      const response = await api.getAppTemplates()
      appTemplatesRaw.value = response.data
    } catch (err) {
      console.error('Failed to fetch app templates:', err)
      // Don't set error state - app templates are optional enhancement
    }
  }

  /**
   * Fetch user-created templates from API
   */
  async function fetchUserTemplates() {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.getUserTemplates()
      userTemplates.value = response.data
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all templates (app + user)
   */
  async function fetchAllTemplates() {
    await Promise.all([fetchAppTemplates(), fetchUserTemplates()])
  }

  // Alias for backward compatibility
  const fetchTemplates = fetchUserTemplates

  /**
   * Create a new user template
   */
  async function createTemplate(template) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.createTemplate(template)
      userTemplates.value.push(response.data)
      return { success: true, template: response.data }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a user template (app templates cannot be deleted)
   */
  async function deleteTemplate(identifier) {
    isLoading.value = true
    error.value = null

    try {
      await api.deleteTemplate(identifier)
      userTemplates.value = userTemplates.value.filter(t => t.identifier !== identifier)
      return { success: true }
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

      // Extract error from response if not successful
      if (!response.data.success) {
        error.value = response.data.error || 'Badge creation failed'
        return { success: false, error: error.value, data: response.data }
      }

      return { success: true, data: response.data }
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

  function clearUserTemplates() {
    userTemplates.value = []
  }

  function clearAppTemplates() {
    appTemplatesRaw.value = []
  }

  return {
    // State
    userTemplates,
    pendingBadges,
    acceptedBadges,
    isLoading,
    error,

    // Getters
    appTemplates,           // Official app templates (read-only, from API)
    templates,              // User templates with source metadata
    allTemplates,           // All templates combined
    userTemplateCount,      // Count of user templates
    appTemplateCount,       // Count of app templates
    pendingCount,
    acceptedCount,

    // Actions
    fetchTemplates,         // Alias for fetchUserTemplates
    fetchAppTemplates,      // Fetch app templates from API
    fetchUserTemplates,     // Fetch user templates from API
    fetchAllTemplates,      // Fetch both app and user templates
    createTemplate,
    deleteTemplate,
    createAndAwardBadge,
    fetchPendingBadges,
    fetchAcceptedBadges,
    acceptBadge,
    removeBadge,
    clearBadges,
    clearUserTemplates,
    clearAppTemplates
  }
})

