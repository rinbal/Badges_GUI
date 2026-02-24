/**
 * Badges Store - Manages badge data
 *
 * Template Types:
 * - App Templates: Official templates provided by the app (read-only, from backend)
 * - User Templates: Custom templates created by the user (editable/deletable)
 *
 * Supports both NIP-07 (extension signing) and nsec (backend signing) flows.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import {
  createBadgeDefinitionEvent,
  createBadgeAwardEvent,
  createProfileBadgesEvent,
  createAppDataEvent,
  signEvent,
  npubToHex
} from '@/utils/nip07'

// NIP-78 d-tag for user templates
const TEMPLATES_D_TAG = 'badgebox-templates'

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
  const rejectedBadgeIds = ref(new Set(JSON.parse(localStorage.getItem('rejectedBadgeIds') || '[]')))
  const isLoading = ref(false)
  const hasFetchedPending = ref(false)
  const hasFetchedAccepted = ref(false)
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

  const visiblePendingBadges = computed(() =>
    pendingBadges.value.filter(b => !rejectedBadgeIds.value.has(b.award_event_id))
  )
  const pendingCount = computed(() => visiblePendingBadges.value.length)
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
   * Fetch user templates from Nostr relays via backend (NIP-78 kind 30078)
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

  /**
   * Build and sign a kind 30078 event containing the full template list (NIP-07 flow)
   */
  async function _buildSignedTemplatesEvent(templatesList) {
    const event = createAppDataEvent(TEMPLATES_D_TAG, JSON.stringify(templatesList))
    return await signEvent(event)
  }

  /**
   * Create a new user template and publish to Nostr relays (NIP-78 kind 30078)
   * NIP-07: signs full updated list in browser, backend publishes
   * nsec: backend fetches current list, adds, signs, publishes
   */
  async function createTemplate(template) {
    isLoading.value = true
    error.value = null

    const authStore = useAuthStore()
    const newEntry = {
      identifier: template.identifier,
      name: template.name,
      description: template.description || '',
      image: template.image || ''
    }

    try {
      if (authStore.isNip07) {
        const newList = [...userTemplates.value, newEntry]
        const signedEvent = await _buildSignedTemplatesEvent(newList)
        const response = await api.syncTemplates({ signed_event: signedEvent })
        if (response.data.success) userTemplates.value = newList
        return { success: response.data.success, error: response.data.error, template: newEntry }
      } else {
        const response = await api.syncTemplates({ action: 'create', template: newEntry })
        if (response.data.success) userTemplates.value.push(newEntry)
        return { success: response.data.success, error: response.data.error, template: newEntry }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a user template and republish updated list to Nostr relays
   */
  async function deleteTemplate(identifier) {
    isLoading.value = true
    error.value = null

    const authStore = useAuthStore()

    try {
      if (authStore.isNip07) {
        const newList = userTemplates.value.filter(t => t.identifier !== identifier)
        const signedEvent = await _buildSignedTemplatesEvent(newList)
        const response = await api.syncTemplates({ signed_event: signedEvent })
        if (response.data.success) userTemplates.value = newList
        return { success: response.data.success }
      } else {
        const response = await api.syncTemplates({ action: 'delete', identifier })
        if (response.data.success)
          userTemplates.value = userTemplates.value.filter(t => t.identifier !== identifier)
        return { success: response.data.success }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update a user template and republish updated list to Nostr relays
   */
  async function updateTemplate(identifier, template) {
    isLoading.value = true
    error.value = null

    const authStore = useAuthStore()

    try {
      if (authStore.isNip07) {
        const newList = userTemplates.value.map(t =>
          t.identifier === identifier ? { ...t, ...template } : t
        )
        const signedEvent = await _buildSignedTemplatesEvent(newList)
        const response = await api.syncTemplates({ signed_event: signedEvent })
        if (response.data.success) userTemplates.value = newList
        return { success: response.data.success }
      } else {
        const response = await api.syncTemplates({ action: 'update', identifier, template })
        if (response.data.success) {
          const idx = userTemplates.value.findIndex(t => t.identifier === identifier)
          if (idx !== -1) userTemplates.value[idx] = { ...userTemplates.value[idx], ...template }
        }
        return { success: response.data.success }
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create and award a badge
   * Automatically handles signing for NIP-07 or delegates to backend for nsec
   */
  async function createAndAwardBadge(badge, recipients) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedDefinitionEvent = null
      let signedAwardEvent = null

      // NIP-07 flow: sign events in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing events with extension')

        // Sign badge definition
        const definitionEvent = createBadgeDefinitionEvent(badge)
        signedDefinitionEvent = await signEvent(definitionEvent)

        if (!signedDefinitionEvent) {
          throw new Error('Failed to sign badge definition')
        }

        // Build a_tag from signed definition
        const aTag = `30009:${signedDefinitionEvent.pubkey}:${badge.identifier}`

        // Convert recipients to hex
        const hexRecipients = recipients.map(r =>
          r.startsWith('npub1') ? npubToHex(r) : r
        )

        // Sign badge award
        const awardEvent = createBadgeAwardEvent(aTag, hexRecipients)
        signedAwardEvent = await signEvent(awardEvent)

        if (!signedAwardEvent) {
          throw new Error('Failed to sign badge award')
        }
      }

      // Call API with signed events (NIP-07) or without (nsec)
      const response = await api.createAndAward(
        { ...badge, recipients },
        signedDefinitionEvent,
        signedAwardEvent
      )

      // Extract error from response if not successful
      if (!response.data.success) {
        error.value = response.data.error || 'Badge creation failed'
        return { success: false, error: error.value, data: response.data }
      }

      return { success: true, data: response.data }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Unknown error'
      error.value = errMessage
      return { success: false, error: errMessage }
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
      hasFetchedPending.value = true
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
      hasFetchedAccepted.value = true
    }
  }

  /**
   * Accept a badge - adds it to profile badges (kind 30008)
   * For NIP-07: Signs the profile badges event in browser
   * For nsec: Backend handles signing
   */
  async function acceptBadge(a_tag, award_event_id) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: build and sign profile badges event
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing profile badges event for accept')

        // Ensure we have fresh accepted badges data
        if (!acceptedBadges.value || acceptedBadges.value.length === 0) {
          console.log('   Fetching current accepted badges first...')
          await fetchAcceptedBadges()
        }

        // Get current accepted badges to build the new list
        const currentAccepted = acceptedBadges.value || []
        console.log(`   Current accepted badges: ${currentAccepted.length}`)

        // Build badge tags: for each badge, add ["a", a_tag] and ["e", award_event_id]
        const badgeTags = []

        // Add existing badges
        for (const badge of currentAccepted) {
          badgeTags.push(['a', badge.a_tag])
          badgeTags.push(['e', badge.award_event_id])
        }

        // Add new badge
        badgeTags.push(['a', a_tag])
        badgeTags.push(['e', award_event_id])

        // Create and sign the profile badges event
        const unsignedEvent = createProfileBadgesEvent(badgeTags)
        console.log('   Unsigned event:', JSON.stringify(unsignedEvent, null, 2))

        signedEvent = await signEvent(unsignedEvent)
        console.log('   Signed event:', signedEvent ? 'success' : 'failed')

        if (!signedEvent) {
          throw new Error('Failed to sign profile badges event')
        }
      }

      console.log('   Sending to API with signed_event:', signedEvent ? 'present' : 'null')
      const response = await api.acceptBadge(a_tag, award_event_id, signedEvent)
      if (response.data.success) {
        // Refresh lists
        await fetchPendingBadges()
        await fetchAcceptedBadges()
      }
      return { success: response.data.success, data: response.data }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to accept badge'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Remove a badge - removes it from profile badges (kind 30008)
   * For NIP-07: Signs the updated profile badges event in browser
   * For nsec: Backend handles signing
   */
  async function removeBadge(a_tag, award_event_id) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: build and sign profile badges event without the removed badge
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing profile badges event for remove')

        // Get current accepted badges and filter out the one to remove
        const currentAccepted = acceptedBadges.value || []
        const remaining = currentAccepted.filter(
          b => !(b.a_tag === a_tag && b.award_event_id === award_event_id)
        )

        // Build badge tags for remaining badges
        const badgeTags = []
        for (const badge of remaining) {
          badgeTags.push(['a', badge.a_tag])
          badgeTags.push(['e', badge.award_event_id])
        }

        // Create and sign the profile badges event
        const unsignedEvent = createProfileBadgesEvent(badgeTags)
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign profile badges event')
        }
      }

      const response = await api.removeBadge(a_tag, award_event_id, signedEvent)
      if (response.data.success) {
        // Refresh lists
        await fetchPendingBadges()
        await fetchAcceptedBadges()
      }
      return { success: response.data.success, data: response.data }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to remove badge'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  function rejectBadge(award_event_id) {
    rejectedBadgeIds.value.add(award_event_id)
    localStorage.setItem('rejectedBadgeIds', JSON.stringify([...rejectedBadgeIds.value]))
  }

  function clearBadges() {
    pendingBadges.value = []
    acceptedBadges.value = []
    hasFetchedPending.value = false
    hasFetchedAccepted.value = false
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
    hasFetchedPending,
    hasFetchedAccepted,
    error,

    // Getters
    appTemplates,           // Official app templates (read-only, from API)
    templates,              // User templates with source metadata
    allTemplates,           // All templates combined
    userTemplateCount,      // Count of user templates
    appTemplateCount,       // Count of app templates
    visiblePendingBadges,
    pendingCount,
    acceptedCount,

    // Actions
    fetchAppTemplates,      // Fetch app templates from API (filesystem)
    fetchUserTemplates,     // Fetch user templates from Nostr relays (NIP-78)
    fetchAllTemplates,      // Fetch both app and user templates
    createTemplate,         // NIP-78: publish updated list with new template
    deleteTemplate,         // NIP-78: publish updated list without deleted template
    updateTemplate,         // NIP-78: publish updated list with modified template
    createAndAwardBadge,
    fetchPendingBadges,
    fetchAcceptedBadges,
    acceptBadge,
    removeBadge,
    rejectBadge,
    clearBadges,
    clearAppTemplates
  }
})

