/**
 * Outbox Model (NIP-65)
 *
 * Smart relay routing based on user relay lists.
 * Foundation for all Nostr communication in BadgeBox:
 *   - DM chat (NIP-17)
 *   - Public chatrooms (NIP-28)
 *   - Future general chat
 *
 * How it works:
 *   1. Fetch user's relay list (kind 10002) from known relays
 *   2. Cache relay lists per pubkey (TTL-based)
 *   3. Route writes to user's write relays + fallback relays
 *   4. Route reads from target's write relays (that's where their events are)
 *   5. Always include fallback relays for redundancy
 */

import { nip65, RelayPool } from 'nostr-core'

// ── Default Relay Sets ───────────────────────────────────────────────────────

export const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub'
]

// DM-optimized relays (good NIP-17 support)
export const DM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub',
  'wss://relay.snort.social'
]

// Public chat relays (high availability, good for kind 42)
export const PUBLIC_CHAT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://relay.0xchat.com'
]

// ── Relay List Cache ─────────────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000        // 30 minutes for valid relay lists
const CACHE_TTL_EMPTY = 3 * 60 * 1000   // 3 minutes for empty results (retry sooner)
const relayListCache = new Map()         // pubkey -> { read: [], write: [], fetchedAt, empty }

// ── Pool Management ──────────────────────────────────────────────────────────

let _pool = null

export function getPool() {
  if (!_pool) {
    _pool = new RelayPool()
  }
  return _pool
}

export function closePool() {
  if (_pool) {
    _pool.close()
    _pool = null
  }
}

// ── Relay List Fetching ──────────────────────────────────────────────────────

/**
 * Fetch a user's NIP-65 relay list (kind 10002).
 * Returns { read: string[], write: string[] }.
 * Results are cached per pubkey.
 */
export async function getUserRelays(pubkey) {
  // Check cache (shorter TTL for empty results so we retry sooner)
  const cached = relayListCache.get(pubkey)
  if (cached) {
    const ttl = cached.empty ? CACHE_TTL_EMPTY : CACHE_TTL
    if (Date.now() - cached.fetchedAt < ttl) {
      return { read: cached.read, write: cached.write }
    }
  }

  const pool = getPool()
  try {
    const events = await pool.querySync(FALLBACK_RELAYS, {
      kinds: [10002],
      authors: [pubkey]
    }, { maxWait: 5000 })

    if (events.length === 0) {
      // No relay list published — cache briefly so we retry sooner
      relayListCache.set(pubkey, { read: [], write: [], fetchedAt: Date.now(), empty: true })
      return { read: [], write: [] }
    }

    // Use most recent event
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
    const parsed = nip65.parseRelayList(latest)

    const read = nip65.getReadRelays(parsed).map(r => r.url)
    const write = nip65.getWriteRelays(parsed).map(r => r.url)

    relayListCache.set(pubkey, { read, write, fetchedAt: Date.now(), empty: false })
    return { read, write }
  } catch {
    return { read: [], write: [] }
  }
}

/**
 * Clear the relay list cache (call on logout)
 */
export function clearRelayCache() {
  relayListCache.clear()
}

// ── Smart Relay Selection ────────────────────────────────────────────────────

/**
 * Get relays to PUBLISH an event from a given author.
 * Combines user's write relays with fallback relays.
 */
export async function getWriteRelays(authorPubkey) {
  const userRelays = await getUserRelays(authorPubkey)
  return dedup([...userRelays.write, ...FALLBACK_RELAYS])
}

/**
 * Get relays to READ events FROM a specific author.
 * Per outbox model: read from where the author writes.
 */
export async function getReadRelaysFor(authorPubkey) {
  const userRelays = await getUserRelays(authorPubkey)
  return dedup([...userRelays.write, ...FALLBACK_RELAYS])
}

/**
 * Get relays for DM exchange between two parties.
 * For publishing: sender's write relays + recipient's write relays + fallback
 * For reading: both parties' write relays + fallback
 */
export async function getDmRelays(senderPubkey, recipientPubkey) {
  const [senderRelays, recipientRelays] = await Promise.all([
    getUserRelays(senderPubkey),
    getUserRelays(recipientPubkey)
  ])

  return dedup([
    ...senderRelays.write,
    ...recipientRelays.write,
    ...DM_RELAYS
  ])
}

/**
 * Get relays for fetching DMs addressed to a pubkey.
 * Combines the user's own write relays (where senders should publish)
 * with DM fallback relays.
 */
export async function getDmReadRelays(myPubkey) {
  const myRelays = await getUserRelays(myPubkey)
  return dedup([...myRelays.write, ...DM_RELAYS])
}

/**
 * Get relays for public chatrooms.
 * Uses a broad set for maximum reach.
 */
export function getPublicChatRelays() {
  return [...PUBLIC_CHAT_RELAYS]
}

// ── Publish & Query Helpers ──────────────────────────────────────────────────

/**
 * Publish an event using the outbox model.
 * Automatically selects relays based on the author's relay list.
 */
export async function publishEvent(event, authorPubkey) {
  const relays = await getWriteRelays(authorPubkey)
  const pool = getPool()
  return pool.publish(relays, event)
}

/**
 * Publish a DM event (kind 1059 gift wrap).
 * Routes to both sender's and recipient's relays.
 */
export async function publishDm(event, senderPubkey, recipientPubkey) {
  const relays = await getDmRelays(senderPubkey, recipientPubkey)
  const pool = getPool()
  return pool.publish(relays, event)
}

/**
 * Query events using the outbox model.
 * Fetches from the target author's write relays.
 */
export async function queryEvents(filter, targetPubkey, opts = {}) {
  const relays = targetPubkey
    ? await getReadRelaysFor(targetPubkey)
    : FALLBACK_RELAYS
  const pool = getPool()
  return pool.querySync(relays, filter, { maxWait: opts.maxWait || 8000 })
}

/**
 * Query DMs addressed to a pubkey.
 */
export async function queryDms(myPubkey, opts = {}) {
  const relays = await getDmReadRelays(myPubkey)
  const pool = getPool()
  return pool.querySync(relays, {
    kinds: [1059],
    '#p': [myPubkey]
  }, { maxWait: opts.maxWait || 8000 })
}

/**
 * Subscribe to events in real-time.
 * Returns a SubCloser with a .close() method.
 */
export async function subscribeEvents(filter, targetPubkey, callbacks) {
  const relays = targetPubkey
    ? await getReadRelaysFor(targetPubkey)
    : FALLBACK_RELAYS
  const pool = getPool()
  return pool.subscribe(relays, filter, callbacks)
}

// ── Utilities ────────────────────────────────────────────────────────────────

function dedup(urls) {
  return [...new Set(urls.map(u => u.replace(/\/$/, '')))]
}
