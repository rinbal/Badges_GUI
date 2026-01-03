/**
 * UI Store - Manages UI state (toasts, modals, etc.)
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // Toast notifications
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

  // Modal state
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

  return {
    // Toast
    toasts,
    showToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    // Modal
    activeModal,
    modalData,
    openModal,
    closeModal
  }
})

