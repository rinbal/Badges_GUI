/**
 * BadgeBox public community chat (NIP-29 group, hosted in Lotus).
 *
 * `link` is the destination for every community-chat entry point in the app.
 * It accepts an external URL (https://...) or an internal route (e.g.
 * '/community'). This is a Lotus deep link that opens the BadgeBox group
 * (relay groups.0xchat.com, group id "badgebox") in the full Lotus client.
 *
 * Single source of truth: change it here and every entry point updates.
 */
export const COMMUNITY_CHAT = {
  link: 'https://lotus.mybuho.de/join/g/groups.0xchat.com/badgebox?p=https%3A%2F%2Fblossom.primal.net%2F7945fb61e9710ec5ab65722754ac39d0cc7b2d81aeadbde539b4eea4d6880450&a=A+public+community+for+BadgeBox+users%2C+creators%2C+and+anyone+interested+in+NIP-58+badges.+Share+your+badges%2C+exchange+ideas%2C+ask+questions%2C+g&n=BadgeBox+-+the+most+ambitious+badge+creation+tool',
  label: 'BadgeBox community chat'
}

/** Whether a destination has been configured yet. */
export function isCommunityChatReady() {
  return typeof COMMUNITY_CHAT.link === 'string' && COMMUNITY_CHAT.link.length > 0
}

/** Whether the configured destination is an external URL vs an internal route. */
export function isExternalCommunityLink(link) {
  return typeof link === 'string' && /^https?:\/\//.test(link)
}
