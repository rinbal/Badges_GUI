/**
 * NIP-17 / NIP-04 Chat Service
 *
 * Supports three encryption modes with automatic fallback:
 *
 *   1. NIP-17 Gift Wrap (best privacy — sender anonymity, metadata hiding)
 *      Uses NIP-44 + NIP-59 three-layer wrapping.
 *      Available: nsec users always, NIP-07 if extension has nip44.
 *
 *   2. NIP-04 Legacy DMs (widely supported — all NIP-07 extensions)
 *      Kind 4 events with AES-256-CBC encryption.
 *      Fallback when NIP-44 is not available.
 *
 *   3. Receiving: queries BOTH kind 1059 (NIP-17) and kind 4 (NIP-04)
 *      so the chat works regardless of which method the other party uses.
 */

import {
  nip17,
  nip04,
  nip44,
  nip59,
  nip19,
  generateSecretKey,
  getPublicKey,
  finalizeEvent
} from 'nostr-core'

import {
  getPool,
  publishDm,
  queryDms,
  getDmRelays,
  getDmReadRelays,
  FALLBACK_RELAYS
} from '@/services/outbox'

// ── Key Utils ────────────────────────────────────────────────────────────────

function nsecToSecretKey(nsec) {
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec')
  return decoded.data
}

// ── Capability Detection ─────────────────────────────────────────────────────

/**
 * Detect what encryption the NIP-07 extension supports.
 * Returns 'nip44' | 'nip04' | null
 */
export function detectNip07Capabilities() {
  if (!window.nostr) return null
  if (window.nostr.nip44) return 'nip44'
  if (window.nostr.nip04) return 'nip04'
  return null
}

// ── Send Messages ────────────────────────────────────────────────────────────

/**
 * Send a NIP-17 gift-wrapped DM using secret key (nsec flow).
 * Always uses NIP-44 — best privacy.
 */
export async function sendWithSecretKey(content, nsec, recipientPubkey) {
  const sk = nsecToSecretKey(nsec)
  const senderPubkey = getPublicKey(sk)
  const wrap = nip17.wrapDirectMessage(content, sk, recipientPubkey)

  await publishDm(wrap, senderPubkey, recipientPubkey)

  return {
    id: wrap.id,
    content,
    created_at: Math.floor(Date.now() / 1000),
    sender: senderPubkey,
    recipient: recipientPubkey
  }
}

/**
 * Send via NIP-07 — auto-detects best available encryption.
 * NIP-44 → NIP-17 gift wrap (best privacy)
 * NIP-04 → Legacy kind 4 DM (fallback, still encrypted)
 */
export async function sendWithNip07(content, senderPubkey, recipientPubkey) {
  if (!window.nostr) throw new Error('No Nostr extension detected. Please install nos2x or Alby.')

  const capability = detectNip07Capabilities()

  if (capability === 'nip44') {
    return await sendNip17WithNip07(content, senderPubkey, recipientPubkey)
  } else if (capability === 'nip04') {
    return await sendNip04WithNip07(content, senderPubkey, recipientPubkey)
  } else {
    throw new Error('Your Nostr extension supports neither NIP-44 nor NIP-04 encryption. Please update your extension.')
  }
}

/**
 * NIP-17 gift-wrapped DM via NIP-07 extension (NIP-44 available).
 */
