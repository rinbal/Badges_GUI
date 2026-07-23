/**
 * Best-effort DM notifications.
 *
 * These let people know something happened - they received a badge, or someone
 * asked for one of theirs - via a normal gift-wrapped private message (NIP-17).
 * They are fire-and-forget: a failed or unsupported notification must never
 * break the action that triggered it, so nothing here throws.
 *
 * Sending is client-side, using the acting user's signer. This works for every
 * login that can encrypt (nsec, extension with NIP-44, remote signer). If the
 * signer cannot encrypt, the notification is quietly skipped.
 */

import { sendDirectMessage } from '@/services/nostrChat'
import { signerHasNip44 } from '@/services/signer'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'BadgeBox'

async function send(signer, recipientPubkey, message) {
  try {
    if (!signer || !recipientPubkey || !signerHasNip44(signer)) return
    await sendDirectMessage(message, signer, recipientPubkey)
  } catch (err) {
    console.warn('DM notification failed:', err)
  }
}

/** Tell a recipient they were awarded a badge. */
export function notifyBadgeAwarded(signer, recipientPubkey, badgeName) {
  const what = badgeName ? `the "${badgeName}" badge` : 'a badge'
  return send(signer, recipientPubkey, `You just received ${what} on BadgeBox. Open ${APP_URL} to see it.`)
}

/** Tell a badge issuer that someone requested one of their badges. */
export function notifyBadgeRequested(signer, issuerPubkey, badgeName) {
  const what = badgeName ? `your "${badgeName}" badge` : 'one of your badges'
  return send(signer, issuerPubkey, `Someone requested ${what} on BadgeBox. Open ${APP_URL} to review it.`)
}
