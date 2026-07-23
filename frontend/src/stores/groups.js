/**
 * Group Store - BadgeBox NIP-29 community chat (basic text chat).
 *
 * Orchestrates the group relay connection: metadata/members/admins state, the
 * live message feed, sending, and joining. All reads dedup by event id (relays
 * replay on reconnect), and the sent-message echo goes through the same deduped
 * ingest path as live messages so it can never double up.
 *
 * Anonymous visitors read metadata and any public messages. Sending and joining
 * require a signer; the group relay auth is handled in services/groupChat.js.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { BADGEBOX_GROUP } from '@/config/groups'
import { fetchNostrProfile } from '@/services/nostrChat'
import {
  configureGroupAuth, subscribeGroup, queryGroup, publishToGroup,
  buildGroupMessage, buildJoinRequest, disconnectGroup,
  parseMetadata, parseMembers, parseAdmins,
  GROUP_CHAT_KIND, GROUP_DELETE_KIND,
  GROUP_METADATA_KIND, GROUP_ADMINS_KIND, GROUP_MEMBERS_KIND
} from '@/services/groupChat'

const FEED_KINDS = [GROUP_CHAT_KIND, GROUP_DELETE_KIND]
const STATE_KINDS = [GROUP_METADATA_KIND, GROUP_ADMINS_KIND, GROUP_MEMBERS_KIND]
const BACKLOG_LIMIT = 200

export const useGroupStore = defineStore('group', () => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()
  const group = BADGEBOX_GROUP

  // ── State ──────────────────────────────────────────────────────────────────
  const messages = ref([])
  const metadata = ref({ name: null, picture: null, about: null })
  const members = ref(new Set())
  const admins = ref(new Set())
  const profiles = ref({})
  const status = ref('idle')     // 'idle' | 'loading' | 'live' | 'error'
  const restricted = ref(false)  // relay refused an anonymous feed read
  const isSending = ref(false)
  const isJoining = ref(false)

  const seen = new Set()
  let feedSub = null
  let stateSub = null
  const profileQueue = new Set()
  let profileTimer = null

  // ── Getters ────────────────────────────────────────────────────────────────
  const isMember = computed(() => (authStore.hex ? members.value.has(authStore.hex) : false))
  const memberCount = computed(() => members.value.size)
  const displayName = computed(() => metadata.value.name || 'BadgeBox community')

  function profileFor(pubkey) {
    return profiles.value[pubkey] || null
  }

  // ── Ingestion (single deduped path for backlog, live, and own echoes) ───────
  function ingestFeedEvent(event) {
    if (seen.has(event.id)) return
    seen.add(event.id)

    if (event.kind === GROUP_CHAT_KIND) {
      messages.value.push(toMessage(event))
      messages.value.sort(byTime)
      queueProfile(event.pubkey)
    } else if (event.kind === GROUP_DELETE_KIND) {
      const target = event.tags.find(t => t[0] === 'e')?.[1]
      if (target) messages.value = messages.value.filter(m => m.id !== target)
    }
  }

  function ingestStateEvent(event) {
    if (event.kind === GROUP_METADATA_KIND) {
      const m = parseMetadata(event)
      metadata.value = { name: m.name || null, picture: m.picture || null, about: m.about || null }
    } else if (event.kind === GROUP_MEMBERS_KIND) {
      members.value = new Set(parseMembers(event))
    } else if (event.kind === GROUP_ADMINS_KIND) {
      admins.value = new Set(parseAdmins(event).map(a => a.pubkey))
    }
  }

  function toMessage(event) {
    return {
      id: event.id,
      pubkey: event.pubkey,
      content: event.content,
      created_at: event.created_at,
      isMine: event.pubkey === authStore.hex
    }
  }

  function byTime(a, b) {
    return a.created_at - b.created_at || (a.id < b.id ? -1 : 1)
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────
  async function openState() {
    stateSub = await subscribeGroup(group, { kinds: STATE_KINDS, '#d': [group.id] }, {
      onevent: ingestStateEvent
    })
  }

  async function openFeed() {
    try { feedSub?.close() } catch { /* ignore */ }
    feedSub = await subscribeGroup(group, { kinds: FEED_KINDS, '#h': [group.id], limit: BACKLOG_LIMIT }, {
      onevent: ingestFeedEvent,
      onclose: (reason) => {
        if (!authStore.hex && /auth|restrict/i.test(reason || '')) restricted.value = true
      }
    })
  }

  async function loadBacklog() {
    const events = await queryGroup(group, { kinds: FEED_KINDS, '#h': [group.id], limit: BACKLOG_LIMIT })
    events.forEach(ingestFeedEvent)
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async function start() {
    if (status.value === 'loading' || status.value === 'live') return
    status.value = 'loading'
    restricted.value = false

    // Auth signer + reload feed once the relay auth handshake completes.
    configureGroupAuth({
      getSigner: () => authStore.getSigner(),
      onAuthed: () => { restricted.value = false; openFeed() }
    })

    try {
      await openState()
      await loadBacklog()
      await openFeed()
      status.value = 'live'
    } catch (err) {
      console.warn('Group start failed:', err)
      status.value = 'error'
    }
  }

  function stop() {
    try { feedSub?.close() } catch { /* ignore */ }
    try { stateSub?.close() } catch { /* ignore */ }
    feedSub = null
    stateSub = null
    disconnectGroup()
    status.value = 'idle'
  }

  /** Reconnect after a login/logout so auth (and the members-only feed) refresh. */
  async function restart() {
    stop()
    await start()
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function send(content) {
    const text = (content || '').trim()
    if (!text) return { success: false }

    const signer = authStore.getSigner()
    if (!signer) {
      uiStore.showError('Please sign in to send a message.')
      return { success: false }
    }

    isSending.value = true
    try {
      const result = await publishToGroup(group, signer, buildGroupMessage(group, text))
      if (!result.ok) {
        uiStore.showError(isMember.value
          ? 'Message was not accepted by the group relay.'
          : 'Join the group to send messages.')
        return { success: false }
      }
      // Echo through the deduped ingest path (same guard as live messages).
      ingestFeedEvent(result.event)
      return { success: true }
    } catch (err) {
      uiStore.showError(`Could not send: ${err.message}`)
      return { success: false }
    } finally {
      isSending.value = false
    }
  }

  async function join() {
    const signer = authStore.getSigner()
    if (!signer) {
      uiStore.showError('Please sign in to join.')
      return { success: false }
    }

    isJoining.value = true
    try {
      const result = await publishToGroup(group, signer, buildJoinRequest(group))
      if (result.ok) {
        uiStore.showSuccess('Join request sent')
        // Open groups auto-admit; re-read members shortly to unlock the composer.
        setTimeout(reloadMembers, 2500)
      } else {
        uiStore.showError('Could not send the join request.')
      }
      return { success: result.ok }
    } finally {
      isJoining.value = false
    }
  }

  async function reloadMembers() {
    const events = await queryGroup(group, { kinds: [GROUP_MEMBERS_KIND], '#d': [group.id], limit: 1 })
    events.forEach(ingestStateEvent)
  }

  // ── Profiles (debounced batch fetch for message authors) ────────────────────
  function queueProfile(pubkey) {
    if (!pubkey || profiles.value[pubkey] || profileQueue.has(pubkey)) return
    profileQueue.add(pubkey)
    if (profileTimer) clearTimeout(profileTimer)
    profileTimer = setTimeout(flushProfiles, 400)
  }

  async function flushProfiles() {
    const pubkeys = [...profileQueue]
    profileQueue.clear()
    const results = await Promise.allSettled(pubkeys.map(pk => fetchNostrProfile(pk)))
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) profiles.value[pubkeys[i]] = r.value
    })
  }

  return {
    messages, metadata, members, admins, profiles, status, restricted,
    isSending, isJoining,
    isMember, memberCount, displayName, profileFor,
    start, stop, restart, send, join
  }
})
