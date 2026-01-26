/**
 * NIP-07 Browser Extension Utilities
 * Handles detection and interaction with Nostr browser extensions
 * (nos2x, Alby, etc.)
 */

/**
 * Check if a NIP-07 compatible extension is available
 * @returns {boolean}
 */
export function isNip07Available() {
  return typeof window !== 'undefined' && typeof window.nostr !== 'undefined'
}

/**
 * Wait for NIP-07 extension to be available (some extensions load async)
 * @param {number} timeout - Max wait time in ms (default 1000)
 * @returns {Promise<boolean>}
 */
export async function waitForNip07(timeout = 1000) {
  if (isNip07Available()) return true

  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (isNip07Available()) {
        resolve(true)
      } else if (Date.now() - start > timeout) {
        resolve(false)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

/**
 * Get public key from extension
 * @returns {Promise<{hex: string, npub: string}>}
 * @throws {Error} if extension not available or user denies permission
 */
export async function getPublicKey() {
  if (!isNip07Available()) {
    throw new Error('No NIP-07 extension detected')
  }

  try {
    // Extension returns hex pubkey
    const hexPubkey = await window.nostr.getPublicKey()

    // Convert to npub for display
    const npub = hexToNpub(hexPubkey)

    return { hex: hexPubkey, npub }
  } catch (error) {
    if (error.message?.includes('denied') || error.message?.includes('rejected')) {
      throw new Error('Permission denied by user')
    }
    throw error
  }
}

/**
 * Sign an event using the extension
 * @param {Object} unsignedEvent - Event without id, pubkey, sig
 * @returns {Promise<Object>} - Fully signed event with id, pubkey, sig
 */
export async function signEvent(unsignedEvent) {
  if (!isNip07Available()) {
    throw new Error('No NIP-07 extension detected')
  }

  try {
    // Extension expects: { created_at, kind, tags, content }
    // Extension returns: { id, pubkey, created_at, kind, tags, content, sig }
    const signedEvent = await window.nostr.signEvent(unsignedEvent)
    return signedEvent
  } catch (error) {
    if (error.message?.includes('denied') || error.message?.includes('rejected')) {
      throw new Error('Signing rejected by user')
    }
    throw error
  }
}

/**
 * Create an unsigned badge definition event (kind 30009)
 * @param {Object} badge - Badge data
 * @returns {Object} - Unsigned event ready for signing
 */
export function createBadgeDefinitionEvent(badge) {
  const tags = [
    ['d', badge.identifier],
    ['name', badge.name]
  ]

  if (badge.description) {
    tags.push(['description', badge.description])
  }
  if (badge.image) {
    tags.push(['image', badge.image])
  }

  return {
    created_at: Math.floor(Date.now() / 1000),
    kind: 30009,
    tags,
    content: `Badge definition: ${badge.name}`
  }
}

/**
 * Create an unsigned badge award event (kind 8)
 * @param {string} aTag - Badge definition a-tag (30009:pubkey:identifier)
 * @param {string[]} recipients - Array of recipient pubkeys (hex format)
 * @returns {Object} - Unsigned event ready for signing
 */
export function createBadgeAwardEvent(aTag, recipients) {
  const tags = [
    ['a', aTag],
    ...recipients.map(pubkey => ['p', pubkey])
  ]

  return {
    created_at: Math.floor(Date.now() / 1000),
    kind: 8,
    tags,
    content: `Awarded badge to ${recipients.length} recipient(s)`
  }
}

/**
 * Create an unsigned profile badges event (kind 30008)
 * @param {Array} badgeTags - Array of badge tags [["a", aTag], ["e", eventId], ...]
 * @returns {Object} - Unsigned event ready for signing
 */
export function createProfileBadgesEvent(badgeTags) {
  return {
    created_at: Math.floor(Date.now() / 1000),
    kind: 30008,
    tags: [
      ['d', 'profile_badges'],
      ...badgeTags
    ],
    content: ''
  }
}

/**
 * Convert hex pubkey to npub (bech32)
 * Uses a simple implementation without external dependencies
 * @param {string} hex - 64-character hex public key
 * @returns {string} - npub1... format
 */
function hexToNpub(hex) {
  // Bech32 character set
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

  // Convert hex to 5-bit groups
  const data = []
  for (let i = 0; i < hex.length; i += 2) {
    data.push(parseInt(hex.substr(i, 2), 16))
  }

  // Convert 8-bit to 5-bit
  const converted = convertBits(data, 8, 5, true)

  // Calculate checksum
  const hrp = 'npub'
  const checksum = createChecksum(hrp, converted)

  // Encode
  let result = hrp + '1'
  for (const d of converted) {
    result += CHARSET[d]
  }
  for (const c of checksum) {
    result += CHARSET[c]
  }

  return result
}

/**
 * Convert between bit sizes for bech32 encoding
 */
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0
  let bits = 0
  const result = []
  const maxv = (1 << toBits) - 1

  for (const value of data) {
    acc = (acc << fromBits) | value
    bits += fromBits
    while (bits >= toBits) {
      bits -= toBits
      result.push((acc >> bits) & maxv)
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv)
    }
  }

  return result
}

