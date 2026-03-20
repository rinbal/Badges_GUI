// Chat configuration
// Rinball (rainyba) - BadgeBox developer
export const ADMIN_PUBKEY_HEX = 'cb139496cdad19eb254cb469ed6eddcd98d1c47378a61bc54816624c42199458'
export const ADMIN_NPUB = 'npub1evfef9kd45v7kf2vk3576mkaekvdr3rn0znph32gze3ycssej3vq9n043w'

// Badge that grants access to the admin support chat UI
export const ADMIN_BADGE_ATAG = `30009:${ADMIN_PUBKEY_HEX}:badgebox-admin`

// Badge that grants moderation rights in the public chatroom
export const MODERATOR_BADGE_ATAG = `30009:${ADMIN_PUBKEY_HEX}:badgebox-moderator`

// NIP-28 Public Chatroom - BadgeBox community channel
// Set this after creating the channel (kind 40 event ID).
// To create: log in as admin → visit /community → click "Create Community Channel"
export const PUBLIC_CHANNEL_ID = null
