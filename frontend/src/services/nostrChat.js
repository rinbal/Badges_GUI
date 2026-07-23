/**
 * Direct Message Service (nostr-core only)
 *
 * Private messages are NIP-17 gift wrapped end to end:
 *   rumor (kind 14, unsigned)
 *     -> seal (kind 13, signed by the sender, NIP-44 encrypted to the reader)
 *       -> gift wrap (kind 1059, signed by a throwaway key, NIP-44 encrypted)
 *
 * Every message is wrapped twice - once for the recipient and once for the
 * sender - so a sender can read their own history from any device. All
 * encryption is NIP-44 through the active signer, so this behaves identically
 * for nsec, browser extension, and remote (bunker) logins. There is no NIP-04.
 *
 * Public API:
 *   sendDirectMessage(content, signer, recipientPubkey)
 *   fetchDirectMessages(signer, myPubkey, partnerPubkey)
 *   fetchAllConversations(signer, myPubkey)
 *   checkBadgeAccess(userPubkey, badgeATag)
 *   fetchNostrProfile(pubkey)
 */

import { nip59, verifyEvent, getEventHash } from 'nostr-core'

import { signerHasNip44 } from '@/services/signer'
import {
  getPool,
  publishGiftWrap,
  getDmReadRelays,
  trackedQuerySync,
  FALLBACK_RELAYS
} from '@/services/outbox'

// ── Send ───────────────────────────────────────────────────────────────────

/**
 * Send a private message. Resolves to a local echo of the sent message.
 * Throws if the signer cannot do NIP-44 encryption.
 */
export async function sendDirectMessage(content, signer, recipientPubkey) {
  requireNip44(signer)
  const senderPubkey = await signer.getPublicKey()

  const rumor = nip59.createRumor(
    {
      kind: 14,
      content,
      tags: [['p', recipientPubkey]],
      created_at: Math.floor(Date.now() / 1000)
    },
    senderPubkey
  )

  // One sealed copy for the recipient, one for ourselves. Seal sequentially to
  // stay gentle on remote signers; the publishes can run in parallel.
  const recipientWrap = await sealAndWrap(signer, rumor, recipientPubkey)
  const selfWrap = await sealAndWrap(signer, rumor, senderPubkey)

  await Promise.all([
    publishGiftWrap(recipientWrap, recipientPubkey),
    publishGiftWrap(selfWrap, senderPubkey)
  ])

  return {
    id: rumor.id,
    content,
    created_at: rumor.created_at,
    sender: senderPubkey,
    recipient: recipientPubkey
  }
}

/**
 * Seal a rumor for one reader and gift wrap it under a throwaway key.
 * The seal is signed by the sender; nip59.createWrap mints the ephemeral wrap.
 */
async function sealAndWrap(signer, rumor, readerPubkey) {
  const sealedContent = await signer.nip44.encrypt(readerPubkey, JSON.stringify(rumor))
  const seal = await signer.signEvent({
    kind: 13,
    content: sealedContent,
    tags: [],
    created_at: randomPastTimestamp()
  })
  return nip59.createWrap(seal, readerPubkey)
}

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the full conversation with one partner, oldest first.
 */
export async function fetchDirectMessages(signer, myPubkey, partnerPubkey) {
  requireNip44(signer)
  const rumors = await fetchInboxRumors(signer, myPubkey)
  return rumors
    .filter(rumor => conversationPeer(rumor, myPubkey) === partnerPubkey)
    .map(rumor => toMessage(rumor, myPubkey))
    .sort((a, b) => a.created_at - b.created_at)
}

/**
 * Fetch every conversation, grouped by partner pubkey. Used for the inbox.
 */
export async function fetchAllConversations(signer, myPubkey) {
  requireNip44(signer)
  const rumors = await fetchInboxRumors(signer, myPubkey)

  const conversations = new Map()
  for (const rumor of rumors) {
    const peer = conversationPeer(rumor, myPubkey)
    if (!peer) continue
    if (!conversations.has(peer)) conversations.set(peer, [])
    conversations.get(peer).push(toMessage(rumor, myPubkey))
  }
  for (const msgs of conversations.values()) {
    msgs.sort((a, b) => a.created_at - b.created_at)
  }
  return conversations
}

/**
 * Query the gift-wrap inbox (kind 1059 addressed to me) and decrypt each wrap
 * exactly once. Dedups by rumor id, since relays replay wraps on reconnect.
 */
