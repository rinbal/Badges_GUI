/**
 * Unified Chat Service (nostr-core only)
 *
 * All functions take a nostr-core Signer - no more auth-method branching.
 * Supports NIP-17 gift wrap (best privacy) with NIP-04 fallback (legacy).
 *
 * Functions:
 *   sendDirectMessage(content, signer, recipientPubkey)
 *   fetchDirectMessages(signer, myPubkey, partnerPubkey)
 *   fetchAllConversations(signer, myPubkey)
 *   checkBadgeAccess(userPubkey, badgeATag)
 *   fetchNostrProfile(pubkey)
 */

import {
  nip17,
  nip04 as nip04Crypto,
  nip44,
  nip59,
  generateSecretKey,
  getPublicKey,
  finalizeEvent
} from 'nostr-core'

import { signerHasNip44, signerHasNip04 } from '@/services/signer'

import {
  getPool,
  publishDm,
  queryDms,
  getDmRelays,
  getDmReadRelays,
  FALLBACK_RELAYS
} from '@/services/outbox'

// ── Send Direct Message ──────────────────────────────────────────────────────

/**
 * Send an encrypted DM to a recipient.
 * Auto-selects the best encryption method:
 *   - NIP-44 available → NIP-17 gift wrap (sender anonymity)
 *   - NIP-04 only → Legacy kind 4 DM (still encrypted)
 */
export async function sendDirectMessage(content, signer, recipientPubkey) {
  const senderPubkey = await signer.getPublicKey()

  // Try NIP-17 first (best privacy), fall back to NIP-04 if it fails at runtime
  if (signerHasNip44(signer)) {
    try {
      return await sendNip17(content, signer, senderPubkey, recipientPubkey)
    } catch (err) {
      // NIP-44 reported as available but failed (e.g. Amber doesn't actually support it)
      // Fall through to NIP-04
      console.warn('NIP-17 send failed, falling back to NIP-04:', err.message)
    }
  }

  if (signerHasNip04(signer)) {
    return await sendNip04(content, signer, senderPubkey, recipientPubkey)
  }

  throw new Error('Your signer supports neither NIP-44 nor NIP-04 encryption.')
}

/**
 * NIP-17 gift-wrapped DM (3-layer: rumor → seal → wrap).
 * Best privacy - hides sender identity and metadata.
 */
async function sendNip17(content, signer, senderPubkey, recipientPubkey) {
  // 1. Create rumor (kind 14, unsigned)
  const rumor = nip59.createRumor(
    { kind: 14, content, tags: [['p', recipientPubkey]], created_at: Math.floor(Date.now() / 1000) },
    senderPubkey
  )

  // 2. Create seal (kind 13) - encrypt rumor with sender→recipient NIP-44
  const encryptedRumor = await signer.nip44.encrypt(recipientPubkey, JSON.stringify(rumor))
  const signedSeal = await signer.signEvent({
    kind: 13,
    content: encryptedRumor,
    tags: [],
    created_at: randomTimestamp()
  })

  // 3. Create gift wrap (kind 1059) - encrypt seal with ephemeral key
  const ephemeralSk = generateSecretKey()
  const conversationKey = nip44.getConversationKey(ephemeralSk, recipientPubkey)
  const encryptedSeal = nip44.encrypt(JSON.stringify(signedSeal), conversationKey)

  const wrapEvent = finalizeEvent({
    kind: 1059,
    content: encryptedSeal,
    tags: [['p', recipientPubkey]],
    created_at: randomTimestamp()
  }, ephemeralSk)

  await publishDm(wrapEvent, senderPubkey, recipientPubkey)

  return {
    id: wrapEvent.id,
    content,
    created_at: rumor.created_at,
    sender: senderPubkey,
    recipient: recipientPubkey
  }
}

/**
 * NIP-04 legacy DM (kind 4).
 * Fallback when NIP-44 is not available.
 */
