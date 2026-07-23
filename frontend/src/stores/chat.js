/**
 * Chat Store - Manages NIP-17 gift-wrapped DM state
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
  subscribeDirectMessages,
  checkBadgeAccess,
  fetchNostrProfile
} from '@/services/nostrChat'
import { closePool, clearRelayCache } from '@/services/outbox'
import { signerHasNip44 } from '@/services/signer'

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
    return signerHasNip44(signer)
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
    if (!signer) throw new Error('Please log in to use chat.')
    if (!signerHasNip44(signer)) throw new Error('Private messages are not supported by your current login method.')
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

      // Echo through the deduped ingestion path so a fast relay echo to the
      // live subscription cannot duplicate the message.
      ingestLiveMessage({
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

      // Echo through the deduped ingestion path so a fast relay echo to the
      // live subscription cannot duplicate the message.
      ingestLiveMessage({
        id: result.id,
        content: result.content,
        created_at: result.created_at,
        sender: authStore.hex,
        recipient: recipientPubkey,
        isMine: true
      })

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

  // ── Live incoming messages ─────────────────────────────────────────────────

  let _liveSub = null

  /** Merge a live-arriving message into local state, deduped by id. */
  function ingestLiveMessage(msg) {
    const peer = msg.isMine ? msg.recipient : msg.sender
    if (!peer) return

    // User view keeps the admin conversation in `messages`.
    if (peer === ADMIN_PUBKEY_HEX && !messages.value.some(m => m.id === msg.id)) {
      messages.value.push(msg)
      messages.value.sort((a, b) => a.created_at - b.created_at)
    }

    // Admin view keeps every conversation grouped in `conversations`.
    if (!conversations.value.has(peer)) conversations.value.set(peer, [])
    const list = conversations.value.get(peer)
    if (!list.some(m => m.id === msg.id)) {
      list.push(msg)
      list.sort((a, b) => a.created_at - b.created_at)
    }
  }

  /** Start listening for incoming messages in real time (idempotent). */
  async function startLiveMessages() {
    if (_liveSub) return
    const signer = authStore.getSigner()
    if (!signer || !signerHasNip44(signer) || !authStore.hex) return
    try {
      _liveSub = await subscribeDirectMessages(signer, authStore.hex, ingestLiveMessage)
    } catch (err) {
      console.warn('Live chat subscription failed:', err)
    }
  }

  /** Stop listening for incoming messages. */
  function stopLiveMessages() {
    if (_liveSub) {
      try { _liveSub.close() } catch { /* ignore */ }
      _liveSub = null
    }
  }

  function reset() {
    stopLiveMessages()
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
    fetchMessages, fetchAllConversations, selectConversation,
    startLiveMessages, stopLiveMessages, reset
  }
})
