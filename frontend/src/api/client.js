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
    apiClient.get('/relays')
}

export default apiClient

