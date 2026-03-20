/**
 * Public Chat Store - NIP-28 Community Channel
 *
 * Readable by everyone, login required to post.
 * Live subscription for real-time messages.
 * Moderation via badge-gated hide/mute.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { PUBLIC_CHANNEL_ID, MODERATOR_BADGE_ATAG, ADMIN_PUBKEY_HEX } from '@/config/chat'
import { checkBadgeAccess } from '@/services/nostrChat'
import {
  sendChannelMessage,
  fetchChannelMessages,
  subscribeToChannel,
  hideMessage as hideMsg,
  muteUser as muteUsr,
  fetchChannelMetadata,
  fetchProfiles,
  createChannel
} from '@/services/publicChat'

const MODERATOR_BADGE = MODERATOR_BADGE_ATAG

function isSignerError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('not connected') || msg.includes('signer') || msg.includes('getpublickey failed') || msg.includes('extension')
}

export const usePublicChatStore = defineStore('publicChat', () => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // ── State ────────────────────────────────────────────────────────────────
  const channelId = ref(PUBLIC_CHANNEL_ID)
  const channelMeta = ref(null)       // { name, about, picture }
  const messages = ref([])             // sorted array of messages
  const profiles = ref(new Map())      // pubkey → { name, picture, nip05 }
  const hiddenIds = ref(new Set())     // hidden message IDs
  const mutedPubkeys = ref(new Set())  // muted user pubkeys
  const isLoading = ref(false)
  const isSending = ref(false)
  const isConnected = ref(false)
  const isModerator = ref(false)
  const moderatorChecked = ref(false)
  const error = ref(null)

  let _unsubscribe = null              // live subscription closer
  let _profileQueue = new Set()        // pubkeys pending profile fetch
  let _profileTimer = null             // batch fetch debounce
  let _knownIds = new Set()            // dedup: known message event IDs
  let _subscriberCount = 0             // ref count: how many components use the subscription

  // ── Getters ──────────────────────────────────────────────────────────────

  const channelReady = computed(() => !!channelId.value)

  const canPost = computed(() => {
    if (!authStore.isAuthenticated) return false
    const signer = authStore.getSigner()
    return !!signer
  })

  const visibleMessages = computed(() => {
    return messages.value.filter(m =>
      !hiddenIds.value.has(m.id) && !mutedPubkeys.value.has(m.pubkey)
    )
  })

  // Re-check moderator access when auth state changes (login/logout cycle)
  watch(() => authStore.isAuthenticated, (isAuth) => {
    moderatorChecked.value = false
    isModerator.value = false
    if (isAuth && isConnected.value) {
      checkModeratorAccess()
    }
  })

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Initialize the channel - fetch metadata, history, and start live subscription.
   */
  async function joinChannel() {
    if (!channelId.value) return

    _subscriberCount++

    // Already connected - just bump the ref count
    if (isConnected.value || _unsubscribe) return

    isLoading.value = true
    error.value = null

    try {
      // Fetch channel metadata
      const meta = await fetchChannelMetadata(channelId.value)
      if (meta) channelMeta.value = meta

      // Fetch recent message history + moderation data
      // Only accept moderation events from admin pubkey
      const result = await fetchChannelMessages(channelId.value, { moderatorPubkeys: [ADMIN_PUBKEY_HEX] })
      messages.value = result.messages
      hiddenIds.value = result.hiddenIds
      mutedPubkeys.value = result.mutedPubkeys
      // Populate dedup set from initial fetch
      _knownIds = new Set(result.messages.map(m => m.id))

      // Batch-fetch profiles for all message authors
      const pubkeys = [...new Set(result.messages.map(m => m.pubkey))]
      await loadProfiles(pubkeys)

      // Start live subscription - isConnected set to true only after relay confirms (EOSE)
      _unsubscribe = subscribeToChannel(channelId.value, {
        onMessage: handleNewMessage,
        onEose: () => { isConnected.value = true }
      })

      // Check moderator status if logged in
      if (authStore.isAuthenticated) {
        checkModeratorAccess()
      }
    } catch (err) {
      error.value = err.message
      console.error('Failed to join channel:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Leave the channel - stop live subscription.
   */
  function leaveChannel() {
    _subscriberCount = Math.max(0, _subscriberCount - 1)

    // Only tear down when the last subscriber leaves
    if (_subscriberCount > 0) return

    if (_unsubscribe) {
      _unsubscribe()
      _unsubscribe = null
    }
    if (_profileTimer) {
      clearTimeout(_profileTimer)
      _profileTimer = null
    }
    isConnected.value = false
  }

  /**
   * Send a message to the channel.
   */
  async function sendMessage(content, replyTo = null) {
    if (!content.trim()) return
    if (!canPost.value) {
      uiStore.showError('Please log in to send messages.')
      return { success: false }
    }

    isSending.value = true
    error.value = null

    try {
      const signer = authStore.getSigner()
      const signed = await sendChannelMessage(channelId.value, content, signer, replyTo)

      // Add to local messages immediately (optimistic)
      const msg = {
        id: signed.id,
        pubkey: signed.pubkey,
        content,
        created_at: signed.created_at,
        channelId: channelId.value,
        replyTo,
        sig: signed.sig
      }
      addMessage(msg)

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
   * Hide a message (moderator action).
   */
  async function hideMessage(messageId, reason = '') {
    if (!isModerator.value) return
    try {
      const signer = authStore.getSigner()
      await hideMsg(messageId, signer, reason)
      hiddenIds.value.add(messageId)
      uiStore.showSuccess('Message hidden')
    } catch (err) {
      uiStore.showError(`Failed to hide: ${err.message}`)
    }
  }

  /**
   * Mute a user (moderator action).
   */
  async function muteUser(pubkey, reason = '') {
    if (!isModerator.value) return
    try {
      const signer = authStore.getSigner()
      await muteUsr(pubkey, signer, reason)
      mutedPubkeys.value.add(pubkey)
      uiStore.showSuccess('User muted')
    } catch (err) {
      uiStore.showError(`Failed to mute: ${err.message}`)
    }
  }

  /**
   * Create the BadgeBox community channel (admin one-time action).
   */
  async function createCommunityChannel(name, about, picture) {
    const signer = authStore.getSigner()
    if (!signer) throw new Error('Not logged in')

    const newChannelId = await createChannel({ name, about, picture }, signer)
    channelId.value = newChannelId
    uiStore.showSuccess(`Channel created! ID: ${newChannelId}`)
    return newChannelId
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  function handleNewMessage(msg) {
    if (_knownIds.has(msg.id)) return
    if (hiddenIds.value.has(msg.id)) return
    if (mutedPubkeys.value.has(msg.pubkey)) return

    addMessage(msg)
    queueProfileFetch(msg.pubkey)
  }

  function addMessage(msg) {
    _knownIds.add(msg.id)
    // Insert at correct position (almost always at the end)
    const len = messages.value.length
    if (len === 0 || msg.created_at >= messages.value[len - 1].created_at) {
      messages.value.push(msg)
    } else {
      messages.value.push(msg)
      messages.value.sort((a, b) => a.created_at - b.created_at)
    }
  }

  /**
   * Queue a profile fetch - debounced batch to avoid hammering relays.
   */
  function queueProfileFetch(pubkey) {
    if (profiles.value.has(pubkey)) return
    _profileQueue.add(pubkey)

    if (_profileTimer) clearTimeout(_profileTimer)
    _profileTimer = setTimeout(async () => {
      const batch = [..._profileQueue]
      _profileQueue.clear()
      await loadProfiles(batch)
    }, 500)
  }

  async function loadProfiles(pubkeys) {
    const needed = pubkeys.filter(pk => !profiles.value.has(pk))
    if (needed.length === 0) return

    try {
      const fetched = await fetchProfiles(needed)
      for (const [pk, profile] of fetched) {
        profiles.value.set(pk, profile)
      }
    } catch {
      // Profiles are non-critical, don't error
    }
  }

  async function checkModeratorAccess() {
    if (moderatorChecked.value) return
    try {
      isModerator.value = await checkBadgeAccess(authStore.hex, MODERATOR_BADGE)
    } catch {
      isModerator.value = false
    }
    moderatorChecked.value = true
  }

  function getProfile(pubkey) {
    return profiles.value.get(pubkey) || null
  }

  function reset() {
    _subscriberCount = 0
    leaveChannel()
    messages.value = []
    profiles.value = new Map()
    hiddenIds.value = new Set()
    mutedPubkeys.value = new Set()
    _knownIds = new Set()
    channelMeta.value = null
    isModerator.value = false
    moderatorChecked.value = false
    error.value = null
  }

  return {
    channelId, channelMeta, messages, profiles, hiddenIds, mutedPubkeys,
    isLoading, isSending, isConnected, isModerator, error,
    channelReady, canPost, visibleMessages,
    joinChannel, leaveChannel, sendMessage, hideMessage, muteUser,
    createCommunityChannel, getProfile, reset
  }
})
