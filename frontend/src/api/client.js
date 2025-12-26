/**
 * API Client - Axios instance with interceptors
 */

import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_BASE_URL = '/api/v1'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,  // 2 minutes for relay operations
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - add auth header
apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.nsec) {
      config.headers['X-Nsec'] = authStore.nsec
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
  
  // Badges
  getTemplates: () => 
    apiClient.get('/badges/templates'),
  
  createTemplate: (template) => 
    apiClient.post('/badges/templates', template),
  
  createDefinition: (badge) => 
    apiClient.post('/badges/create-definition', badge),
  
  awardBadge: (a_tag, recipients) => 
    apiClient.post('/badges/award', { a_tag, recipients }),
  
  createAndAward: (badge) => 
    apiClient.post('/badges/create-and-award', badge),
  
  // Inbox
  getPendingBadges: () => 
    apiClient.get('/inbox/pending'),
  
  getAcceptedBadges: () => 
    apiClient.get('/inbox/accepted'),
  
  acceptBadge: (a_tag, award_event_id) => 
    apiClient.post('/inbox/accept', { a_tag, award_event_id }),
  
  removeBadge: (a_tag, award_event_id) => 
    apiClient.post('/inbox/remove', { a_tag, award_event_id }),
  
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

