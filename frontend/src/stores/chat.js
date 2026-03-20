/**
 * Chat Store - Manages NIP-17/04 encrypted DM state
 *
 * User view:  single conversation with Rinball (admin)
 * Admin view: all conversations grouped by sender (badge-gated)
 *
 * All auth methods supported via unified nostr-core Signer.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { ADMIN_PUBKEY_HEX, ADMIN_BADGE_ATAG } from '@/config/chat'
import {
  sendDirectMessage,
  fetchDirectMessages,
  fetchAllConversations as fetchAllConvs,
  checkBadgeAccess,
  fetchNostrProfile
} from '@/services/nostrChat'
import { closePool, clearRelayCache } from '@/services/outbox'
import { getBestEncryption } from '@/services/signer'

function isSignerError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('not connected') || msg.includes('signer') || msg.includes('getpublickey failed') || msg.includes('extension')
}

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // ── State ────────────────────────────────────────────────────────────────
  const messages = ref([])
  const conversations = ref(new Map())
  const conversationProfiles = ref({})
  const selectedPartner = ref(null)
  const isLoading = ref(false)
  const isSending = ref(false)
  const error = ref(null)
  const isAdmin = ref(false)
  const adminChecked = ref(false)

  // ── Getters ──────────────────────────────────────────────────────────────

  /** Whether the current auth method supports encrypted chat */
  const chatSupported = computed(() => {
    const signer = authStore.getSigner()
    if (!signer) return false
    return !!getBestEncryption(signer)
  })

  const conversationList = computed(() => {
    const list = []
    for (const [pubkey, msgs] of conversations.value) {
      const lastMsg = msgs[msgs.length - 1]
      list.push({
        pubkey,
        lastMessage: lastMsg?.content || '',
        lastTime: lastMsg?.created_at || 0,
        messageCount: msgs.length,
        profile: conversationProfiles.value[pubkey] || null
      })
    }
    return list.sort((a, b) => b.lastTime - a.lastTime)
  })

  const selectedMessages = computed(() => {
    if (!selectedPartner.value) return []
    return conversations.value.get(selectedPartner.value) || []
  })

  // ── Actions ──────────────────────────────────────────────────────────────

  function requireSigner() {
    const signer = authStore.getSigner()
    if (!signer) throw new Error('No signer available. Please log in with nsec, NIP-07 extension, or Amber.')
    if (!getBestEncryption(signer)) throw new Error('Your signer does not support encryption (NIP-04 or NIP-44).')
    return signer
  }

  /**
   * Check if the current user holds the admin badge.
   */
  async function checkAdminAccess() {
    if (adminChecked.value) return isAdmin.value

    if (!authStore.hex) {
      isAdmin.value = false
      adminChecked.value = true
      return false
    }

    try {
      isAdmin.value = await checkBadgeAccess(authStore.hex, ADMIN_BADGE_ATAG)
    } catch (err) {
      console.warn('Badge access check failed:', err)
      isAdmin.value = false
    }
    adminChecked.value = true
    return isAdmin.value
  }

  /**
   * Send a message to Rinball (user view)
   */
  async function sendMessage(content) {
    if (!content.trim()) return

    isSending.value = true
    error.value = null

    try {
      const signer = requireSigner()
      const result = await sendDirectMessage(content, signer, ADMIN_PUBKEY_HEX)

      messages.value.push({
        id: result.id,
        content: result.content,
        created_at: result.created_at,
        sender: authStore.hex,
        recipient: ADMIN_PUBKEY_HEX,
        isMine: true
      })

      return { success: true }
    } catch (err) {
      error.value = err.message
      if (isSignerError(err)) {
        authStore.resetSigner()
        uiStore.showError('Your signing extension disconnected. Please unlock it and try again.')
      } else {
        uiStore.showError(`Send failed: ${err.message}`)
      }
      return { success: false, error: err.message }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Send a reply to a user (admin view)
   */
  async function replyToUser(recipientPubkey, content) {
    if (!content.trim()) return

    isSending.value = true
    error.value = null

    try {
      const signer = requireSigner()
      const result = await sendDirectMessage(content, signer, recipientPubkey)

      const replyMsg = {
        id: result.id,
        content: result.content,
        created_at: result.created_at,
        sender: authStore.hex,
        recipient: recipientPubkey,
        isMine: true
      }

      if (!conversations.value.has(recipientPubkey)) {
        conversations.value.set(recipientPubkey, [])
      }
      conversations.value.get(recipientPubkey).push(replyMsg)

      return { success: true }
    } catch (err) {
      error.value = err.message
      if (isSignerError(err)) {
        authStore.resetSigner()
        uiStore.showError('Your signing extension disconnected. Please unlock it and try again.')
      } else {
        uiStore.showError(`Reply failed: ${err.message}`)
      }
      return { success: false, error: err.message }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Fetch messages for the user's conversation with Rinball
   */
  async function fetchMessages() {
    isLoading.value = true
    error.value = null

    try {
      const signer = requireSigner()
      messages.value = await fetchDirectMessages(signer, authStore.hex, ADMIN_PUBKEY_HEX)
    } catch (err) {
      error.value = err.message
      uiStore.showError(err.message)
      console.error('Failed to fetch messages:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch all conversations for the admin view
   */
  async function fetchAllConversations() {
    isLoading.value = true
    error.value = null

    try {
      const signer = requireSigner()
      const convMap = await fetchAllConvs(signer, authStore.hex)

      conversations.value = convMap

      // Fetch profiles in parallel
      const pubkeys = [...convMap.keys()].filter(pk => !conversationProfiles.value[pk])
      const profileResults = await Promise.allSettled(
        pubkeys.map(pk => fetchNostrProfile(pk))
      )
      profileResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          conversationProfiles.value[pubkeys[i]] = result.value
        }
      })
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch conversations:', err)
    } finally {
      isLoading.value = false
    }
  }

  function selectConversation(pubkey) {
    selectedPartner.value = pubkey
  }

  function reset() {
    messages.value = []
    conversations.value = new Map()
    conversationProfiles.value = {}
    selectedPartner.value = null
    isAdmin.value = false
    adminChecked.value = false
    error.value = null
    clearRelayCache()
    closePool()
  }

  return {
    messages, conversations, conversationProfiles, selectedPartner,
    isLoading, isSending, error, isAdmin, adminChecked,
    chatSupported, conversationList, selectedMessages,
    checkAdminAccess, sendMessage, replyToUser,
    fetchMessages, fetchAllConversations, selectConversation, reset
  }
})
