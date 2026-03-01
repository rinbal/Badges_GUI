/**
 * Requests Store - Manages badge requests (NIP-58 Extension)
 *
 * Pagination strategy: cursor-based, 10 per page.
 * - cursors[0] = null  → page 1 (most recent)
 * - cursors[1] = T1   → page 2 (fetch with until=T1)
 * - cursors[N]        → page N+1
 * Going back is free — reuse the cached cursor for that page.
 *
 * Supports NIP-07 (extension/Amber) and nsec (backend signing) flows.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import {
  createBadgeRequestEvent,
  createBadgeDenialEvent,
  createBadgeAwardEvent
} from '@/utils/nip07'

const PAGE_SIZE = 10

export const useRequestsStore = defineStore('requests', () => {
  // ── Current page data ────────────────────────────────────────────────────

  const incomingRequests = ref([])
  const outgoingRequests = ref([])

  // ── Pagination state ─────────────────────────────────────────────────────

  // cursors[i] is the `until` value needed to fetch page i+1.
  // cursors[0] is always null (fetch from the most recent).
  const incomingPage = ref(1)
  const incomingCursors = ref([null])
  const incomingHasNext = ref(false)

  const outgoingPage = ref(1)
  const outgoingCursors = ref([null])
  const outgoingHasNext = ref(false)

  // ── Counts (from lightweight endpoint, used by nav badge) ────────────────

  const incomingCount = ref(0)
  const pendingCount = ref(0)

  // ── Loading state ────────────────────────────────────────────────────────

  const isLoading = ref(false)
  const hasFetched = ref(false)
  const error = ref(null)

  // ── Getters ──────────────────────────────────────────────────────────────

  const hasOutgoingRequests = computed(() => outgoingRequests.value.length > 0)
  const hasIncomingRequests = computed(() => incomingRequests.value.length > 0)
  const hasPendingRequests = computed(() => pendingCount.value > 0)

  const incomingHasPrev = computed(() => incomingPage.value > 1)
  const outgoingHasPrev = computed(() => outgoingPage.value > 1)

  const outgoingByState = computed(() => {
    const grouped = { pending: [], fulfilled: [], denied: [], withdrawn: [] }
    for (const req of outgoingRequests.value) {
      if (grouped[req.state]) grouped[req.state].push(req)
    }
    return grouped
  })

  const incomingByState = computed(() => {
    const grouped = { pending: [], fulfilled: [], denied: [] }
    for (const req of incomingRequests.value) {
      if (grouped[req.state]) grouped[req.state].push(req)
    }
    return grouped
  })

  const pendingIncoming = computed(() =>
    incomingRequests.value.filter(r => r.state === 'pending')
  )

  // ── Internal page fetcher ────────────────────────────────────────────────

  async function _fetchIncomingPage(page) {
    isLoading.value = true
    error.value = null
    try {
      const cursor = incomingCursors.value[page - 1]
      const response = await api.getIncomingRequests({ limit: PAGE_SIZE, until: cursor })

      incomingRequests.value = response.data.requests
      incomingPage.value = page
      incomingHasNext.value = response.data.has_more

      // Cache the cursor for the next page if not already stored
      if (response.data.has_more && incomingCursors.value.length <= page) {
        incomingCursors.value.push(response.data.next_until)
      }

      pendingCount.value = response.data.requests.filter(r => r.state === 'pending').length
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      console.error('Failed to fetch incoming requests:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function _fetchOutgoingPage(page) {
    isLoading.value = true
    error.value = null
    try {
      const cursor = outgoingCursors.value[page - 1]
      const response = await api.getOutgoingRequests({ limit: PAGE_SIZE, until: cursor })

      outgoingRequests.value = response.data.requests
      outgoingPage.value = page
      outgoingHasNext.value = response.data.has_more

      if (response.data.has_more && outgoingCursors.value.length <= page) {
        outgoingCursors.value.push(response.data.next_until)
      }
    } catch (err) {
      error.value = err.response?.data?.detail || err.message
      console.error('Failed to fetch outgoing requests:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ── Public fetch / navigate ──────────────────────────────────────────────

  /** Load (or reload) page 1 of incoming requests */
  async function fetchIncomingRequests() {
    incomingPage.value = 1
    incomingCursors.value = [null]
    await _fetchIncomingPage(1)
  }

  /** Load (or reload) page 1 of outgoing requests */
  async function fetchOutgoingRequests() {
    outgoingPage.value = 1
    outgoingCursors.value = [null]
    await _fetchOutgoingPage(1)
  }

  /** Navigate to next page of incoming requests */
  async function nextIncomingPage() {
    if (!incomingHasNext.value || isLoading.value) return
    await _fetchIncomingPage(incomingPage.value + 1)
  }

  /** Navigate to previous page of incoming requests */
  async function prevIncomingPage() {
    if (!incomingHasPrev.value || isLoading.value) return
    await _fetchIncomingPage(incomingPage.value - 1)
  }

  /** Navigate to next page of outgoing requests */
  async function nextOutgoingPage() {
    if (!outgoingHasNext.value || isLoading.value) return
    await _fetchOutgoingPage(outgoingPage.value + 1)
  }

  /** Navigate to previous page of outgoing requests */
  async function prevOutgoingPage() {
    if (!outgoingHasPrev.value || isLoading.value) return
    await _fetchOutgoingPage(outgoingPage.value - 1)
  }

  /** Fetch both tabs in parallel (used on mount) */
  async function fetchAll() {
    await Promise.all([
      fetchOutgoingRequests(),
      fetchIncomingRequests()
    ])
    hasFetched.value = true
  }

  /**
   * Lightweight count for the nav badge (no full enrichment)
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

  // ── Request Actions ──────────────────────────────────────────────────────

  async function createRequest(badgeATag, content = '', proofs = []) {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      let signedEvent = null

      if (authStore.isClientSigning) {
        const unsignedEvent = createBadgeRequestEvent(badgeATag, content, proofs)
        signedEvent = await authStore.signEvent(unsignedEvent)
        if (!signedEvent) throw new Error('Failed to sign badge request')
      }

      const proofIds = proofs.map(p => p.eventId)
      const proofTypes = proofs.map(p => p.type || 'note')

      const response = await api.createBadgeRequest(
        badgeATag, content, proofIds, proofTypes, signedEvent
      )

      if (response.data.success) {
        await fetchOutgoingRequests()
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to create request'
      return { success: false, error: error.value }
    } catch (err) {
      const msg = err.message || err.response?.data?.detail || 'Failed to create request'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  async function withdrawRequest(badgeATag) {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      let signedEvent = null

      if (authStore.isClientSigning) {
        const unsignedEvent = createBadgeRequestEvent(badgeATag, '', [], true)
        signedEvent = await authStore.signEvent(unsignedEvent)
        if (!signedEvent) throw new Error('Failed to sign withdrawal')
      }

      const response = await api.withdrawBadgeRequest(badgeATag, signedEvent)

      if (response.data.success) {
        outgoingRequests.value = outgoingRequests.value.filter(
          r => r.badge_a_tag !== badgeATag
        )
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to withdraw request'
      return { success: false, error: error.value }
    } catch (err) {
      const msg = err.message || err.response?.data?.detail || 'Failed to withdraw request'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  async function denyRequest(requestEventId, badgeATag, requesterPubkey, reason = '') {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      let signedEvent = null

      if (authStore.isClientSigning) {
        const unsignedEvent = createBadgeDenialEvent(
          requestEventId, badgeATag, requesterPubkey, reason
        )
        signedEvent = await authStore.signEvent(unsignedEvent)
        if (!signedEvent) throw new Error('Failed to sign denial')
      }

      const response = await api.denyBadgeRequest(
        requestEventId, badgeATag, requesterPubkey, reason, signedEvent
      )

      if (response.data.success) {
        const req = incomingRequests.value.find(r => r.event_id === requestEventId)
        if (req) {
          req.state = 'denied'
          req.denial_reason = reason
        }
        pendingCount.value = incomingRequests.value.filter(r => r.state === 'pending').length
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to deny request'
      return { success: false, error: error.value }
    } catch (err) {
      const msg = err.message || err.response?.data?.detail || 'Failed to deny request'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  async function revokeDenial(requestEventId, badgeATag, requesterPubkey) {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      let signedEvent = null

      if (authStore.isClientSigning) {
        const unsignedEvent = createBadgeDenialEvent(
          requestEventId, badgeATag, requesterPubkey, '', true
        )
        signedEvent = await authStore.signEvent(unsignedEvent)
        if (!signedEvent) throw new Error('Failed to sign revocation')
      }

      const response = await api.revokeDenial(
        requestEventId, badgeATag, requesterPubkey, signedEvent
      )

      if (response.data.success) {
        await fetchIncomingRequests()
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to revoke denial'
      return { success: false, error: error.value }
    } catch (err) {
      const msg = err.message || err.response?.data?.detail || 'Failed to revoke denial'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  async function awardFromRequest(requestEventId, badgeATag, requesterPubkey) {
    isLoading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      let signedEvent = null

      if (authStore.isClientSigning) {
        const unsignedEvent = createBadgeAwardEvent(badgeATag, [requesterPubkey])
        signedEvent = await authStore.signEvent(unsignedEvent)
        if (!signedEvent) throw new Error('Failed to sign award')
      }

      const response = await api.awardFromRequest(
        requestEventId, badgeATag, requesterPubkey, signedEvent
      )

      if (response.data.success) {
        const req = incomingRequests.value.find(r => r.event_id === requestEventId)
        if (req) req.state = 'fulfilled'
        pendingCount.value = incomingRequests.value.filter(r => r.state === 'pending').length
        return { success: true, data: response.data }
      }

      error.value = response.data.error || 'Failed to award badge'
      return { success: false, error: error.value }
    } catch (err) {
      const msg = err.message || err.response?.data?.detail || 'Failed to award badge'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      isLoading.value = false
    }
  }

  /** Clear all state (called on logout) */
  function clearRequests() {
    incomingRequests.value = []
    outgoingRequests.value = []
    incomingCount.value = 0
    pendingCount.value = 0
    incomingPage.value = 1
    incomingCursors.value = [null]
    incomingHasNext.value = false
    outgoingPage.value = 1
    outgoingCursors.value = [null]
    outgoingHasNext.value = false
    hasFetched.value = false
    error.value = null
  }

  return {
    // State
    incomingRequests,
    outgoingRequests,
    incomingCount,
    pendingCount,
    incomingPage,
    incomingHasNext,
    incomingHasPrev,
    outgoingPage,
    outgoingHasNext,
    outgoingHasPrev,
    isLoading,
    hasFetched,
    error,

    // Getters
    hasOutgoingRequests,
    hasIncomingRequests,
    hasPendingRequests,
    outgoingByState,
    incomingByState,
    pendingIncoming,

    // Actions
    fetchIncomingRequests,
    fetchOutgoingRequests,
    nextIncomingPage,
    prevIncomingPage,
    nextOutgoingPage,
    prevOutgoingPage,
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
