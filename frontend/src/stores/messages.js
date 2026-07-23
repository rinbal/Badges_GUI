/**
 * Messages Store - General Private DM Chat (NIP-17 gift wrapped)
 *
 * Full DM inbox with conversations list and per-partner chat.
 * Reuses the unified signer + nostrChat service from the support chat.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import {
  sendDirectMessage,
  fetchDirectMessages,
  fetchAllConversations,
  subscribeDirectMessages,
  fetchNostrProfile
} from '@/services/nostrChat'

function isSignerError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('not connected') || msg.includes('signer') || msg.includes('getpublickey failed') || msg.includes('extension')
}

export const useMessagesStore = defineStore('messages', () => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // ── State ────────────────────────────────────────────────────────────────
  const conversations = ref(new Map())   // pubkey → messages[]
  const profiles = ref({})               // pubkey → { name, picture, nip05 }
  const selectedPubkey = ref(null)       // currently open conversation
  const isLoading = ref(false)
  const isLoadingConversation = ref(false)
  const isSending = ref(false)
  const error = ref(null)
  const hasFetched = ref(false)

  // ── Getters ──────────────────────────────────────────────────────────────

  const conversationList = computed(() => {
    const list = []
    for (const [pubkey, msgs] of conversations.value) {
      if (msgs.length === 0) continue
      const lastMsg = msgs[msgs.length - 1]
      list.push({
        pubkey,
        lastMessage: lastMsg?.content || '',
        lastTime: lastMsg?.created_at || 0,
        messageCount: msgs.length,
        profile: profiles.value[pubkey] || null
      })
    }
    return list.sort((a, b) => b.lastTime - a.lastTime)
  })

  const selectedMessages = computed(() => {
    if (!selectedPubkey.value) return []
    return conversations.value.get(selectedPubkey.value) || []
  })

  const selectedProfile = computed(() => {
    if (!selectedPubkey.value) return null
    return profiles.value[selectedPubkey.value] || null
  })

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Fetch all DM conversations for the current user.
   */
  async function fetchInbox() {
    const signer = authStore.getSigner()
    if (!signer) return

    isLoading.value = true
    error.value = null

    try {
      const convMap = await fetchAllConversations(signer, authStore.hex)
      conversations.value = convMap

      // Fetch profiles in parallel
      const pubkeys = [...convMap.keys()].filter(pk => !profiles.value[pk])
      const results = await Promise.allSettled(
        pubkeys.map(pk => fetchNostrProfile(pk))
      )
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          profiles.value[pubkeys[i]] = result.value
        }
      })

      hasFetched.value = true
    } catch (err) {
      error.value = err.message
      console.error('Failed to fetch DM inbox:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch messages for a specific conversation partner.
   * Used when opening a conversation that may need refreshing.
   */
  async function fetchConversation(partnerPubkey) {
    const signer = authStore.getSigner()
    if (!signer) return

    isLoadingConversation.value = true

    try {
      const msgs = await fetchDirectMessages(signer, authStore.hex, partnerPubkey)
      conversations.value.set(partnerPubkey, msgs)

      // Fetch profile if needed
      if (!profiles.value[partnerPubkey]) {
        const profile = await fetchNostrProfile(partnerPubkey)
        if (profile) profiles.value[partnerPubkey] = profile
      }
    } catch (err) {
      uiStore.showError(`Failed to load conversation: ${err.message}`)
    } finally {
      isLoadingConversation.value = false
    }
  }

  /**
   * Send a DM to a specific user.
   */
  async function sendDM(recipientPubkey, content) {
    if (!content.trim()) return

    const signer = authStore.getSigner()
    if (!signer) {
      uiStore.showError('Please log in to send messages.')
      return { success: false }
    }

    isSending.value = true
    error.value = null

    try {
      const result = await sendDirectMessage(content, signer, recipientPubkey)

      // Echo the sent message through the same deduped path as live messages.
      // The relay can echo our own gift wrap back to the live subscription
      // before this resolves, so a blind push here would duplicate it; ingest
      // dedups by id, so whichever arrives first wins.
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
        uiStore.showError(`Send failed: ${err.message}`)
      }
      return { success: false, error: err.message }
    } finally {
      isSending.value = false
    }
  }

  /**
   * Start a new conversation with a user.
   * Creates the conversation entry and selects it.
   */
  async function startConversation(pubkey) {
    if (!conversations.value.has(pubkey)) {
      conversations.value.set(pubkey, [])
    }

    // Fetch profile if we don't have it
    if (!profiles.value[pubkey]) {
      const profile = await fetchNostrProfile(pubkey)
      if (profile) profiles.value[pubkey] = profile
    }

    selectedPubkey.value = pubkey

    // Fetch existing messages for this partner
    await fetchConversation(pubkey)
  }

  function selectConversation(pubkey) {
    selectedPubkey.value = pubkey
  }

  // ── Live incoming messages ─────────────────────────────────────────────────

  let _liveSub = null

  /** Merge a live-arriving message into the right conversation, deduped by id. */
  function ingestLiveMessage(msg) {
    const peer = msg.isMine ? msg.recipient : msg.sender
    if (!peer) return

    if (!conversations.value.has(peer)) {
      conversations.value.set(peer, [])
      if (!profiles.value[peer]) {
        fetchNostrProfile(peer).then(p => { if (p) profiles.value[peer] = p })
      }
    }
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
    if (!signer || !authStore.hex) return
    try {
      _liveSub = await subscribeDirectMessages(signer, authStore.hex, ingestLiveMessage)
    } catch (err) {
      console.warn('Live DM subscription failed:', err)
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
    conversations.value = new Map()
    profiles.value = {}
    selectedPubkey.value = null
    hasFetched.value = false
    error.value = null
  }

  return {
    conversations, profiles, selectedPubkey,
    isLoading, isLoadingConversation, isSending, error, hasFetched,
    conversationList, selectedMessages, selectedProfile,
    fetchInbox, fetchConversation, sendDM, startConversation,
    selectConversation, startLiveMessages, stopLiveMessages, reset
  }
})
