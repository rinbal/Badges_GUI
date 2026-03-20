/**
 * Unified Signer Service
 *
 * Provides a nostr-core compatible Signer regardless of auth method.
 * All signing and encryption flows through one consistent interface.
 *
 * Signer interface (from nostr-core):
 *   getPublicKey(): Promise<string>
 *   signEvent(event): Promise<VerifiedEvent>
 *   nip04?: { encrypt(pk, text), decrypt(pk, text) }
 *   nip44?: { encrypt(pk, text), decrypt(pk, text) }
 */

import {
  createSecretKeySigner,
  Nip07Signer,
  Nip07NotAvailableError,
  nip19
} from 'nostr-core'

/**
 * Create a nostr-core Signer from the current auth state.
 *
 * @param {string} authMethod - 'nsec' | 'nip07' | 'amber'
 * @param {object} opts
 * @param {string|null} opts.nsec - nsec key (for nsec auth)
 * @param {object|null} opts.bunkerSigner - nostr-tools BunkerSigner instance (for Amber)
 * @returns {Signer|null}
 */
export function createSigner(authMethod, { nsec = null, bunkerSigner = null } = {}) {
  if (authMethod === 'nsec' && nsec) {
    return createNsecSigner(nsec)
  }

  if (authMethod === 'nip07') {
    return createNip07Signer()
  }

  if (authMethod === 'amber' && bunkerSigner) {
    return wrapBunkerSigner(bunkerSigner)
  }

  return null
}

/**
 * Create a signer from an nsec key.
 * Always has full NIP-04 and NIP-44 support.
 */
function createNsecSigner(nsec) {
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec key')
  return createSecretKeySigner(decoded.data)
}

/**
 * Create a signer from the NIP-07 browser extension.
 * NIP-04/44 availability depends on the extension.
 */
function createNip07Signer() {
  try {
    return new Nip07Signer()
  } catch (err) {
    if (err instanceof Nip07NotAvailableError) {
      return null
    }
    throw err
  }
}

/**
 * Wrap a nostr-tools BunkerSigner into the nostr-core Signer interface.
 *
 * nostr-tools uses flat methods:   signer.nip04Encrypt(pk, text)
 * nostr-core uses nested objects:   signer.nip04.encrypt(pk, text)
 */
function wrapBunkerSigner(bunkerSigner) {
  return {
    async getPublicKey() {
      return bunkerSigner.getPublicKey()
    },

    async signEvent(event) {
      return bunkerSigner.signEvent(event)
    },

    nip04: {
      async encrypt(pubkey, plaintext) {
        return bunkerSigner.nip04Encrypt(pubkey, plaintext)
      },
      async decrypt(pubkey, ciphertext) {
        return bunkerSigner.nip04Decrypt(pubkey, ciphertext)
      }
    },

    nip44: {
      async encrypt(pubkey, plaintext) {
        return bunkerSigner.nip44Encrypt(pubkey, plaintext)
      },
      async decrypt(pubkey, ciphertext) {
        return bunkerSigner.nip44Decrypt(pubkey, ciphertext)
      }
    }
  }
}

/**
 * Check if a signer supports NIP-44 encryption.
 * For Nip07Signer, this checks the extension at runtime.
 * For nsec signers, always true.
 * For Amber, depends on remote signer capability.
 */
export function signerHasNip44(signer) {
  if (!signer?.nip44) return false

  // Nip07Signer always has the nip44 object but throws NIP07_NIP44_UNSUPPORTED
  // at call time if the extension doesn't support it.
  // For NIP-07, check the extension directly.
  if (signer instanceof Nip07Signer) {
    return !!signer.ext?.nip44
  }

  return true
}

/**
 * Check if a signer supports NIP-04 encryption.
 */
export function signerHasNip04(signer) {
  if (!signer?.nip04) return false

  if (signer instanceof Nip07Signer) {
    return !!signer.ext?.nip04
  }

  return true
}

/**
 * Get the best available encryption method for a signer.
 * Returns 'nip44' | 'nip04' | null
 */
export function getBestEncryption(signer) {
  if (signerHasNip44(signer)) return 'nip44'
  if (signerHasNip04(signer)) return 'nip04'
  return null
}
