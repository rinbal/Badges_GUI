/**
 * API Client - Axios instance with interceptors
 *
 * Supports two auth flows:
 * - NIP-07: No X-Nsec header, signed events sent in request body
 * - nsec: X-Nsec header added automatically
 */

import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// Use environment variable for API URL, fallback to /api/v1 for dev proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,  // 2 minutes for relay operations
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add auth headers based on auth method
apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()

    if (authStore.isNsec && authStore.nsec) {
      // nsec flow: send private key for backend signing
      config.headers['X-Nsec'] = authStore.nsec
    } else if (authStore.isNip07 && authStore.hex) {
      // NIP-07 flow: send pubkey for identification (read operations)
      config.headers['X-Pubkey'] = authStore.hex
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
    }
    return Promise.reject(error)
  }
)

// API methods
export const api = {
  // Auth
  validateKey: (nsec) =>
    apiClient.post('/auth/validate', { nsec }),

  // Badges - Templates
  getAppTemplates: () =>
    apiClient.get('/badges/templates/app'),

  getUserTemplates: () =>
    apiClient.get('/badges/templates/user'),

  getTemplates: () =>
    apiClient.get('/badges/templates'),

  createTemplate: (template) =>
    apiClient.post('/badges/templates', template),

  deleteTemplate: (identifier) =>
    apiClient.delete(`/badges/templates/${identifier}`),

  updateTemplate: (identifier, template) =>
    apiClient.put(`/badges/templates/${identifier}`, template),

  /**
   * Create badge definition
   * @param {Object} badge - Badge data { identifier, name, description, image }
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07 flow
   */
  createDefinition: (badge, signedEvent = null) =>
    apiClient.post('/badges/create-definition', {
      ...badge,
      signed_event: signedEvent
    }),

  /**
   * Award badge to recipients
   * @param {string} a_tag - Badge definition a-tag
   * @param {string[]} recipients - Recipient pubkeys
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07 flow
   */
  awardBadge: (a_tag, recipients, signedEvent = null) =>
    apiClient.post('/badges/award', {
      a_tag,
      recipients,
      signed_event: signedEvent
    }),

  /**
   * Create and award badge in one call
   * @param {Object} badge - Badge data with recipients
   * @param {Object|null} signedDefinitionEvent - Pre-signed definition for NIP-07
   * @param {Object|null} signedAwardEvent - Pre-signed award for NIP-07
   */
  createAndAward: (badge, signedDefinitionEvent = null, signedAwardEvent = null) =>
    apiClient.post('/badges/create-and-award', {
      ...badge,
      signed_definition_event: signedDefinitionEvent,
      signed_award_event: signedAwardEvent
    }),

  // Badge Discovery
  getBadgeOwners: (a_tag, limit = 50, include_profiles = true) =>
    apiClient.get('/badges/owners', {
      params: { a_tag, limit, include_profiles }
    }),

  // Inbox
  getPendingBadges: () =>
    apiClient.get('/inbox/pending'),

  getAcceptedBadges: () =>
    apiClient.get('/inbox/accepted'),

  /**
   * Accept a badge
   * @param {string} a_tag - Badge definition a-tag
   * @param {string} award_event_id - Award event ID
   * @param {Object|null} signedEvent - Pre-signed profile badges event for NIP-07
   */
  acceptBadge: (a_tag, award_event_id, signedEvent = null) =>
    apiClient.post('/inbox/accept', {
      a_tag,
      award_event_id,
      signed_event: signedEvent
    }),

  /**
   * Remove a badge
   * @param {string} a_tag - Badge definition a-tag
   * @param {string} award_event_id - Award event ID
   * @param {Object|null} signedEvent - Pre-signed profile badges event for NIP-07
   */
  removeBadge: (a_tag, award_event_id, signedEvent = null) =>
    apiClient.post('/inbox/remove', {
      a_tag,
      award_event_id,
      signed_event: signedEvent
    }),

  getInboxInfo: () =>
    apiClient.get('/inbox/info'),

  // Profile
  getProfile: (pubkey) =>
    apiClient.get(`/profile/${pubkey}`),

  getProfileBadges: (pubkey) =>
    apiClient.get(`/profile/${pubkey}/badges`),

  // Relays
  getRelays: () =>
    apiClient.get('/relays'),

  // Badge Requests (NIP-58 Extension)

  /**
   * Create a badge request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} content - Message to issuer
   * @param {string[]} proofs - Proof event IDs
   * @param {string[]} proofTypes - Type of each proof ('note' or 'zap')
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07
   */
  createBadgeRequest: (badgeATag, content, proofs, proofTypes, signedEvent = null) =>
    apiClient.post('/requests/create', {
      badge_a_tag: badgeATag,
      content,
      proofs,
      proof_types: proofTypes,
      signed_event: signedEvent
    }),

  /**
   * Withdraw a badge request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07
   */
  withdrawBadgeRequest: (badgeATag, signedEvent = null) =>
    apiClient.post('/requests/withdraw', {
      badge_a_tag: badgeATag,
      signed_event: signedEvent
    }),

  /**
   * Get outgoing badge requests (requests you sent)
   */
  getOutgoingRequests: () =>
    apiClient.get('/requests/outgoing'),

  /**
   * Get incoming badge requests (requests for your badges)
   */
  getIncomingRequests: () =>
    apiClient.get('/requests/incoming'),

  /**
   * Get count of incoming badge requests
   */
  getIncomingRequestsCount: () =>
    apiClient.get('/requests/incoming/count'),

  /**
   * Deny a badge request
   * @param {string} requestEventId - Event ID of the request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   * @param {string} reason - Reason for denial
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07
   */
  denyBadgeRequest: (requestEventId, badgeATag, requesterPubkey, reason, signedEvent = null) =>
    apiClient.post('/requests/deny', {
      request_event_id: requestEventId,
      badge_a_tag: badgeATag,
      requester_pubkey: requesterPubkey,
      reason,
      signed_event: signedEvent
    }),

  /**
   * Revoke a badge request denial
   * @param {string} requestEventId - Event ID of the original request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07
   */
  revokeDenial: (requestEventId, badgeATag, requesterPubkey, signedEvent = null) =>
    apiClient.post('/requests/revoke-denial', {
      request_event_id: requestEventId,
      badge_a_tag: badgeATag,
      requester_pubkey: requesterPubkey,
      signed_event: signedEvent
    }),

  /**
   * Award a badge from a request
   * @param {string} requestEventId - Event ID of the request
   * @param {string} badgeATag - Badge definition a-tag
   * @param {string} requesterPubkey - Requester's pubkey
   * @param {Object|null} signedEvent - Pre-signed event for NIP-07
   */
  awardFromRequest: (requestEventId, badgeATag, requesterPubkey, signedEvent = null) =>
    apiClient.post('/requests/award', {
      request_event_id: requestEventId,
      badge_a_tag: badgeATag,
      requester_pubkey: requesterPubkey,
      signed_event: signedEvent
    }),

  // Badge Discovery (Surf)

  /**
   * Get recent badges from Nostr
   * @param {number} limit - Maximum number of badges
   * @param {number|null} since - Unix timestamp filter
   */
  getRecentBadges: (limit = 50, since = null) =>
    apiClient.get('/surf/recent', {
      params: { limit, ...(since && { since }) }
    }),

  /**
   * Get popular badges sorted by holder count
   * @param {number} limit - Maximum number of badges
   */
  getPopularBadges: (limit = 30) =>
    apiClient.get('/surf/popular', { params: { limit } }),

  /**
   * Search badges by name or description
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   */
  searchBadges: (query, limit = 30) =>
    apiClient.get('/surf/search', { params: { q: query, limit } }),

  /**
   * Get badges by issuer
   * @param {string} pubkey - Issuer's pubkey
   * @param {number} limit - Maximum number of badges
   */
  getBadgesByIssuer: (pubkey, limit = 50) =>
    apiClient.get(`/surf/issuer/${pubkey}`, { params: { limit } }),

  /**
   * Get badge details by a-tag
   * @param {string} aTag - Badge a-tag
   */
  getBadgeDetails: (aTag) =>
    apiClient.get('/surf/badge/details', {
      params: { a_tag: aTag }
    }),

  /**
   * Get badge owners/holders
   * @param {string} aTag - Badge a-tag
   * @param {number} limit - Maximum number of owners
   * @param {boolean} includeProfiles - Whether to include profile data
   */
  getBadgeOwners: (aTag, limit = 50, includeProfiles = true) =>
    apiClient.get('/surf/badge/owners', {
      params: { a_tag: aTag, limit, include_profiles: includeProfiles }
    })
}

export default apiClient

