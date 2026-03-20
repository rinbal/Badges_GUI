/**
 * Public Chat Service (NIP-28)
 *
 * Handles public channel messaging for the BadgeBox community chatroom.
 * Uses nostr-core exclusively.
 *
 * Event Kinds:
 *   40 - Channel Creation
 *   41 - Channel Metadata Update
 *   42 - Channel Message
 *   43 - Hide Message (moderation)
 *   44 - Mute User (moderation)
 */

import {
  createChannelEventTemplate,
  createChannelMessageEventTemplate,
  createChannelHideMessageEventTemplate,
  createChannelMuteUserEventTemplate,
  parseChannelMetadata,
  parseChannelMessage
} from 'nostr-core'

import { getPool, getPublicChatRelays, FALLBACK_RELAYS } from '@/services/outbox'

// ── Channel Operations ───────────────────────────────────────────────────────

/**
 * Create a new public channel (kind 40). Admin-only.
 */
export async function createChannel(metadata, signer) {
  const template = createChannelEventTemplate(metadata)
  const signed = await signer.signEvent(template)

  const pool = getPool()
  await pool.publish(getPublicChatRelays(), signed)

  return signed.id // This becomes the channel ID
}

// ── Messaging ────────────────────────────────────────────────────────────────

/**
 * Send a message to a public channel (kind 42).
 */
export async function sendChannelMessage(channelId, content, signer, replyTo = null) {
  const relay = getPublicChatRelays()[0] || ''
  const template = createChannelMessageEventTemplate(channelId, content, relay, replyTo)
  const signed = await signer.signEvent(template)

  const pool = getPool()
  await pool.publish(getPublicChatRelays(), signed)

  return signed
}

/**
 * Fetch recent channel messages (kind 42).
 * Also fetches kind 43 (hidden) and kind 44 (muted) for moderation.
 */
/**
 * Fetch recent channel messages (kind 42).
 * Also fetches kind 43 (hidden) and kind 44 (muted) for moderation.
 * Moderation events are only accepted from trusted moderator pubkeys.
 */
export async function fetchChannelMessages(channelId, { limit = 80, since = null, until = null, moderatorPubkeys = [] } = {}) {
  const pool = getPool()
  const relays = getPublicChatRelays()

  const filter = {
    kinds: [42],
    '#e': [channelId],
    limit
  }
  if (since) filter.since = since
  if (until) filter.until = until

  // Only fetch moderation events from trusted moderator pubkeys
  const modQueries = moderatorPubkeys.length > 0
    ? [
        pool.querySync(relays, { kinds: [43], authors: moderatorPubkeys, limit: 200 }, { maxWait: 5000 }),
        pool.querySync(relays, { kinds: [44], authors: moderatorPubkeys, limit: 200 }, { maxWait: 5000 })
      ]
    : [Promise.resolve([]), Promise.resolve([])]

  const [messages, hiddenEvents, muteEvents] = await Promise.all([
    pool.querySync(relays, filter, { maxWait: 10000 }),
    ...modQueries
  ])

  // Build moderation sets (only from trusted sources)
  const hiddenIds = new Set()
  for (const evt of hiddenEvents) {
    const eTag = evt.tags.find(t => t[0] === 'e')
    if (eTag) hiddenIds.add(eTag[1])
  }

  const mutedPubkeys = new Set()
  for (const evt of muteEvents) {
    const pTag = evt.tags.find(t => t[0] === 'p')
    if (pTag) mutedPubkeys.add(pTag[1])
  }

  // Deduplicate and filter
  const seen = new Set()
  const result = []

  for (const evt of messages) {
    if (seen.has(evt.id)) continue
    if (hiddenIds.has(evt.id)) continue
    if (mutedPubkeys.has(evt.pubkey)) continue
    seen.add(evt.id)

    const parsed = parseChannelMessage(evt)
    result.push({
      id: evt.id,
      pubkey: evt.pubkey,
      content: parsed.content,
      created_at: evt.created_at,
      channelId: parsed.channelId,
      replyTo: parsed.replyTo || null,
      sig: evt.sig
    })
  }

  return {
    messages: result.sort((a, b) => a.created_at - b.created_at),
    hiddenIds,
    mutedPubkeys
  }
}

/**
 * Subscribe to live channel messages.
 * Returns a closer function to stop the subscription.
 */
export function subscribeToChannel(channelId, { onMessage, onEose }) {
  const pool = getPool()
  const relays = getPublicChatRelays()

  const sub = pool.subscribe(relays, { kinds: [42], '#e': [channelId] }, {
    onevent(evt) {
      const parsed = parseChannelMessage(evt)
      if (parsed.channelId !== channelId) return

      onMessage({
        id: evt.id,
        pubkey: evt.pubkey,
        content: parsed.content,
        created_at: evt.created_at,
        channelId: parsed.channelId,
        replyTo: parsed.replyTo || null,
        sig: evt.sig
      })
    },
    oneose() {
      if (onEose) onEose()
    }
  })

  return () => sub.close()
}

// ── Moderation ───────────────────────────────────────────────────────────────

/**
 * Hide a message (kind 43). Moderator-only.
 */
export async function hideMessage(messageId, signer, reason = '') {
  const template = createChannelHideMessageEventTemplate(messageId, reason)
  const signed = await signer.signEvent(template)

  const pool = getPool()
  await pool.publish(getPublicChatRelays(), signed)
  return signed
}

/**
 * Mute a user (kind 44). Moderator-only.
 */
export async function muteUser(pubkey, signer, reason = '') {
  const template = createChannelMuteUserEventTemplate(pubkey, reason)
  const signed = await signer.signEvent(template)

  const pool = getPool()
  await pool.publish(getPublicChatRelays(), signed)
  return signed
}

// ── Channel Metadata ─────────────────────────────────────────────────────────

/**
 * Fetch channel metadata (kind 40/41).
 */
export async function fetchChannelMetadata(channelId) {
  const pool = getPool()
  const relays = getPublicChatRelays()

  // Fetch the creation event
  const [creationEvents, metaUpdates] = await Promise.all([
    pool.querySync(relays, { ids: [channelId], kinds: [40] }, { maxWait: 5000 }),
    pool.querySync(relays, { kinds: [41], '#e': [channelId] }, { maxWait: 5000 })
  ])

  // Use latest metadata update, fall back to creation event
  const metaEvent = metaUpdates.length > 0
    ? metaUpdates.sort((a, b) => b.created_at - a.created_at)[0]
    : creationEvents[0]

  if (!metaEvent) return null

  return parseChannelMetadata(metaEvent)
}

// ── Profile Batch Fetch ──────────────────────────────────────────────────────

/**
 * Fetch profiles for a batch of pubkeys.
 * Returns a Map of pubkey → profile.
 */
export async function fetchProfiles(pubkeys) {
  if (pubkeys.length === 0) return new Map()

  const pool = getPool()
  const events = await pool.querySync(FALLBACK_RELAYS, {
    kinds: [0],
    authors: pubkeys
  }, { maxWait: 6000 })

  const profiles = new Map()
  // Group by author, take latest
  const byAuthor = new Map()
  for (const evt of events) {
    const existing = byAuthor.get(evt.pubkey)
    if (!existing || evt.created_at > existing.created_at) {
      byAuthor.set(evt.pubkey, evt)
    }
  }

  for (const [pubkey, evt] of byAuthor) {
    try {
      const data = JSON.parse(evt.content)
      profiles.set(pubkey, {
        pubkey,
        name: data.name || data.display_name || null,
        picture: data.picture || null,
        nip05: data.nip05 || null
      })
    } catch { /* skip malformed */ }
  }

  return profiles
}