async function sendNip17WithNip07(content, senderPubkey, recipientPubkey) {
  // 1. Create rumor (kind 14, unsigned)
  const rumor = nip59.createRumor(
    { kind: 14, content, tags: [['p', recipientPubkey]], created_at: Math.floor(Date.now() / 1000) },
    senderPubkey
  )

  // 2. Create seal (kind 13) — encrypt rumor with sender→recipient NIP-44
  const encryptedRumor = await window.nostr.nip44.encrypt(recipientPubkey, JSON.stringify(rumor))
  const signedSeal = await window.nostr.signEvent({
    kind: 13,
    content: encryptedRumor,
    tags: [],
    created_at: randomTimestamp()
  })

  // 3. Create gift wrap (kind 1059) — encrypt seal with ephemeral key
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
 * NIP-04 legacy DM (kind 4) via NIP-07 extension.
 * Fallback when NIP-44 is not available.
 */
async function sendNip04WithNip07(content, senderPubkey, recipientPubkey) {
  const encrypted = await window.nostr.nip04.encrypt(recipientPubkey, content)

  const signedEvent = await window.nostr.signEvent({
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

// ── Fetch Messages ───────────────────────────────────────────────────────────

/**
 * Fetch DMs using secret key (nsec flow).
 * Queries BOTH kind 1059 (NIP-17) and kind 4 (NIP-04).
 */
export async function fetchMessagesWithSecretKey(nsec, partnerPubkey) {
  const sk = nsecToSecretKey(nsec)
  const myPubkey = getPublicKey(sk)
  const pool = getPool()
  const dmRelays = await getDmRelays(myPubkey, partnerPubkey)
  const myReadRelays = await getDmReadRelays(myPubkey)

  // Fetch all relevant events in parallel
  const [myWraps, partnerWraps, myKind4, partnerKind4] = await Promise.all([
    // NIP-17: gift wraps addressed to me
    pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 8000 }),
    // NIP-17: gift wraps addressed to partner (my sent messages)
    pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 8000 }),
    // NIP-04: legacy DMs addressed to me from partner
    pool.querySync(myReadRelays, { kinds: [4], authors: [partnerPubkey], '#p': [myPubkey] }, { maxWait: 8000 }),
    // NIP-04: legacy DMs I sent to partner
    pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 8000 })
  ])

  const messages = []
  const seenIds = new Set()

  // Decrypt NIP-17 incoming
  for (const wrap of myWraps) {
    try {
      const dm = nip17.unwrapDirectMessage(wrap, sk)
      if (dm.sender === partnerPubkey && !seenIds.has(dm.id)) {
        seenIds.add(dm.id)
        messages.push({ id: dm.id, content: dm.content, created_at: dm.created_at, sender: dm.sender, recipient: myPubkey, isMine: false })
      }
    } catch { /* not for us */ }
  }

  // Decrypt NIP-17 sent
  for (const wrap of partnerWraps) {
    try {
      const dm = nip17.unwrapDirectMessage(wrap, sk)
      if (dm.sender === myPubkey && !seenIds.has(dm.id)) {
        seenIds.add(dm.id)
        messages.push({ id: dm.id, content: dm.content, created_at: dm.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
      }
    } catch { /* not our message */ }
  }

  // Decrypt NIP-04 incoming
  for (const evt of myKind4) {
    if (seenIds.has(evt.id)) continue
    try {
      const plaintext = nip04.decrypt(sk, partnerPubkey, evt.content)
      seenIds.add(evt.id)
      messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: partnerPubkey, recipient: myPubkey, isMine: false })
    } catch { /* decrypt failed */ }
  }

  // Decrypt NIP-04 sent
  for (const evt of partnerKind4) {
    if (seenIds.has(evt.id)) continue
    try {
      const plaintext = nip04.decrypt(sk, partnerPubkey, evt.content)
      seenIds.add(evt.id)
      messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
    } catch { /* decrypt failed */ }
  }

  return messages.sort((a, b) => a.created_at - b.created_at)
}

/**
 * Fetch DMs using NIP-07 extension.
 * Queries BOTH kind 1059 (NIP-17) and kind 4 (NIP-04).
 * Decrypts with whatever the extension supports.
 */
