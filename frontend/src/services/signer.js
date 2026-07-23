/**
 * Unified Signer Service
 *
 * Provides a nostr-core compatible Signer for the local auth methods.
 * Remote signers (NIP-46) already implement the interface and are handled in
 * services/nip46.js, so this only covers nsec and the NIP-07 extension.
 *
 * Signer interface (from nostr-core):
 *   getPublicKey(): Promise<string>
 *   signEvent(event): Promise<VerifiedEvent>
 *   nip44?: { encrypt(pk, text), decrypt(pk, text) }
 *
 * Private messages are NIP-44 only (gift wrapped), so NIP-04 is not used.
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
 * @param {string} authMethod - 'nsec' | 'nip07'
 * @param {object} opts
 * @param {string|null} opts.nsec - nsec key (for nsec auth)
 * @returns {Signer|null}
 */
export function createSigner(authMethod, { nsec = null } = {}) {
  if (authMethod === 'nsec' && nsec) {
    return createNsecSigner(nsec)
  }

  if (authMethod === 'nip07') {
    return createNip07Signer()
  }

  return null
}

/**
 * Create a signer from an nsec key.
 * Always has full NIP-44 support.
 */
function createNsecSigner(nsec) {
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec key')
  return createSecretKeySigner(decoded.data)
}

/**
 * Create a signer from the NIP-07 browser extension.
 * NIP-44 availability depends on the extension.
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
 * Check if a signer supports NIP-44 encryption.
 * For Nip07Signer, this checks the extension at runtime.
 * For nsec and remote (NIP-46) signers, always true.
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
