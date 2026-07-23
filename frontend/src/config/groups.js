/**
 * BadgeBox NIP-29 group chat.
 *
 * A single public group hosted on a NIP-29 relay. All group traffic is pinned
 * to this one relay - that is how NIP-29 works: the relay owns the group's
 * state (metadata, members, admins) and enforces membership.
 *
 * This is basic text chat inside BadgeBox. The full-featured version of the same
 * community (voice, video, files) lives in Lotus; see config/community.js for
 * the outbound link.
 */
export const BADGEBOX_GROUP = {
  relay: 'wss://groups.0xchat.com',
  id: 'badgebox'
}
