// Chat configuration
// Rinball (rainyba) — BadgeBox developer
export const ADMIN_PUBKEY_HEX = 'cb139496cdad19eb254cb469ed6eddcd98d1c47378a61bc54816624c42199458'
export const ADMIN_NPUB = 'npub1evfef9kd45v7kf2vk3576mkaekvdr3rn0znph32gze3ycssej3vq9n043w'

// Badge that grants access to the admin chat UI
export const ADMIN_BADGE_ATAG = `30009:${ADMIN_PUBKEY_HEX}:badgebox-admin`

// NIP-28 Public Chatroom — BadgeBox community channel
// Will be set once the channel is created (kind 40 event ID)
export const PUBLIC_CHANNEL_ID = null // TODO: set after creating the channel
