/**
 * UI Store - Manages UI state (toasts, modals, global UI)
 *
 * Includes dedicated modal management for:
 * - LookupUser (view user profile + badges)
 * - BadgeDetail (view badge info + holders)
 * - RequestBadge (request a badge with proof)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // =========================================================================
  // Toast Notifications
  // =========================================================================

  const toasts = ref([])
  let toastId = 0

  function showToast(message, type = 'info', duration = 5000) {
    const id = ++toastId
    toasts.value.push({ id, message, type })

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function removeToast(id) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  function showSuccess(message) {
    return showToast(message, 'success')
  }

  function showError(message) {
    return showToast(message, 'error', 8000)
  }

  function showInfo(message) {
    return showToast(message, 'info')
  }

  function showWarning(message) {
    return showToast(message, 'warning', 6000)
  }

  // =========================================================================
  // Generic Modal State (legacy support)
  // =========================================================================

  const activeModal = ref(null)
  const modalData = ref(null)

  function openModal(name, data = null) {
    activeModal.value = name
    modalData.value = data
  }

  function closeModal() {
    activeModal.value = null
    modalData.value = null
  }

  // =========================================================================
  // LookupUser Modal
  // =========================================================================

  const lookupUserModal = ref({
    isOpen: false,
    pubkey: null,
    showBadges: true
  })

  function openLookupUser(pubkey, options = {}) {
    lookupUserModal.value = {
      isOpen: true,
      pubkey,
      showBadges: options.showBadges !== false
    }
  }

  function closeLookupUser() {
    lookupUserModal.value = {
      isOpen: false,
      pubkey: null,
      showBadges: true
    }
  }

  // =========================================================================
  // BadgeDetail Modal
  // =========================================================================

  const badgeDetailModal = ref({
    isOpen: false,
    badgeATag: null,
    badge: null // Optional pre-loaded badge data
  })

  function openBadgeDetail(badgeATag, badge = null) {
    badgeDetailModal.value = {
      isOpen: true,
      badgeATag,
      badge
    }
  }

  function closeBadgeDetail() {
    badgeDetailModal.value = {
      isOpen: false,
      badgeATag: null,
      badge: null
    }
  }

  // =========================================================================
  // RequestBadge Modal
  // =========================================================================

  const requestBadgeModal = ref({
    isOpen: false,
    badgeATag: null,
    badge: null // Badge info for display
  })

  function openRequestBadge(badgeATag, badge = null) {
    requestBadgeModal.value = {
      isOpen: true,
      badgeATag,
      badge
    }
  }

  function closeRequestBadge() {
    requestBadgeModal.value = {
      isOpen: false,
      badgeATag: null,
      badge: null
    }
  }

  // =========================================================================
  // Deny Request Modal
  // =========================================================================

  const denyRequestModal = ref({
    isOpen: false,
    request: null
  })

  function openDenyRequest(request) {
    denyRequestModal.value = {
      isOpen: true,
      request
    }
  }

  function closeDenyRequest() {
    denyRequestModal.value = {
      isOpen: false,
      request: null
    }
  }

  // =========================================================================
  // Computed - Any Modal Open
  // =========================================================================

  const hasOpenModal = computed(() =>
    lookupUserModal.value.isOpen ||
    badgeDetailModal.value.isOpen ||
    requestBadgeModal.value.isOpen ||
    denyRequestModal.value.isOpen ||
    activeModal.value !== null
  )

  // =========================================================================
  // Close All Modals
  // =========================================================================

  function closeAllModals() {
    closeLookupUser()
    closeBadgeDetail()
    closeRequestBadge()
    closeDenyRequest()
    closeModal()
  }

  // =========================================================================
  // Global Loading State
  // =========================================================================

  const isGlobalLoading = ref(false)

  function setGlobalLoading(loading) {
    isGlobalLoading.value = loading
  }

  return {
    // Toast
    toasts,
    showToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,

    // Generic Modal (legacy)
    activeModal,
    modalData,
    openModal,
    closeModal,

    // LookupUser Modal
    lookupUserModal,
    openLookupUser,
    closeLookupUser,

    // BadgeDetail Modal
    badgeDetailModal,
    openBadgeDetail,
    closeBadgeDetail,

    // RequestBadge Modal
    requestBadgeModal,
    openRequestBadge,
    closeRequestBadge,

    // DenyRequest Modal
    denyRequestModal,
    openDenyRequest,
    closeDenyRequest,

    // Utility
    hasOpenModal,
    closeAllModals,

    // Global Loading
    isGlobalLoading,
    setGlobalLoading
  }
})