/**
 * Create bech32 checksum
 */
function createChecksum(hrp, data) {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0])
  const polymod = bech32Polymod(values) ^ 1
  const checksum = []
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31)
  }
  return checksum
}

function hrpExpand(hrp) {
  const result = []
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5)
  }
  result.push(0)
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31)
  }
  return result
}

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const b = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) {
        chk ^= GEN[i]
      }
    }
  }
  return chk
}

/**
 * Create an unsigned badge request event (kind 30058)
 * @param {string} badgeATag - Badge definition a-tag (30009:pubkey:identifier)
 * @param {string} content - Message to issuer
 * @param {Array} proofs - Array of {eventId, type} objects
 * @param {boolean} withdrawn - Whether this is a withdrawal
 * @returns {Object} - Unsigned event ready for signing
 */
export function createBadgeRequestEvent(badgeATag, content = '', proofs = [], withdrawn = false) {
  // Extract issuer pubkey from a_tag
  const parts = badgeATag.split(':')
  const issuerPubkey = parts[1]

  const tags = [
    ['d', badgeATag],
    ['a', badgeATag],
    ['p', issuerPubkey]
  ]

  // Add proof tags
  for (const proof of proofs) {
    tags.push(['proof', proof.eventId, proof.type || 'note'])
  }

  // Add withdrawn status if withdrawing
  if (withdrawn) {
    tags.push(['status', 'withdrawn'])
  }

  return {
    created_at: Math.floor(Date.now() / 1000),
    kind: 30058,
    tags,
    content: withdrawn ? '' : content
  }
}

/**
 * Create an unsigned badge denial event (kind 30059)
 * @param {string} requestEventId - Event ID of the request being denied
 * @param {string} badgeATag - Badge definition a-tag
 * @param {string} requesterPubkey - Pubkey of the requester
 * @param {string} reason - Reason for denial
 * @param {boolean} revoked - Whether this is a revocation
 * @returns {Object} - Unsigned event ready for signing
 */
export function createBadgeDenialEvent(requestEventId, badgeATag, requesterPubkey, reason = '', revoked = false) {
  const tags = [
    ['d', requestEventId],
    ['a', badgeATag],
    ['e', requestEventId],
    ['p', requesterPubkey]
  ]

  if (revoked) {
    tags.push(['status', 'revoked'])
  }

  return {
    created_at: Math.floor(Date.now() / 1000),
    kind: 30059,
    tags,
    content: revoked ? '' : reason
  }
}

/**
 * Convert npub to hex pubkey
 * @param {string} npub - npub1... format
 * @returns {string} - 64-character hex
 */
export function npubToHex(npub) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

  // Remove hrp and separator
  const dataStr = npub.slice(5) // Remove 'npub1'

  // Decode characters to 5-bit values
  const data = []
  for (const char of dataStr) {
    const index = CHARSET.indexOf(char)
    if (index === -1) throw new Error('Invalid bech32 character')
    data.push(index)
  }

  // Remove checksum (last 6 characters)
  const payload = data.slice(0, -6)

  // Convert 5-bit to 8-bit
  const converted = convertBits(payload, 5, 8, false)

  // Convert to hex
  return converted.map(b => b.toString(16).padStart(2, '0')).join('')
}
