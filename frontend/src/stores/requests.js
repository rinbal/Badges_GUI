/**
 * Requests Store - Manages badge requests (NIP-58 Extension)
 *
 * Handles:
 * - Outgoing requests (requests you sent)
 * - Incoming requests (requests for your badges)
 * - Request actions (create, withdraw, deny, award)
 *
 * Supports both NIP-07 (extension signing) and nsec (backend signing) flows.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import {
  createBadgeRequestEvent,
  createBadgeDenialEvent,
  createBadgeAwardEvent,
  signEvent
} from '@/utils/nip07'

export const useRequestsStore = defineStore('requests', () => {
  // State
  const outgoingRequests = ref([])    // Requests I sent
  const incomingRequests = ref([])    // Requests for my badges
  const incomingCount = ref(0)        // Total incoming count
  const pendingCount = ref(0)         // Pending incoming count
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const hasOutgoingRequests = computed(() => outgoingRequests.value.length > 0)
  const hasIncomingRequests = computed(() => incomingRequests.value.length > 0)
  const hasPendingRequests = computed(() => pendingCount.value > 0)

  /**
   * Get outgoing requests by state
   */
  const outgoingByState = computed(() => {
    const grouped = {
      pending: [],
      fulfilled: [],
      denied: [],
      withdrawn: []
    }
    for (const req of outgoingRequests.value) {
      if (grouped[req.state]) {
        grouped[req.state].push(req)
      }
    }
    return grouped
  })

  /**
   * Get incoming requests by state
   */
  const incomingByState = computed(() => {
    const grouped = {
      pending: [],
      fulfilled: [],
      denied: []
    }
    for (const req of incomingRequests.value) {
      if (grouped[req.state]) {
        grouped[req.state].push(req)
      }
    }
    return grouped
  })

  /**
   * Get only pending incoming requests
   */
  const pendingIncoming = computed(() =>
    incomingRequests.value.filter(r => r.state === 'pending')
  )

  // Actions

  /**
   * Fetch outgoing requests (requests you sent)
   */
  async function fetchOutgoingRequests() {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.getOutgoingRequests()
      outgoingRequests.value = response.data
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      console.error('Failed to fetch outgoing requests:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch incoming requests (requests for your badges)
   */
  async function fetchIncomingRequests() {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.getIncomingRequests()
      incomingRequests.value = response.data

      // Update counts
      incomingCount.value = response.data.length
      pendingCount.value = response.data.filter(r => r.state === 'pending').length
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      console.error('Failed to fetch incoming requests:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch incoming requests count (lightweight)
   */
  async function fetchIncomingCount() {
    try {
      const response = await api.getIncomingRequestsCount()
      incomingCount.value = response.data.count
      pendingCount.value = response.data.pending_count
    } catch (err) {
      console.error('Failed to fetch incoming count:', err)
    }
  }

  /**
   * Fetch all requests data
   */
  async function fetchAll() {
    await Promise.all([
      fetchOutgoingRequests(),
      fetchIncomingRequests()
    ])
  }

  /**
   * Create a badge request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} content - Message to issuer
   * @param {Array} proofs - Array of {eventId, type} objects
   */
  async function createRequest(badgeATag, content = '', proofs = []) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: sign in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing badge request')

        const unsignedEvent = createBadgeRequestEvent(badgeATag, content, proofs)
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign badge request')
        }
      }

      // Extract proof data for API
      const proofIds = proofs.map(p => p.eventId)
      const proofTypes = proofs.map(p => p.type || 'note')

      const response = await api.createBadgeRequest(
        badgeATag,
        content,
        proofIds,
        proofTypes,
        signedEvent
      )

      if (response.data.success) {
        // Refresh outgoing requests
        await fetchOutgoingRequests()
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to create request'
      return { success: false, error: error.value }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to create request'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Withdraw a badge request
   * @param {string} badgeATag - Badge definition a-tag
   */
  async function withdrawRequest(badgeATag) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: sign in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing withdrawal')

        const unsignedEvent = createBadgeRequestEvent(badgeATag, '', [], true)
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign withdrawal')
        }
      }

      const response = await api.withdrawBadgeRequest(badgeATag, signedEvent)

      if (response.data.success) {
        // Remove from local state
        outgoingRequests.value = outgoingRequests.value.filter(
          r => r.badge_a_tag !== badgeATag
        )
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to withdraw request'
      return { success: false, error: error.value }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to withdraw request'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Deny a badge request
   * @param {string} requestEventId - Event ID of the request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   * @param {string} reason - Reason for denial
   */
  async function denyRequest(requestEventId, badgeATag, requesterPubkey, reason = '') {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: sign in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing denial')

        const unsignedEvent = createBadgeDenialEvent(
          requestEventId,
          badgeATag,
          requesterPubkey,
          reason
        )
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign denial')
        }
      }

      const response = await api.denyBadgeRequest(
        requestEventId,
        badgeATag,
        requesterPubkey,
        reason,
        signedEvent
      )

      if (response.data.success) {
        // Update local state
        const request = incomingRequests.value.find(r => r.event_id === requestEventId)
        if (request) {
          request.state = 'denied'
          request.denial_reason = reason
        }
        pendingCount.value = incomingRequests.value.filter(r => r.state === 'pending').length
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to deny request'
      return { success: false, error: error.value }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to deny request'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Revoke a denial
   * @param {string} requestEventId - Event ID of the original request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   */
  async function revokeDenial(requestEventId, badgeATag, requesterPubkey) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: sign in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing revocation')

        const unsignedEvent = createBadgeDenialEvent(
          requestEventId,
          badgeATag,
          requesterPubkey,
          '',
          true // revoked
        )
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign revocation')
        }
      }

      const response = await api.revokeDenial(
        requestEventId,
        badgeATag,
        requesterPubkey,
        signedEvent
      )

      if (response.data.success) {
        // Refresh incoming requests
        await fetchIncomingRequests()
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to revoke denial'
      return { success: false, error: error.value }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to revoke denial'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Award a badge from a request
   * @param {string} requestEventId - Event ID of the request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   */
  async function awardFromRequest(requestEventId, badgeATag, requesterPubkey) {
    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      let signedEvent = null

      // NIP-07 flow: sign in browser
      if (authStore.isNip07) {
        console.log('🔐 NIP-07 flow: Signing award')

        const unsignedEvent = createBadgeAwardEvent(badgeATag, [requesterPubkey])
        signedEvent = await signEvent(unsignedEvent)

        if (!signedEvent) {
          throw new Error('Failed to sign award')
        }
      }

      const response = await api.awardFromRequest(
        requestEventId,
        badgeATag,
        requesterPubkey,
        signedEvent
      )

      if (response.data.success) {
        // Update local state
        const request = incomingRequests.value.find(r => r.event_id === requestEventId)
        if (request) {
          request.state = 'fulfilled'
        }
        pendingCount.value = incomingRequests.value.filter(r => r.state === 'pending').length
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to award badge'
      return { success: false, error: error.value }
    } catch (err) {
      const errMessage = err.message || err.response?.data?.detail || 'Failed to award badge'
      error.value = errMessage
      return { success: false, error: errMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear all request data
   */
  function clearRequests() {
    outgoingRequests.value = []
    incomingRequests.value = []
    incomingCount.value = 0
    pendingCount.value = 0
    error.value = null
  }

  return {
    // State
    outgoingRequests,
    incomingRequests,
    incomingCount,
    pendingCount,
    isLoading,
    error,

    // Getters
    hasOutgoingRequests,
    hasIncomingRequests,
    hasPendingRequests,
    outgoingByState,
    incomingByState,
    pendingIncoming,

    // Actions
    fetchOutgoingRequests,
    fetchIncomingRequests,
    fetchIncomingCount,
    fetchAll,
    createRequest,
    withdrawRequest,
    denyRequest,
    revokeDenial,
    awardFromRequest,
    clearRequests
  }
})