export async function fetchMessagesWithNip07(myPubkey, partnerPubkey) {
  if (!window.nostr) throw new Error('No Nostr extension detected.')

  const capability = detectNip07Capabilities()
  if (!capability) throw new Error('Your Nostr extension supports neither NIP-44 nor NIP-04 decryption.')

  const pool = getPool()
  const dmRelays = await getDmRelays(myPubkey, partnerPubkey)
  const myReadRelays = await getDmReadRelays(myPubkey)

  const messages = []
  const seenIds = new Set()

  // Always fetch NIP-04 kind 4 events (most extensions support this)
  const [myKind4, partnerKind4] = await Promise.all([
    pool.querySync(myReadRelays, { kinds: [4], authors: [partnerPubkey], '#p': [myPubkey] }, { maxWait: 8000 }),
    pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 8000 })
  ])

  // Decrypt NIP-04 incoming
  if (window.nostr.nip04) {
    for (const evt of myKind4) {
      try {
        const plaintext = await window.nostr.nip04.decrypt(partnerPubkey, evt.content)
        seenIds.add(evt.id)
        messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: partnerPubkey, recipient: myPubkey, isMine: false })
      } catch { /* decrypt failed */ }
    }

    // Decrypt NIP-04 sent
    for (const evt of partnerKind4) {
      try {
        const plaintext = await window.nostr.nip04.decrypt(partnerPubkey, evt.content)
        seenIds.add(evt.id)
        messages.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
      } catch { /* decrypt failed */ }
    }
  }

  // If NIP-44 available, also fetch NIP-17 gift-wrapped DMs
  if (window.nostr.nip44) {
    const [myWraps, partnerWraps] = await Promise.all([
      pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 8000 }),
      pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 8000 })
    ])

    for (const wrap of myWraps) {
      try {
        const rumor = await unwrapWithNip07(wrap)
        if (rumor && rumor.pubkey === partnerPubkey && !seenIds.has(rumor.id)) {
          seenIds.add(rumor.id)
          messages.push({ id: rumor.id, content: rumor.content, created_at: rumor.created_at, sender: rumor.pubkey, recipient: myPubkey, isMine: false })
        }
      } catch { /* skip */ }
    }

    for (const wrap of partnerWraps) {
      try {
        const rumor = await unwrapWithNip07(wrap)
        if (rumor && rumor.pubkey === myPubkey && !seenIds.has(rumor.id)) {
          seenIds.add(rumor.id)
          messages.push({ id: rumor.id, content: rumor.content, created_at: rumor.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
        }
      } catch { /* skip */ }
    }
  }

  return messages.sort((a, b) => a.created_at - b.created_at)
}

/**
 * Unwrap a NIP-17 gift wrap using NIP-07 extension's nip44.decrypt
 */
async function unwrapWithNip07(wrap) {
  if (wrap.kind !== 1059) return null
  const sealJson = await window.nostr.nip44.decrypt(wrap.pubkey, wrap.content)
  const seal = JSON.parse(sealJson)
  if (seal.kind !== 13) return null
  const rumorJson = await window.nostr.nip44.decrypt(seal.pubkey, seal.content)
  return JSON.parse(rumorJson)
}

// ── Admin: Fetch All Conversations ───────────────────────────────────────────

/**
 * Fetch all DMs addressed to the admin (nsec flow).
 * Queries both NIP-17 and NIP-04.
 */
export async function fetchAllConversationsWithSecretKey(nsec) {
  const sk = nsecToSecretKey(nsec)
  const myPubkey = getPublicKey(sk)
  const pool = getPool()
  const myReadRelays = await getDmReadRelays(myPubkey)

  // Fetch both NIP-17 and NIP-04 events addressed to me
  const [wraps, kind4Events] = await Promise.all([
    pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 10000 }),
    pool.querySync(myReadRelays, { kinds: [4], '#p': [myPubkey] }, { maxWait: 10000 })
  ])

  const conversations = new Map()

  // Decrypt NIP-17
  for (const wrap of wraps) {
    try {
      const dm = nip17.unwrapDirectMessage(wrap, sk)
      if (!conversations.has(dm.sender)) conversations.set(dm.sender, [])
      conversations.get(dm.sender).push({
        id: dm.id, content: dm.content, created_at: dm.created_at,
        sender: dm.sender, recipient: myPubkey, isMine: false
      })
    } catch { /* skip */ }
  }

  // Decrypt NIP-04
  for (const evt of kind4Events) {
    const senderPubkey = evt.pubkey
    if (senderPubkey === myPubkey) continue // skip own messages here
    try {
      const plaintext = nip04.decrypt(sk, senderPubkey, evt.content)
      if (!conversations.has(senderPubkey)) conversations.set(senderPubkey, [])
      conversations.get(senderPubkey).push({
        id: evt.id, content: plaintext, created_at: evt.created_at,
        sender: senderPubkey, recipient: myPubkey, isMine: false
      })
    } catch { /* skip */ }
  }

  // Fetch sent replies for each conversation partner
  for (const [partnerPubkey, msgs] of conversations) {
    const dmRelays = await getDmRelays(myPubkey, partnerPubkey)

    const [sentWraps, sentKind4] = await Promise.all([
      pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 5000 }),
      pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 5000 })
    ])

    for (const wrap of sentWraps) {
      try {
        const dm = nip17.unwrapDirectMessage(wrap, sk)
        if (dm.sender === myPubkey) {
          msgs.push({ id: dm.id, content: dm.content, created_at: dm.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
        }
      } catch { /* skip */ }
    }

    for (const evt of sentKind4) {
      try {
        const plaintext = nip04.decrypt(sk, partnerPubkey, evt.content)
        msgs.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
      } catch { /* skip */ }
    }

    msgs.sort((a, b) => a.created_at - b.created_at)
  }

  return conversations
}

