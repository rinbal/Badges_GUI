/**
 * Outbox Model (NIP-65)
 *
 * Smart relay routing based on user relay lists.
 * Foundation for all Nostr communication in BadgeBox:
 *   - DM chat (NIP-17)
 *   - NIP-29 group chat (pinned to the group host relay)
 *
 * How it works:
 *   1. Fetch user's relay list (kind 10002) from known relays
 *   2. Cache relay lists per pubkey (TTL-based)
 *   3. Route writes to user's write relays + fallback relays
 *   4. Route reads from target's write relays (that's where their events are)
 *   5. Always include fallback relays for redundancy
 *   6. Track relay failures and skip recently-dead relays
 */

import { nip65, RelayPool } from 'nostr-core'

// ── Default Relay Sets ───────────────────────────────────────────────────────

// General write-capable free relays. Used as the outbox safety net for reads
// and writes when a user has no published NIP-65 list. All verified reachable.
export const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.0xchat.com'
]

// DM-optimized free relays (good NIP-17 support).
export const DM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.0xchat.com',
  'wss://relay.nos.social'
]

// Indexer relays that aggregate profile (kind 0) and relay-list (kind 10002)
// metadata. Queried when discovering a pubkey's NIP-65 relays, since they carry
// these lists even when the author's own relays are not yet known.
export const INDEXER_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.nos.social'
]

// ── Relay List Cache ─────────────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000        // 30 minutes for valid relay lists
const CACHE_TTL_EMPTY = 3 * 60 * 1000   // 3 minutes for empty results (retry sooner)
const relayListCache = new Map()         // pubkey -> { read: [], write: [], fetchedAt, empty }
const dmInboxCache = new Map()           // pubkey -> { relays: [], fetchedAt, empty } (NIP-17 kind 10050)

// ── Relay Health Tracking ────────────────────────────────────────────────────

const FAIL_WINDOW = 5 * 60 * 1000   // remember failures for 5 minutes
const MAX_FAILURES = 2               // skip relay after this many recent failures
const _relayFailures = new Map()     // url -> timestamp[]

function recordRelayFailure(url) {
  const key = url.replace(/\/$/, '')
  const now = Date.now()
  const timestamps = (_relayFailures.get(key) || []).filter(t => now - t < FAIL_WINDOW)
  timestamps.push(now)
  _relayFailures.set(key, timestamps)
}

function isRelayHealthy(url) {
  const key = url.replace(/\/$/, '')
  const now = Date.now()
  const timestamps = (_relayFailures.get(key) || []).filter(t => now - t < FAIL_WINDOW)
  return timestamps.length < MAX_FAILURES
}

/** Filter out recently-failed relays, keeping at least `min` to avoid empty lists */
function filterHealthy(urls, min = 3) {
  const healthy = urls.filter(u => isRelayHealthy(u))
  return healthy.length >= min ? healthy : urls
}

// ── Pool Management ──────────────────────────────────────────────────────────

let _pool = null

export function getPool() {
  if (!_pool) {
    _pool = new RelayPool({ maxWaitForConnection: 3000 })
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
    const events = await pool.querySync([...FALLBACK_RELAYS, ...INDEXER_RELAYS], {
      kinds: [10002],
      authors: [pubkey]
    }, { maxWait: 5000 })

    if (events.length === 0) {
      // No relay list published - cache briefly so we retry sooner
      relayListCache.set(pubkey, { read: [], write: [], fetchedAt: Date.now(), empty: true })
      return { read: [], write: [] }
    }

    // Use most recent event
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
    const parsed = nip65.parseRelayList(latest)

    const read = nip65.getReadRelays(parsed)
    const write = nip65.getWriteRelays(parsed)

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
  _relayFailures.clear()
}

// ── Smart Relay Selection ────────────────────────────────────────────────────

/**
 * Get relays to PUBLISH an event from a given author.
 * Combines user's write relays with fallback relays.
 * No health filtering for writes - try all relays to maximize delivery.
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
  return filterHealthy(dedup([...userRelays.write, ...FALLBACK_RELAYS]))
}

/**
 * Get a pubkey's DM inbox relays (NIP-17 kind 10050). This is where gift wraps
 * addressed to that user should be published and read. Falls back to the shared
 * DM relays when the user has not published an inbox list. Cached per pubkey.
 */
export async function getDmInboxRelays(pubkey) {
  const cached = dmInboxCache.get(pubkey)
  if (cached) {
    const ttl = cached.empty ? CACHE_TTL_EMPTY : CACHE_TTL
    if (Date.now() - cached.fetchedAt < ttl) return cached.relays
  }

  try {
    const events = await getPool().querySync(
      FALLBACK_RELAYS,
      { kinds: [10050], authors: [pubkey] },
      { maxWait: 5000 }
    )
    if (events.length > 0) {
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
      const listed = dedup(latest.tags.filter(t => t[0] === 'relay' && t[1]).map(t => t[1]))
      if (listed.length > 0) {
        dmInboxCache.set(pubkey, { relays: listed, fetchedAt: Date.now(), empty: false })
        return listed
      }
    }
  } catch { /* fall through to the shared DM relays */ }

  const fallback = filterHealthy([...DM_RELAYS])
  dmInboxCache.set(pubkey, { relays: fallback, fetchedAt: Date.now(), empty: true })
  return fallback
}

/**
 * Get relays to READ my own gift-wrap inbox from.
 * My NIP-17 inbox relays, unioned with my write relays for redundancy.
 */
export async function getDmReadRelays(myPubkey) {
  const [inbox, myRelays] = await Promise.all([
    getDmInboxRelays(myPubkey),
    getUserRelays(myPubkey)
  ])
  return filterHealthy(dedup([...inbox, ...myRelays.write, ...DM_RELAYS]))
}

// ── Publish & Query Helpers ──────────────────────────────────────────────────

/**
 * querySync wrapper that records relay failures after each query.
 * Failed relays get tracked so filterHealthy skips them next time.
 */
export async function trackedQuerySync(relays, filter, opts = {}) {
  const pool = getPool()
  const maxWait = opts.maxWait || 6000

  const events = await pool.querySync(relays, filter, { maxWait })

  // After query completes, check which relays failed to connect
  const status = pool.listConnectionStatus()
  for (const url of relays) {
    const key = url.replace(/\/$/, '')
    if (status.has(key) && !status.get(key)) {
      recordRelayFailure(url)
    }
  }

  return events
}

/**
 * Publish an event using the outbox model.
 */
export async function publishEvent(event, authorPubkey) {
  const relays = await getWriteRelays(authorPubkey)
  const pool = getPool()
  return pool.publish(relays, event)
}

/**
 * Publish a gift wrap (kind 1059) to a reader's NIP-17 inbox relays.
 */
export async function publishGiftWrap(wrap, readerPubkey) {
  const relays = await getDmInboxRelays(readerPubkey)
  return getPool().publish(relays, wrap)
}

/**
 * Query events using the outbox model.
 */
export async function queryEvents(filter, targetPubkey, opts = {}) {
  const relays = targetPubkey
    ? await getReadRelaysFor(targetPubkey)
    : FALLBACK_RELAYS
  return trackedQuerySync(relays, filter, { maxWait: opts.maxWait || 6000 })
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