async function sendNip04(content, signer, senderPubkey, recipientPubkey) {
  const encrypted = await signer.nip04.encrypt(recipientPubkey, content)

  const signedEvent = await signer.signEvent({
    kind: 4,
    content: encrypted,
    tags: [['p', recipientPubkey]],
    created_at: Math.floor(Date.now() / 1000)
  })

  await publishDm(signedEvent, senderPubkey, recipientPubkey)

  return {
    id: signedEvent.id,
    content,
    created_at: signedEvent.created_at,
    sender: senderPubkey,
    recipient: recipientPubkey
  }
}

// ── Fetch Direct Messages ────────────────────────────────────────────────────

/**
 * Fetch and decrypt DMs between two parties.
 * Queries BOTH kind 1059 (NIP-17) and kind 4 (NIP-04).
 */
export async function fetchDirectMessages(signer, myPubkey, partnerPubkey) {
  const pool = getPool()
  const dmRelays = await getDmRelays(myPubkey, partnerPubkey)
  const myReadRelays = await getDmReadRelays(myPubkey)

  const hasNip44 = signerHasNip44(signer)
  const hasNip04 = signerHasNip04(signer)

  // Build queries based on capabilities
  const queries = []

  if (hasNip04) {
    queries.push(
      pool.querySync(myReadRelays, { kinds: [4], authors: [partnerPubkey], '#p': [myPubkey] }, { maxWait: 8000 }),
      pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 8000 })
    )
  }

  if (hasNip44) {
    queries.push(
      pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 8000 }),
      pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 8000 })
    )
  }

  const results = await Promise.all(queries)

  const messages = []
  const seenIds = new Set()
  let idx = 0

  // Decrypt NIP-04
  if (hasNip04) {
    const incomingK4 = results[idx++]
    const sentK4 = results[idx++]

    for (const evt of incomingK4) {
      if (seenIds.has(evt.id)) continue
      try {
        const plaintext = await signer.nip04.decrypt(partnerPubkey, evt.content)
        seenIds.add(evt.id)
        messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: partnerPubkey, recipient: myPubkey, isMine: false })
      } catch { /* skip */ }
    }

    for (const evt of sentK4) {
      if (seenIds.has(evt.id)) continue
      try {
        const plaintext = await signer.nip04.decrypt(partnerPubkey, evt.content)
        seenIds.add(evt.id)
        messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
      } catch { /* skip */ }
    }
  }

  // Decrypt NIP-17
  if (hasNip44) {
    const incomingWraps = results[idx++]
    const sentWraps = results[idx++]

    for (const wrap of incomingWraps) {
      try {
        const rumor = await unwrapGiftWrap(wrap, signer)
        if (rumor && rumor.pubkey === partnerPubkey && !seenIds.has(rumor.id)) {
          seenIds.add(rumor.id)
          messages.push({ id: rumor.id, content: rumor.content, created_at: rumor.created_at, sender: rumor.pubkey, recipient: myPubkey, isMine: false })
        }
      } catch { /* skip */ }
    }

    for (const wrap of sentWraps) {
      try {
        const rumor = await unwrapGiftWrap(wrap, signer)
        if (rumor && rumor.pubkey === myPubkey && !seenIds.has(rumor.id)) {
          seenIds.add(rumor.id)
          messages.push({ id: rumor.id, content: rumor.content, created_at: rumor.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
        }
      } catch { /* skip */ }
    }
  }

  return messages.sort((a, b) => a.created_at - b.created_at)
}

// ── Admin: Fetch All Conversations ───────────────────────────────────────────

/**
 * Fetch all DMs addressed to the current user.
 * Groups messages by conversation partner. Used for admin inbox.
 */
export async function fetchAllConversations(signer, myPubkey) {
  const pool = getPool()
  const myReadRelays = await getDmReadRelays(myPubkey)

  const hasNip44 = signerHasNip44(signer)
  const hasNip04 = signerHasNip04(signer)

  const queries = []
  if (hasNip04) queries.push(pool.querySync(myReadRelays, { kinds: [4], '#p': [myPubkey] }, { maxWait: 10000 }))
  if (hasNip44) queries.push(pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 10000 }))

  const results = await Promise.all(queries)
  const conversations = new Map()
  let idx = 0

  // NIP-04 incoming
  if (hasNip04) {
    for (const evt of results[idx++]) {
      if (evt.pubkey === myPubkey) continue
      try {
        const plaintext = await signer.nip04.decrypt(evt.pubkey, evt.content)
        if (!conversations.has(evt.pubkey)) conversations.set(evt.pubkey, [])
        conversations.get(evt.pubkey).push({
          id: evt.id, content: plaintext, created_at: evt.created_at,
          sender: evt.pubkey, recipient: myPubkey, isMine: false
        })
      } catch { /* skip */ }
    }
  }

  // NIP-17 incoming
  if (hasNip44) {
    for (const wrap of results[idx++]) {
      try {
        const rumor = await unwrapGiftWrap(wrap, signer)
        if (!rumor) continue
        const sender = rumor.pubkey
        if (!conversations.has(sender)) conversations.set(sender, [])
        conversations.get(sender).push({
          id: rumor.id, content: rumor.content, created_at: rumor.created_at,
          sender, recipient: myPubkey, isMine: false
        })
      } catch { /* skip */ }
    }
  }

  // Fetch sent replies for each partner
  for (const [partnerPubkey, msgs] of conversations) {
    const dmRelays = await getDmRelays(myPubkey, partnerPubkey)

    const replyQueries = []
    if (hasNip04) replyQueries.push(pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 5000 }))
    if (hasNip44) replyQueries.push(pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 5000 }))

    const replyResults = await Promise.all(replyQueries)
    let rIdx = 0

    if (hasNip04) {
      for (const evt of replyResults[rIdx++]) {
        try {
          const plaintext = await signer.nip04.decrypt(partnerPubkey, evt.content)
          msgs.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
        } catch { /* skip */ }
      }
    }

    if (hasNip44) {
      for (const wrap of replyResults[rIdx++]) {
        try {
          const rumor = await unwrapGiftWrap(wrap, signer)
          if (rumor && rumor.pubkey === myPubkey) {
            msgs.push({ id: rumor.id, content: rumor.content, created_at: rumor.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
          }
        } catch { /* skip */ }
      }
    }

    msgs.sort((a, b) => a.created_at - b.created_at)
  }

  return conversations
}