/**
 * Fetch all DMs addressed to the admin using NIP-07 extension.
 */
export async function fetchAllConversationsWithNip07(myPubkey) {
  if (!window.nostr) throw new Error('No Nostr extension detected.')

  const capability = detectNip07Capabilities()
  if (!capability) throw new Error('Your extension supports neither NIP-44 nor NIP-04.')

  const pool = getPool()
  const myReadRelays = await getDmReadRelays(myPubkey)
  const conversations = new Map()

  // Always fetch NIP-04 (most compatible)
  if (window.nostr.nip04) {
    const kind4Events = await pool.querySync(myReadRelays, { kinds: [4], '#p': [myPubkey] }, { maxWait: 10000 })

    for (const evt of kind4Events) {
      const senderPubkey = evt.pubkey
      if (senderPubkey === myPubkey) continue
      try {
        const plaintext = await window.nostr.nip04.decrypt(senderPubkey, evt.content)
        if (!conversations.has(senderPubkey)) conversations.set(senderPubkey, [])
        conversations.get(senderPubkey).push({
          id: evt.id, content: plaintext, created_at: evt.created_at,
          sender: senderPubkey, recipient: myPubkey, isMine: false
        })
      } catch { /* skip */ }
    }
  }

  // Also fetch NIP-17 if NIP-44 available
  if (window.nostr.nip44) {
    const wraps = await pool.querySync(myReadRelays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 10000 })

    for (const wrap of wraps) {
      try {
        const rumor = await unwrapWithNip07(wrap)
        if (!rumor) continue
        const senderPubkey = rumor.pubkey
        if (!conversations.has(senderPubkey)) conversations.set(senderPubkey, [])
        conversations.get(senderPubkey).push({
          id: rumor.id, content: rumor.content, created_at: rumor.created_at,
          sender: senderPubkey, recipient: myPubkey, isMine: false
        })
      } catch { /* skip */ }
    }
  }

  // Fetch sent replies for each partner
  for (const [partnerPubkey, msgs] of conversations) {
    const dmRelays = await getDmRelays(myPubkey, partnerPubkey)

    if (window.nostr.nip04) {
      const sentKind4 = await pool.querySync(dmRelays, { kinds: [4], authors: [myPubkey], '#p': [partnerPubkey] }, { maxWait: 5000 })
      for (const evt of sentKind4) {
        try {
          const plaintext = await window.nostr.nip04.decrypt(partnerPubkey, evt.content)
          msgs.push({ id: evt.id, content: plaintext, created_at: evt.created_at, sender: myPubkey, recipient: partnerPubkey, isMine: true })
        } catch { /* skip */ }
      }
    }

    if (window.nostr.nip44) {
      const sentWraps = await pool.querySync(dmRelays, { kinds: [1059], '#p': [partnerPubkey] }, { maxWait: 5000 })
      for (const wrap of sentWraps) {
        try {
          const rumor = await unwrapWithNip07(wrap)
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
