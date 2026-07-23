---
date: 2026-07-23
summary: Badge Box grows from a badge tool into a social one - private encrypted DMs, a community chat, and a way to request the badges you have earned, plus a move to the current NIP-58 Profile Badges standard.
---

# Badge Box v3.0.0

Badge Box grows from a badge tool into a social one: private messaging, a community, and a way to ask for the badges you have earned. Under the hood, Profile Badges move to the current NIP-58 standard.

## Highlights

- **Private encrypted DMs** - End-to-end encrypted direct messages between users, sealed and gift-wrapped (NIP-17 + NIP-59). Open them from the profile menu.
- **Community group chat** - A public group chat on the home page (NIP-29). Anyone can read ; sign in to join and post. One tap opens the same community in Lotus for voice, video, and files.
- **Request a badge** - Ask an issuer for an existing badge with a message and proof. The issuer is notified and can award or deny with a reason ; you get a DM when it is awarded.
- **Feedback & Support chat** - A private, encrypted line to the Badge Box admin, built right in.
- **Sign in with a remote signer** - Log in with Amber, a bunker URI, or nsec.app over NIP-46, alongside the existing browser extension and nsec options.
- **Relay management** - View, add, and remove relays, toggle read/write, and see live connection status and relay info.
- **About page** - A new `/about` page explaining the mission and the open standards Badge Box is built on.
- **Version in the footer** - The running version and build commit now show in the footer, linked to the matching GitHub release.

## Technical updates & fixes

- Profile Badges now publish as the current NIP-58 kind `10008` ; reads still merge the legacy kind `30008`, so older collections keep showing and migrate on the next write. No data loss.
- Private messaging built on NIP-44 encryption with the NIP-17/59 rumor, seal, and gift-wrap flow ; NIP-42 relay auth unlocks the NIP-29 group feed.
- Frontend migrated from `nostr-tools` to `nostr-core` ; `nostr-tools` dependency removed.
- Retired the earlier NIP-28 public-chat prototype in favor of the NIP-29 group and the Lotus community link.
- DM chat performance: sent-reply lookups are batched to avoid per-partner relay round trips.
- Chat readability pass: legible text in purple bubbles, bolder sent messages, and a global paragraph color fix.
- Router now scrolls to top on navigation and restores position on back and forward.
- Deploy and repo hygiene: `netlify.toml` sends `Cache-Control: no-cache` for `sw.js` so PWA updates land immediately, plus `.gitignore` additions and a synced `example_netlify.toml`.
- Documentation refreshed across README, GUIDE, llms.txt, AGENT_README, and integration-prompt.

## Contributors

Thanks to everyone who shipped this release:

- [@DoktorShift](https://github.com/DoktorShift)
- [@rinbal](https://github.com/rinbal)

## Community

- Group Chat: https://lotus.mybuho.de/join/g/groups.0xchat.com/badgebox?p=https%3A%2F%2Fblossom.primal.net%2F7945fb61e9710ec5ab65722754ac39d0cc7b2d81aeadbde539b4eea4d6880450&a=A+public+community+for+BadgeBox+users%2C+creators%2C+and+anyone+interested+in+NIP-58+badges.+Share+your+badges%2C+exchange+ideas%2C+ask+questions%2C+g&n=BadgeBox+-+the+most+ambitious+badge+creation+tool
- Homepage: https://badgebox.rinbal.de/about
- Try Badge Box: https://badgebox.rinbal.de
- Documentation: https://docs-badgebox.netlify.app
