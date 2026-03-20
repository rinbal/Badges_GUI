# NIP-28 Public Chatroom — Research & Implementation Plan

**Status:** Research complete, ready for implementation

---

## Overview

BadgeBox soll einen öffentlichen Chatroom bekommen — offen für alle, kein Login erforderlich zum Lesen, Login zum Schreiben. Basierend auf NIP-28 (Public Chat Channels) über `nostr-core`.

---

## NIP-28: Public Chat Channels

NIP-28 definiert 5 Event-Kinds für öffentliche Chat-Kanäle:

| Kind | Name | Zweck |
|------|------|-------|
| 40 | Channel Creation | Erstellt einen neuen Kanal mit Metadata |
| 41 | Channel Metadata | Aktualisiert Kanal-Name, Beschreibung, Bild |
| 42 | Channel Message | Nachricht in einem Kanal |
| 43 | Hide Message | Moderator versteckt eine Nachricht |
| 44 | Mute User | Moderator mutet einen User |

### Channel Creation (Kind 40)

```json
{
  "kind": 40,
  "content": "{\"name\":\"BadgeBox Community\",\"about\":\"Public chat for the BadgeBox community\",\"picture\":\"https://badgebox.rinbal.de/BadgeBox_.png\"}",
  "tags": []
}
```

Die Event-ID dieses Events wird zur **Channel-ID** — alle Nachrichten referenzieren sie.

### Channel Message (Kind 42)

```json
{
  "kind": 42,
  "content": "Hello everyone!",
  "tags": [
    ["e", "<channel_id>", "<recommended_relay>", "root"]
  ]
}
```

Für Replies auf andere Nachrichten:

```json
{
  "kind": 42,
  "content": "I agree!",
  "tags": [
    ["e", "<channel_id>", "<recommended_relay>", "root"],
    ["e", "<reply_to_msg_id>", "<recommended_relay>", "reply"]
  ]
}
```

### Moderation

**Hide Message (Kind 43):**
```json
{
  "kind": 43,
  "content": "{\"reason\":\"spam\"}",
  "tags": [["e", "<message_event_id>"]]
}
```

**Mute User (Kind 44):**
```json
{
  "kind": 44,
  "content": "{\"reason\":\"harassment\"}",
  "tags": [["p", "<user_pubkey>"]]
}
```

---

## nostr-core API

Alle Funktionen sind in `nostr-core` verfügbar:

### Channel erstellen

```javascript
import { createChannelEvent, createChannelEventTemplate } from 'nostr-core'

// Mit Secret Key (nsec)
const event = createChannelEvent(
  { name: 'BadgeBox Community', about: 'Public chat', picture: 'https://...' },
  secretKey
)

// Für NIP-07 (unsigned template zum Signieren)
const template = createChannelEventTemplate(
  { name: 'BadgeBox Community', about: 'Public chat', picture: 'https://...' }
)
const signed = await window.nostr.signEvent(template)
```

### Nachricht senden

```javascript
import { createChannelMessageEvent, createChannelMessageEventTemplate } from 'nostr-core'

// Einfache Nachricht
const msg = createChannelMessageEvent(channelId, 'Hello!', secretKey, recommendedRelay)

// Reply auf eine Nachricht
const reply = createChannelMessageEvent(channelId, 'I agree!', secretKey, recommendedRelay, replyToEventId)

// NIP-07 flow
const template = createChannelMessageEventTemplate(channelId, content, recommendedRelay, replyToEventId)
const signed = await window.nostr.signEvent(template)
```

### Nachrichten lesen

```javascript
import { parseChannelMessage } from 'nostr-core'

// Subscribe to channel messages
pool.subscribe(relays, { kinds: [42], '#e': [channelId] }, {
  onevent(event) {
    const { channelId, content, replyTo } = parseChannelMessage(event)
    // Display message
  }
})

// Fetch history
const messages = await pool.querySync(relays, {
  kinds: [42],
  '#e': [channelId],
  limit: 50
})
```

### Moderation

```javascript
import { createChannelHideMessageEventTemplate, createChannelMuteUserEventTemplate } from 'nostr-core'

// Hide a message (admin only)
const hide = createChannelHideMessageEventTemplate(messageEventId, 'spam')

// Mute a user (admin only)
const mute = createChannelMuteUserEventTemplate(userPubkey, 'harassment')
```

### Metadata parsen

```javascript
import { parseChannelMetadata } from 'nostr-core'

const { name, about, picture } = parseChannelMetadata(channelEvent)
```

---

## Implementierungsplan

### Phase 1: Channel erstellen