async function fetchInboxRumors(signer, myPubkey) {
  const relays = await getDmReadRelays(myPubkey)
  const wraps = await trackedQuerySync(relays, { kinds: [1059], '#p': [myPubkey] }, { maxWait: 8000 })

  const rumors = []
  const seen = new Set()
  for (const wrap of wraps) {
    const rumor = await unwrapGiftWrap(wrap, signer)
    if (!rumor || seen.has(rumor.id)) continue
    seen.add(rumor.id)
    rumors.push(rumor)
  }
  return rumors
}

// ── Live inbox ───────────────────────────────────────────────────────────────

/**
 * Subscribe to the live gift-wrap inbox (kind 1059 addressed to me) and call
 * onMessage(message) for each newly received message, shaped like the fetch
 * helpers. Decrypts each wrap once and dedups by rumor id - relays replay wraps
 * on reconnect, and there is no usable `since` cursor because gift-wrap
 * timestamps are randomized. Returns a subscription with a .close() method.
 */
export async function subscribeDirectMessages(signer, myPubkey, onMessage) {
  requireNip44(signer)
  const relays = await getDmReadRelays(myPubkey)
  const seen = new Set()

  return getPool().subscribe(relays, { kinds: [1059], '#p': [myPubkey] }, {
    onevent: async (wrap) => {
      const rumor = await unwrapGiftWrap(wrap, signer)
      if (!rumor || seen.has(rumor.id)) return
      seen.add(rumor.id)
      onMessage(toMessage(rumor, myPubkey))
    }
  })
}

// ── Gift wrap unwrapping ─────────────────────────────────────────────────────

/**
 * Decrypt a kind 1059 gift wrap back to its rumor using the signer's NIP-44.
 * Returns null on any failure or if the wrap fails authenticity checks:
 *   - the seal must be a valid, signed kind 13
 *   - the rumor author must match the seal author (no impersonation)
 *   - the rumor id must match its recomputed hash (no forged id)
 */
async function unwrapGiftWrap(wrap, signer) {
  if (wrap?.kind !== 1059) return null
  try {
    const sealJson = await signer.nip44.decrypt(wrap.pubkey, wrap.content)
    const seal = JSON.parse(sealJson)
    if (seal?.kind !== 13 || !verifyEvent(seal)) return null

    const rumorJson = await signer.nip44.decrypt(seal.pubkey, seal.content)
    const rumor = JSON.parse(rumorJson)
    if (!rumor || rumor.pubkey !== seal.pubkey) return null
    if (getEventHash(rumor) !== rumor.id) return null

    return rumor
  } catch {
    return null
  }
}

// ── Message shaping ──────────────────────────────────────────────────────────

/** The other party in a conversation, from my point of view. */
function conversationPeer(rumor, myPubkey) {
  if (rumor.pubkey === myPubkey) {
    const recipient = rumor.tags?.find(t => t[0] === 'p')
    return recipient ? recipient[1] : null
  }
  return rumor.pubkey
}

/** Shape a decrypted rumor into the message object the UI stores use. */
function toMessage(rumor, myPubkey) {
  const isMine = rumor.pubkey === myPubkey
  const peer = conversationPeer(rumor, myPubkey)
  return {
    id: rumor.id,
    content: rumor.content,
    created_at: rumor.created_at,
    sender: rumor.pubkey,
    recipient: isMine ? peer : myPubkey,
    isMine
  }
}

// ── Badge access + profile (shared reads) ────────────────────────────────────

export async function checkBadgeAccess(userPubkey, badgeATag) {
  // Read both the current Profile Badges kind (10008) and the legacy 30008.
  // No '#d' filter: kind 10008 carries no d tag, legacy 30008 uses d=profile_badges.
  const events = await trackedQuerySync(FALLBACK_RELAYS, {
    kinds: [10008, 30008],
    authors: [userPubkey]
  }, { maxWait: 6000 })

  if (events.length === 0) return false
  // Newest wins across the current and legacy kinds
  const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
  return latest.tags.some(tag => tag[0] === 'a' && tag[1] === badgeATag)
}

export async function fetchNostrProfile(pubkey) {
  const events = await trackedQuerySync(FALLBACK_RELAYS, {
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

function requireNip44(signer) {
  if (!signerHasNip44(signer)) {
    throw new Error('Private messages are not supported by your current login method.')
  }
}

/** A timestamp up to two days in the past, per NIP-59 metadata hygiene. */
function randomPastTimestamp() {
  const now = Math.floor(Date.now() / 1000)
  const twoDays = 2 * 24 * 60 * 60
  return now - Math.floor(Math.random() * twoDays)
}
