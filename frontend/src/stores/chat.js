/**
 * Chat Store — Manages NIP-17 encrypted DM state
 *
 * User view:  single conversation with Rinball (admin)
 * Admin view: all conversations grouped by sender (badge-gated)
 *
 * Supported auth methods: nsec, NIP-07
 * Amber (NIP-46) is not yet supported for encrypted DMs.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { ADMIN_PUBKEY_HEX, ADMIN_BADGE_ATAG } from '@/config/chat'
import {
  sendWithSecretKey,
  sendWithNip07,
  fetchMessagesWithSecretKey,
  fetchMessagesWithNip07,
  fetchAllConversationsWithSecretKey,
  fetchAllConversationsWithNip07,
  checkBadgeAccess,
  fetchNostrProfile,
  detectNip07Capabilities
} from '@/services/nostrChat'
import { closePool, clearRelayCache } from '@/services/outbox'

const UNSUPPORTED_AUTH_MSG = 'Encrypted chat requires nsec or a NIP-07 browser extension (nos2x, Alby). Amber (NIP-46) support is coming soon.'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // ── State ────────────────────────────────────────────────────────────────
  const messages = ref([])              // Current conversation messages
  const conversations = ref(new Map())  // Admin: pubkey -> messages[]
  const conversationProfiles = ref({})  // Admin: pubkey -> profile info
  const selectedPartner = ref(null)     // Admin: currently selected conversation
  const isLoading = ref(false)
  const isSending = ref(false)
  const error = ref(null)
  const isAdmin = ref(false)
  const adminChecked = ref(false)

  // ── Getters ──────────────────────────────────────────────────────────────

  /** Whether the current auth method supports encrypted chat */
  const chatSupported = computed(() => {
    if (authStore.isNsec) return true
    if (authStore.isNip07) return !!detectNip07Capabilities()
    return false
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Route a send/fetch call through the correct auth method */
  function requireChatAuth() {
    if (!chatSupported.value) {
      throw new Error(UNSUPPORTED_AUTH_MSG)
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Check if the current user holds the admin badge.
   * Skips re-check if already verified this session.
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
      requireChatAuth()

      let result
      if (authStore.isNsec) {
        result = await sendWithSecretKey(content, authStore.nsec, ADMIN_PUBKEY_HEX)
      } else {
        result = await sendWithNip07(content, authStore.hex, ADMIN_PUBKEY_HEX)
      }

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
      uiStore.showError(`Send failed: ${err.message}`)
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
      requireChatAuth()

      let result
      if (authStore.isNsec) {
        result = await sendWithSecretKey(content, authStore.nsec, recipientPubkey)
      } else {
        result = await sendWithNip07(content, authStore.hex, recipientPubkey)
      }

      const replyMsg = {
        id: result.id,
        content: result.content,
        created_at: result.created_at,
        sender: authStore.hex,
        recipient: recipientPubkey,
        isMine: true
      }

      // Ensure conversation exists in local state
      if (!conversations.value.has(recipientPubkey)) {
        conversations.value.set(recipientPubkey, [])
      }
      conversations.value.get(recipientPubkey).push(replyMsg)

      return { success: true }
    } catch (err) {
      error.value = err.message
      uiStore.showError(`Reply failed: ${err.message}`)
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
      requireChatAuth()

      if (authStore.isNsec) {
        messages.value = await fetchMessagesWithSecretKey(authStore.nsec, ADMIN_PUBKEY_HEX)
      } else {
        messages.value = await fetchMessagesWithNip07(authStore.hex, ADMIN_PUBKEY_HEX)
      }
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
      requireChatAuth()

      let convMap
      if (authStore.isNsec) {
        convMap = await fetchAllConversationsWithSecretKey(authStore.nsec)
      } else {
        convMap = await fetchAllConversationsWithNip07(authStore.hex)
      }

      conversations.value = convMap

      // Fetch profiles for all conversation partners in parallel
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

  /**
   * Select a conversation in admin view
   */
  function selectConversation(pubkey) {
    selectedPartner.value = pubkey
  }

  /**
   * Cleanup on logout
   */
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
    // State
    messages,
    conversations,
    conversationProfiles,
    selectedPartner,
    isLoading,
    isSending,
    error,
    isAdmin,
    adminChecked,

    // Getters
    chatSupported,
    conversationList,
    selectedMessages,

    // Actions
    checkAdminAccess,
    sendMessage,
    replyToUser,
    fetchMessages,
    fetchAllConversations,
    selectConversation,
    reset
  }
})