1. Rinball erstellt den BadgeBox Community Channel (kind 40)
2. Channel-ID wird in `config/chat.js` als `PUBLIC_CHANNEL_ID` gespeichert
3. Channel-Metadata: Name, Beschreibung, BadgeBox-Logo

### Phase 2: Frontend Komponenten

**Neue Dateien:**
- `services/publicChat.js` — NIP-28 Service (nutzt outbox.js)
- `stores/publicChat.js` — Pinia Store
- `views/PublicChatView.vue` — Chatroom UI
- `components/chat/ChatMessage.vue` — Public Chat Nachricht (mit Avatar, Name, Timestamp)

**Route:** `/community` (öffentlich, kein Login zum Lesen)

### Phase 3: Features

| Feature | Priorität | NIP |
|---------|-----------|-----|
| Nachrichten lesen (scroll history) | Must | 28 |
| Nachrichten senden (auth required) | Must | 28 |
| Live-Updates (Subscription) | Must | 28 |
| User-Avatare & Namen (Profiles) | Must | 01 |
| Replies/Threading | Should | 28 + 10 |
| Reaktionen (Emoji) | Nice | 25 |
| Moderation (Hide/Mute) | Should | 28 |
| Badge-gated Moderation | Nice | 58 |

### Phase 4: Outbox Integration

Der Public Chat nutzt die gleiche `outbox.js` Foundation:
- `getPublicChatRelays()` für Relay-Auswahl
- `publishEvent()` für Nachrichten
- `subscribeEvents()` für Live-Updates

---

## Architektur-Entscheidungen

### Warum NIP-28 (nicht NIP-29)?

| Aspekt | NIP-28 | NIP-29 |
|--------|--------|--------|
| Offen/Geschlossen | Offen — jeder kann beitreten | Geschlossen — Membership |
| Relay-Anforderung | Standard-Relays | Spezieller NIP-29 Relay |
| Moderation | Channel-Creator moderiert | Admins mit Permissions |
| Komplexität | Einfach | Komplex |
| nostr-core Support | Vollständig | Vollständig |
| Passt für BadgeBox | Öffentliche Community | Zukünftige geschlossene Gruppen |

**NIP-28 ist die richtige Wahl** für den öffentlichen BadgeBox Chatroom. NIP-29 könnte später für badge-gated private Gruppen genutzt werden.

### Moderation via Badge

Moderatoren könnten per Badge identifiziert werden:
- Badge: `badgebox-moderator` (Rinball vergibt)
- Frontend prüft Badge-Besitz
- Nur Moderatoren sehen Hide/Mute-Buttons

---

## NIPs die wir von nostr-core brauchen

| NIP | Modul | Zweck |
|-----|-------|-------|
| **NIP-28** | `nip28` | Channel erstellen, Nachrichten, Moderation |
| **NIP-10** | `nip10` | Reply-Threading (`parseThread`, `buildThreadTags`) |
| **NIP-25** | `nip25` | Reaktionen auf Nachrichten |
| **NIP-65** | `nip65` | Outbox Model (Relay-Routing) |
| NIP-01 | core | Events, Relays, Subscriptions |
| NIP-19 | `nip19` | Pubkey encoding/decoding |
| NIP-42 | `nip42` | Relay Auth (falls nötig) |
| NIP-50 | `nip50` | Message search (future) |

**Alle sind in `nostr-core` bereits implementiert und verfügbar.**

---

## Beispiel: Kompletter Message Flow

```javascript
import {
  createChannelMessageEventTemplate,
  parseChannelMessage,
  nip10,
  nip25
} from 'nostr-core'
import { getPool, getPublicChatRelays, publishEvent } from '@/services/outbox'

// 1. Send a message
const template = createChannelMessageEventTemplate(channelId, 'Hello BadgeBox!')
const signed = await window.nostr.signEvent(template) // NIP-07
await publishEvent(signed, senderPubkey)

// 2. Subscribe to live messages
const relays = getPublicChatRelays()
const sub = getPool().subscribe(relays, { kinds: [42], '#e': [channelId] }, {
  onevent(event) {
    const msg = parseChannelMessage(event)
    const thread = nip10.parseThread(event)
    // Add to UI
  }
})

// 3. Reply to a message
const replyTemplate = createChannelMessageEventTemplate(
  channelId, 'I agree!', 'wss://relay.damus.io', originalMsgId
)
const signedReply = await window.nostr.signEvent(replyTemplate)
await publishEvent(signedReply, senderPubkey)

// 4. React to a message
const reaction = nip25.createReactionEventTemplate({
  targetEvent: { id: msgId, pubkey: msgAuthor },
  content: '👍'
})
const signedReaction = await window.nostr.signEvent(reaction)
await publishEvent(signedReaction, senderPubkey)
```
