# BadgeBox - Agent-Ready Reference

This document provides everything an AI agent needs to understand, explain, and integrate with BadgeBox.

---

## Overview

**BadgeBox** is a decentralized badge management system built on the [Nostr](https://nostr.com) protocol. It implements the [NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md) badge specification (with extensions for badge requests and denials) to let anyone create, award, receive, and display verifiable digital credentials - without a centralized database or authority.

**Live app:** https://badgebox.rinbal.de
**Docs site:** https://docs-badgebox.netlify.app

---

## Core Concepts

### What Are Nostr Badges?

Badges are cryptographically signed digital credentials stored on decentralized Nostr relays. They are:

- **Verifiable** - Anyone can check who issued a badge and who holds it
- **Censorship-resistant** - No single entity can revoke or suppress badges
- **Self-sovereign** - Recipients choose which badges to display
- **Portable** - Badges work across any Nostr client that supports NIP-58

### Badge Lifecycle

```
1. Creator defines a badge       → publishes kind 30009 (Badge Definition)
2. Creator awards to recipients   → publishes kind 8 (Badge Award)
3. Recipient sees badge in inbox  → queries kind 8 events
4. Recipient accepts badge        → updates kind 30008 (Profile Badges)
5. Badge displays on profile      → visible to anyone querying kind 30008
```

### Optional: Badge Request Flow

```
1. User requests a badge          → publishes kind 30058 (Badge Request)
2. Issuer reviews request         → queries kind 30058 events
3a. Issuer awards badge           → publishes kind 8
3b. Issuer denies request         → publishes kind 30059 (Badge Denial)
4. User can withdraw request      → publishes kind 5 (NIP-09 deletion)
5. Issuer can revoke denial       → publishes kind 5 (NIP-09 deletion)
```

---

## Nostr Event Kinds

| Kind | Name | Type | Purpose |
|------|------|------|---------|
| 30009 | Badge Definition | Addressable | Defines badge metadata (name, image, description) |
| 8 | Badge Award | Regular | Records that a badge was awarded to specific users |
| 30008 | Profile Badges | Addressable | User's ordered list of accepted badges for display |
| 30058 | Badge Request | Addressable | User requests a badge from an issuer (NIP-58 extension) |
| 30059 | Badge Denial | Addressable | Issuer formally denies a badge request (NIP-58 extension) |
| 5 | Deletion | Regular | NIP-09 deletion for withdrawing requests/revoking denials |

### Event Structures

**Badge Definition (kind 30009):**
```json
{
  "kind": 30009,
  "pubkey": "<issuer_hex_pubkey>",
  "tags": [
    ["d", "unique-identifier"],
    ["name", "Display Name"],
    ["description", "What this badge represents"],
    ["image", "https://example.com/badge.png", "1024x1024"],
    ["thumb", "https://example.com/badge-thumb.png", "256x256"]
  ],
  "content": ""
}
```

**Badge Award (kind 8):**
```json
{
  "kind": 8,
  "pubkey": "<issuer_hex_pubkey>",
  "tags": [
    ["a", "30009:<issuer_hex>:<identifier>"],
    ["p", "<recipient_1_hex>"],
    ["p", "<recipient_2_hex>"]
  ],
  "content": ""
}
```

**Profile Badges (kind 30008):**
```json
{
  "kind": 30008,
  "pubkey": "<user_hex_pubkey>",
  "tags": [
    ["d", "profile_badges"],
    ["a", "30009:<issuer_hex>:<identifier>"],
    ["e", "<award_event_id>"],
    ["a", "30009:<other_issuer>:<other_badge>"],
    ["e", "<other_award_event_id>"]
  ],
  "content": ""
}
```

**Badge Request (kind 30058):**
```json
{
  "kind": 30058,
  "pubkey": "<requester_hex_pubkey>",
  "content": "Message to issuer explaining why I deserve this badge",
  "tags": [
    ["d", "30009:<issuer_hex>:<badge_id>"],
    ["a", "30009:<issuer_hex>:<badge_id>"],
    ["p", "<issuer_hex_pubkey>"],
    ["proof", "https://evidence-url.example"]
  ]
}
```

**Badge Denial (kind 30059):**
```json
{
  "kind": 30059,
  "pubkey": "<issuer_hex_pubkey>",
  "content": "Reason for denial",
  "tags": [
    ["d", "<request_event_id>"],
    ["a", "30009:<issuer_hex>:<badge_id>"],
    ["e", "<request_event_id>"],
    ["p", "<requester_hex_pubkey>"]
  ]
}
```

---

## API Reference

**Base URL:** `http://localhost:8000` (local) or production URL

### Authentication

All authenticated endpoints require one of:

| Header | When | Description |
|--------|------|-------------|
| `X-Nsec` | Using private key | nsec1... key; backend signs events |
| `X-Pubkey` | Using NIP-07 extension | Hex pubkey for reads; include `signed_event` object in request body for writes |

**Login/signer methods (client-side):** In addition to nsec and NIP-07, the app supports **NIP-46 remote signers** (Amber, `bunker://` URIs, nsec.app, `nostrconnect://` QR pairing; RPC over kind 24133 with NIP-44 encryption). NIP-46 is a signer that produces the `signed_event` sent to write endpoints - it is not a new auth header.

### Endpoints

#### Auth
```
POST /api/v1/auth/validate
Body: { "nsec": "nsec1..." }
Response: { "npub": "npub1...", "hex": "abc123..." }
```

#### Badge Templates
```
GET  /api/v1/badges/templates/app          # Built-in templates (public)
GET  /api/v1/badges/templates/user         # User templates (auth required)
POST /api/v1/badges/templates              # Create template
POST /api/v1/badges/templates/sync         # Sync templates to Nostr (NIP-78)
DELETE /api/v1/badges/templates/{id}       # Delete template
```

#### Badge Operations
```
POST /api/v1/badges/create-definition
Body: {
  "identifier": "my-badge",        # lowercase, numbers, hyphens; 1-64 chars
  "name": "My Badge",
  "description": "What it represents",
  "image": "https://example.com/badge.png",
  "signed_event": { ... }          # Optional: pre-signed event (NIP-07)
}
Response: {
  "success": true,
  "a_tag": "30009:<pubkey>:my-badge",
  "event_id": "abc123...",
  "verified_relays": 5
}

POST /api/v1/badges/award
Body: {
  "a_tag": "30009:<pubkey>:<identifier>",
  "recipients": ["npub1...", "hex..."],
  "signed_event": { ... }          # Optional
}

POST /api/v1/badges/create-and-award      # Atomic: create definition + award
Body: {
  "identifier": "my-badge",
  "name": "My Badge",
  "description": "...",
  "image": "...",
  "recipients": ["npub1...", "hex..."],
  "signed_event_definition": { ... },
  "signed_event_award": { ... }
}

GET  /api/v1/badges/owners?a_tag=30009:pubkey:id  # List badge holders

POST /api/v1/badges/delete
Body: { "a_tag": "30009:...", "signed_event": { ... } }
```

#### Inbox (Recipient)
```
GET  /api/v1/inbox/pending                 # Badges awarded but not accepted
Response: [{
  "award_event_id": "...",
  "a_tag": "30009:issuer:badge-id",
  "badge_name": "Badge Name",
  "badge_description": "...",
  "badge_image": "https://...",
  "issuer_hex": "...",
  "issuer_npub": "npub1...",
  "issuer_name": "Alice",
  "issuer_picture": "https://..."
}]

GET  /api/v1/inbox/accepted                # Badges on user's profile

POST /api/v1/inbox/accept
Body: {
  "a_tag": "30009:issuer:badge-id",
  "award_event_id": "abc123...",
  "signed_event": { ... }
}

POST /api/v1/inbox/remove
Body: {
  "a_tag": "30009:issuer:badge-id",
  "award_event_id": "abc123...",
  "signed_event": { ... }
}
```

#### Profile & Discovery
```
GET /api/v1/profile/{pubkey}               # Profile metadata (kind 0)
Response: {
  "npub": "npub1...",
  "hex": "...",
  "name": "Alice",
  "display_name": "Alice",
  "picture": "https://...",
  "banner": "https://...",
  "about": "...",
  "nip05": "alice@example.com",
  "lud16": "alice@getalby.com",
  "website": "https://..."
}

GET /api/v1/profile/{pubkey}/badges        # User's displayed badges
GET /api/v1/profile/search?q=alice         # Search profiles (NIP-50)

GET /api/v1/surf/recent?limit=20           # Recent badges
GET /api/v1/surf/popular?limit=20          # Popular badges (by holder count)
GET /api/v1/surf/search?q=bravery          # Search badges
GET /api/v1/surf/issuer/{pubkey}           # All badges by an issuer
GET /api/v1/surf/badge/details?a_tag=...   # Single badge details
GET /api/v1/surf/badge/owners?a_tag=...    # Badge holders with profiles
POST /api/v1/surf/counts                   # Batch holder counts
Body: { "a_tags": ["30009:...", "30009:..."] }
```

#### Badge Requests
```
POST /api/v1/requests/create
Body: {
  "a_tag": "30009:issuer:badge-id",
  "content": "Why I deserve this badge",
  "proofs": [{ "type": "url", "content": "https://evidence.example" }],
  "signed_event": { ... }
}

GET  /api/v1/requests/outgoing?page=1&limit=20   # Requests you sent
GET  /api/v1/requests/incoming?page=1&limit=20   # Requests for your badges
GET  /api/v1/requests/incoming/count              # Count of incoming requests
POST /api/v1/requests/withdraw                     # Withdraw a request
POST /api/v1/requests/deny                         # Deny a request
POST /api/v1/requests/revoke-denial                # Revoke a denial
POST /api/v1/requests/award                        # Award badge from request
```

#### Relays & Health
```
GET /api/v1/relays                         # Configured relay list
GET /health                                # Health check
GET /docs                                  # OpenAPI/Swagger UI
```

---

## Messaging & Social (client-side, no REST API)

These features run entirely in the frontend and talk to Nostr relays directly. They are **not** exposed as BadgeBox REST endpoints - there is no server route for messages.

| Feature | Transport / NIPs | Event kinds |
|---------|------------------|-------------|
| Private encrypted DMs | NIP-17 + NIP-59 gift wrap, NIP-44 encryption (NIP-04 not used) | rumor kind 14 -> seal kind 13 -> gift wrap kind 1059 |
| Feedback & Support chat | NIP-17 (same DM transport) | 14 / 13 / 1059 |
| Community group chat | NIP-29 relay-based groups | 9 (chat), 9005 (delete), 9021 (join), 39000 (metadata), 39001 (admins), 39002 (members) |
| Relay authentication | NIP-42 (for NIP-29 host relay) | 22242 |
| DM notifications | NIP-17 DM sent on badge request / award | 14 / 13 / 1059 |
| Relay management | NIP-65 relay lists, NIP-11 relay info | 10002 (NIP-65) |

- **NIP-29 host relay:** `wss://groups.0xchat.com` (requires NIP-42 auth).
- **Open in Lotus:** community view exposes an "Open in Lotus" deep link so a group can be opened in the Lotus client.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI (Python) |
| Data validation | Pydantic v2 |
| Nostr protocol | python-nostr, websockets |
| Frontend framework | Vue.js 3 (Composition API) |
| State management | Pinia |
| Build tool | Vite |
| Nostr (frontend) | nostr-core (migration from nostr-tools in progress) |
| HTTP client | Axios (frontend), httpx (backend) |
| Media | Blossom protocol (optional) |
| Deployment | Netlify (frontend), Render/Heroku (backend) |

---

## Common Use Cases

| Use Case | Badge Pattern | Example |
|----------|--------------|---------|
| Community recognition | Ongoing award | `community-helper` |
| Event attendance (POAP) | One-time batch award | `nostrcon-2024` |
| Course completion | One-time award | `nostr-dev-101-complete` |
| Professional certification | Annual badge | `certified-dev-2024` |
| Membership/access | Time-limited | `inner-circle-2024` |
| Achievement system | Tiered badges | `first-post`, `hundred-posts` |
| Contributor recognition | Tiered badges | `contributor`, `core-contributor` |
| Identity verification | Level-based | `verified-email`, `verified-id` |

---

## Integration Patterns

### Check if a User Holds a Badge

> **Forward-compat note:** NIP-58 now defines **kind 10008** as the current Profile Badges event; the legacy **kind 30008** (with `d=profile_badges`) is deprecated but treated as equivalent. To be future-proof, query **both** kinds and match the `a` tag. BadgeBox currently writes kind 30008 (see examples above).

```javascript
// Using nostr-core or any Nostr library
async function hasBadge(userHexPubkey, badgeATag) {
  // Query both the current (10008) and legacy (30008) Profile Badges kinds.
  // No '#d' filter: kind 10008 is a plain replaceable event and carries no
  // d tag, while legacy 30008 uses d=profile_badges.
  const filter = {
    kinds: [10008, 30008],
    authors: [userHexPubkey]
  };
  const events = await pool.querySync(relays, filter);
  if (events.length === 0) return false;
  return events.some(ev =>
    ev.tags.some(tag => tag[0] === 'a' && tag[1] === badgeATag)
  );
}

// Example: check membership
const isMember = await hasBadge(userHex, '30009:issuerHex:membership-2024');
```

### Badge-Gated Access

```javascript
async function requireBadge(userPubkey, requiredBadge) {
  const holds = await hasBadge(userPubkey, requiredBadge);
  if (!holds) throw new Error(`User does not hold badge: ${requiredBadge}`);
  return true;
}
```

### Via BadgeBox API

```bash
# Check a user's badges via the API
curl https://badgebox.rinbal.de/api/v1/profile/<pubkey>/badges

# Search for badges
curl https://badgebox.rinbal.de/api/v1/surf/search?q=bravery

# Get badge holders
curl "https://badgebox.rinbal.de/api/v1/surf/badge/owners?a_tag=30009:pubkey:badge-id"
```

---

## Security Model

- **No server-side key storage** - Private keys are never persisted on the backend
- **Session-only storage** - Keys in browser session, cleared on close
- **Cryptographic verification** - All events are signed per Nostr protocol
- **NIP-07 isolation** - Browser extension signing keeps keys secure
- **Decentralized storage** - Events stored across multiple independent relays

---

## Badge Identifier Rules

- Lowercase letters, numbers, and hyphens only
- 1-64 characters
- Must be unique per issuer (same issuer can't have two badges with same identifier)
- Cannot be changed after awarding (creates a new badge)
- Examples: `community-helper`, `nostrcon-2024`, `verified-v1`

---

## Key Nostr Concepts for Agents

- **npub/nsec**: Bech32-encoded public/private keys (human-readable format)
- **hex pubkey**: 64-character hex string (used in events and API)
- **a-tag**: Addressable event reference format: `<kind>:<pubkey>:<d-tag>` (e.g., `30009:abc123:my-badge`)
- **Relay**: WebSocket server that stores and forwards Nostr events
- **NIP-07**: Browser extension standard for signing Nostr events
- **NIP-09**: Event deletion standard (used for withdrawing requests)
- **NIP-11**: Relay information document (relay capabilities/metadata)
- **NIP-17**: Private direct messages (kind 14 rumors, gift-wrapped)
- **NIP-29**: Relay-based groups (community group chat)
- **NIP-42**: Client-to-relay authentication (kind 22242)
- **NIP-44**: Versioned encryption used for DMs and NIP-46 RPC
- **NIP-46**: Remote signing (bunker, nsec.app, nostrconnect)
- **NIP-50**: Full-text search on relays
- **NIP-59**: Gift wrap (kind 1059) that carries sealed NIP-17 messages
- **NIP-65**: User relay list metadata (kind 10002)
- **NIP-78**: Application-specific data (used for template sync)

---

## Configured Relays

Events are published to all relays for redundancy:

- wss://relay.damus.io
- wss://nos.lol
- wss://offchain.pub
- wss://relay.snort.social
- wss://relay.primal.net
- wss://relay.0xchat.com
- wss://relay.azzamo.net
- wss://shu05.shugur.net
- wss://cache1.primal.net

---

## FAQ for Agents

**Q: Can badges be revoked by the issuer?**
A: No. NIP-58 badges are immutable once awarded. For time-limited use cases, include a date in the identifier (e.g., `membership-2024`) and issue new badges each period.

**Q: Can a user hide a badge?**
A: Yes. Users control their kind 30008 Profile Badges event. They can accept or remove badges at any time. Removing a badge hides it from their profile but doesn't delete the award.

**Q: What key format does the API accept?**
A: Both npub (bech32) and hex (64-char) formats. The API converts automatically.

**Q: Is there a rate limit?**
A: The API itself doesn't enforce rate limits, but Nostr relays may reject rapid event submissions.

**Q: Where is badge data stored?**
A: On Nostr relays. BadgeBox has no database - it reads from and writes to relays in real time.

**Q: Can I use BadgeBox without the web app?**
A: Yes. The CLI tools (`badge_tool/` and `badge_inbox/`) can create and manage badges from the command line. You can also interact directly with Nostr relays using any NIP-58-compatible client.

**Q: What is the a-tag format?**
A: `30009:<issuer_hex_pubkey>:<badge_identifier>`. This uniquely identifies a badge across the Nostr network.