// ── Gift Wrap Unwrapping ─────────────────────────────────────────────────────

/**
 * Unwrap a NIP-17 gift-wrapped event using a signer's NIP-44 decrypt.
 * Works with any signer that has nip44 support (nsec, NIP-07, Amber).
 */
async function unwrapGiftWrap(wrap, signer) {
  if (wrap.kind !== 1059) return null

  // Decrypt the seal (ephemeral pubkey is wrap.pubkey)
  const sealJson = await signer.nip44.decrypt(wrap.pubkey, wrap.content)
  const seal = JSON.parse(sealJson)

  if (seal.kind !== 13) return null

  // Decrypt the rumor (sender pubkey is seal.pubkey)
  const rumorJson = await signer.nip44.decrypt(seal.pubkey, seal.content)
  return JSON.parse(rumorJson)
}

// ── Badge Access Check ───────────────────────────────────────────────────────

export async function checkBadgeAccess(userPubkey, badgeATag) {
  const pool = getPool()
  const events = await pool.querySync(FALLBACK_RELAYS, {
    kinds: [30008],
    authors: [userPubkey],
    '#d': ['profile_badges']
  }, { maxWait: 6000 })

  if (events.length === 0) return false
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
  return latest.tags.some(tag => tag[0] === 'a' && tag[1] === badgeATag)
}

// ── Fetch Profile ────────────────────────────────────────────────────────────

export async function fetchNostrProfile(pubkey) {
  const pool = getPool()
  const events = await pool.querySync(FALLBACK_RELAYS, {
    kinds: [0],
    authors: [pubkey]
  }, { maxWait: 5000 })

  if (events.length === 0) return null
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
  try {
    const profile = JSON.parse(latest.content)
    return {
      pubkey,
      name: profile.name || profile.display_name || null,
      picture: profile.picture || null,
      nip05: profile.nip05 || null
    }
  } catch {
    return null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomTimestamp() {
  const now = Math.floor(Date.now() / 1000)
  const twoDays = 2 * 24 * 60 * 60
  return now - Math.floor(Math.random() * twoDays)
}
