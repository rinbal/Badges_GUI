# BadgeBox Chat Migration Plan: NIP-29 Groups + Gift-Wrapped DMs

Status: proposed. Built from code research of the current `chat_fix` branch, the
`nostr-core@1.0.2` package API, and the `nostr_google` reference apps (`src/apps/chat`,
`src/apps/groups`). No em dashes used anywhere in this project's text or frontend.

## Goal

1. Upgrade `nostr-core` to the latest npm release (1.0.2).
2. Remove NIP-28 public chat entirely. NIP-29 group chat only.
3. Rewrite DMs to NIP-17 + NIP-59 gift wrap + NIP-44 only. Delete all NIP-04.
4. Add a NIP-29 group chat for the BadgeBox group (relay link delivered by user).
5. DM notifications when a user receives a badge or a request (client-side send).
6. Add a NIP-46 bunker / nostr-connect URI paste field for login.
7. Organized relay management (general / group / DM sets).
8. Event dedup everywhere. Do not spam the signer.
9. Remove dead code left behind.
10. Public group is readable while logged out (anonymous read-only view).
11. Subtle "Powered by Lotus" footer on both the group chat and the DM chat,
    positioning this text-only chat as the light option and Lotus as the full solution.

## Product principles (apply to every UI phase)

- **Built for everyday users, not nostr experts.** No jargon in the UI: say "group chat",
  "message", "sign in", not "kind 9", "relay", "gift wrap", "npub". Keep protocol words in
  code and comments only.
- **Research-backed, not over-built.** Follow the conventions people already know from
  WhatsApp / Signal / Telegram: a single scrolling message list, newest at the bottom,
  own messages right-aligned, a fixed composer at the bottom, avatar + name + relative
  time per message. No feature the text-only scope does not need.
- **Clean, maintainable tree.** No dead files or commented-out blocks left behind, no
  unused imports, no half-migrated paths. One clear owner per concern (transport in
  services, state in stores, presentation in components). A new dev should be able to read
  a file name and know what it does. Every phase ends with the tree in a shippable state.
- **Graceful states everywhere.** Loading, empty ("No messages yet"), and error states are
  designed, not left blank. Logged-out users get a clear, friendly path to participate.

## Open inputs still needed from user

- The NIP-29 group relay link and group id (format `wss://relay.host'groupid` or
  `?relay=...&group=...`). Everything group-side is pinned to that one relay.
- Confirmation of which signer they log in with day to day (Amber / NIP-07 / nsec),
  so the NIP-46 path can be tested against the real signer early (see risk R1).

---

## Research findings that drive the design

- **Package**: current `nostr-core 0.7.0`, latest `1.0.2`. Reference app runs `1.0.0`.
  All symbols the surviving code imports exist in 1.0.2 (`RelayPool`, `normalizeURL`,
  `fetchRelayInfo`, `Nip07Signer`, `createSecretKeySigner`, `parseConnectionURI`,
  `NostrConnect`, `nip17`, `nip29`, `nip44`, `nip59`, `nip65`). `RelayPool` method
  signatures (`subscribe`/`publish`/`querySync`/`close`/`listConnectionStatus`) are
  unchanged from what `outbox.js` already calls, so the transport layer upgrades cleanly.
- **Gift wrap must be signer-based**, not secret-key-based. nostr-core's convenience
  fns (`nip17.wrapDirectMessage`, `nip59.createSeal`) take a raw `Uint8Array` secret key,
  which only exists for nsec logins. The reference app builds the seal and wrap from the
  `Signer` interface (`signer.nip44.encrypt` + `signer.signEvent`) plus a fresh ephemeral
  key per wrap, so it works for nsec, NIP-07, Amber, and NIP-46 alike. We follow that.
- **NIP-29 traffic is pinned to a single host relay** (`{ relays: [ref.relay] }` on every
  sub/query/publish). The 39xxx state events (metadata/admins/members/roles) are signed by
  the relay, so the client resolves the relay's signing pubkey via NIP-11 and only ever
  parses them, never signs them.
- **nostr-core `nip29` is minimal**: it gives `createGroupChatTemplate`,
  `createGroupAdminTemplate`, `parseGroupMetadata/Members/Admins`. Join requests (9021),
  leave (9022), roles (39003), and thread kinds are built inline (small tag templates),
  matching how the reference app extended its own nip29 layer.
- **NIP-46**: the reference app deliberately hand-rolls its NIP-46 client over NIP-44
  (kind 24133) and notes nostr-core's client "still uses legacy NIP-04 and stalls against
  Amber." That comment is against nostr-core 1.0.0. See risk R1 for how we handle this.
- **Dedup is by event id at every layer** because supervised subscriptions replay the
  full filter on reconnect (gift-wrap timestamps are randomized, so no `since` cursor is
  usable). Signer-spam is avoided by TTL-memoizing and single-flighting network reads,
  not by batching signatures.

---

## Phase 0 - Package upgrade and baseline

1. `frontend/package.json`: bump `nostr-core` `^0.7.0` -> `^1.0.2`. Reinstall, commit lockfile.
2. Smoke-test the app still builds and existing nostr-core call sites compile
   (`outbox.js`, `signer.js`, `relays.js`, `nostrChat.js`). Fix any 1.0 API drift.
3. Keep `nostr-tools` installed for now (legacy auth still uses it). Its removal is the
   last step, after NIP-46 is migrated to nostr-core.

Deliverable: app builds green on 1.0.2 with no behavior change yet.

## Phase 1 - Remove NIP-28 public chat

Delete entirely:
- `frontend/src/services/publicChat.js`
- `frontend/src/stores/publicChat.js`
- `frontend/src/views/CommunityView.vue` (orphaned, no route)
- `frontend/src/components/chat/CommunityPanel.vue`
- `frontend/src/components/chat/ChannelMessage.vue`
- `frontend/src/components/chat/LiveChatEmbed.vue`
- `frontend/src/views/ChatView.vue` (dead: no route, imported nowhere - confirm then delete)

Edit to remove references:
- `App.vue`: CommunityPanel markup (33-34) + import (46).
- `stores/ui.js`: `isCommunityOpen` + open/close/exports (258-269, 294-300, 371, 378-379).
- `components/common/ProfileDropdown.vue`: Community button (119-121) + handler (191-192).
- `components/common/AppHeader.vue`: dead `/community` CSS (208).
- `views/HomeView.vue`: community card (206-213), community section + LiveChatEmbed
  (385-398), import (428), CSS (959, 1474-1513).
- `services/outbox.js`: `PUBLIC_CHAT_RELAYS` (42-51) and `getPublicChatRelays()` (203-208)
  are replaced by the group-relay accessor in Phase 4, not just deleted.
- `config/chat.js`: `MODERATOR_BADGE_ATAG` (9-10), `PUBLIC_CHANNEL_ID` (12-15).
- `utils/chatFormat.js`: cosmetic comment (6). File stays.

Deliverable: no NIP-28 kinds (40/41/42/43/44) anywhere; app builds; DMs and admin chat
still work.

## Phase 2 - DMs: NIP-17/59/44 only, delete NIP-04

Rewrite in `frontend/src/services/nostrChat.js`:
- Delete `sendNip04` (110-132) and its kind-4 encrypt path.
- `sendDirectMessage` (45-64): call the NIP-17 path only; if `!signerHasNip44`, throw a
  clear error (no fallback).
- `fetchDirectMessages` (138-221): delete kind-4 queries and both NIP-04 decrypt blocks
  (150-155, 170-192). Keep the NIP-17 blocks.
- `fetchAllConversations` (229-325): delete kind-4 query + NIP-04 decrypt (241-244,
  259-288). Keep the NIP-17 block.

Harden the gift-wrap path to match the reference (`giftwrap.ts`, `nip17.ts`):
- Send pipeline per message:
  - `rumor` = unsigned kind 14, `getEventHash` gives a stable rumor id.
  - `seal` = kind 13, content `signer.nip44.encrypt(recipient, JSON.stringify(rumor))`,
    `signer.signEvent(...)`, `created_at` randomized up to 2 days back.
  - `wrap` = kind 1059 signed by a fresh ephemeral key
    (`createSecretKeySigner(generateSecretKey())`), content
    `ephemeral.nip44.encrypt(recipient, JSON.stringify(seal))`, `p` tag to recipient,
    randomized `created_at`.
  - Wrap once for the recipient and once for self, publish both (so the sender sees own
    sent messages on other devices).
- Receive pipeline (`unwrapGiftWrap`, 333-345): `signer.nip44.decrypt` the wrap, parse
  seal, `verifyEvent(seal)` and require `seal.kind === 13`, `signer.nip44.decrypt` the
  seal, parse rumor, reject unless `rumor.pubkey === seal.pubkey` and recomputed
  `getEventHash(rumor)` matches its id. Return `null` on any failure.
- Inbox: single shared subscription `{ kinds: [1059], '#p': [myPubkey] }`, subscribe
  first then backfill `querySync(..., { limit: 1000 })` to avoid a gap. Decrypt each wrap
  exactly once and dispatch by rumor kind.

Trim `frontend/src/services/signer.js`:
- Delete `signerHasNip04` (127-137) and the bunker `nip04` wrapper (87-94) if the NIP-46
  path is nip44-only.
- Simplify `getBestEncryption` (139-147) to return `'nip44'` or `null`; delete the
  `'nip04'` branch. Keep `signerHasNip44` (113-124).

Doc-only edits: `stores/chat.js` (2, 23, 79 - drop "NIP-04" text and the
`getBestEncryption` import if unused), `stores/messages.js` (2).

DM relay routing (correctness improvement over current code):
- Read inbox from the user's own relays (union with any interop inbox relay set).
- Send by resolving the recipient's kind-10050 (`DM_RELAYS` per NIP-17), cached per
  pubkey, with `DM_RELAYS` fallback. This replaces broadcasting to a static list.

Deliverable: DMs are gift-wrapped only; no kind-4 anywhere; works across nsec / NIP-07 /
Amber / NIP-46 signers.

## Phase 3 - NIP-46 bunker / nostr-connect paste field

- New service `frontend/src/services/nip46.js` (nostr-core only). Primary implementation:
  `parseConnectionURI(uri)` + `new NostrConnect(uri)` + `.connect()` returns a `Signer`
  with `nip44`, which drops into the existing signer abstraction and the gift-wrap path.
- `LoginView.vue`: add a "Paste bunker or nostr-connect URI" input beside the Amber
  section, plus a `connectWithBunkerUri(uri)` auth action. Accept both `bunker://`
  (signer-initiated) and `nostrconnect://` (already generated by the current Amber flow).
- Persist only `{ clientSecretKeyHex, remotePubkey, relays }` in localStorage (never the
  user key), and rebuild the session on reload, mirroring the existing `amberSession`
  persistence in `stores/auth.js` (202-263).
- Migrate the existing Amber flow off `nostr-tools/nip46` onto this nostr-core service so
  all NIP-46 code is nostr-core, then drop the `nostr-tools` imports in `stores/auth.js`
  (19-21), `signer.js` (39-41, 77-105), `LoginView.vue` (273-274).

Risk R1 (see below) governs whether nostr-core `NostrConnect` is sufficient or we port
the reference's hand-rolled client.

Deliverable: user can paste a connection URI and log in; all NIP-46 is nostr-core.

## Phase 4 - NIP-29 group chat

New files, cloned in shape from the reference `groups.ts` / `nip29.ts` and the existing
NIP-28 store structure (which we are deleting but whose join/send/subscribe shape is a
good template):

- `frontend/src/config/groups.js`: the BadgeBox `GroupRef = { relay, id }` from the user's
  link, plus `parseGroupAddress` / `groupAddress` helpers (`host'id`).
- `frontend/src/services/groupChat.js` (transport, reuses `outbox.js` pool):
  - `subscribeGroupFeed(ref, onEvent)`: `subscribe({ kinds: FEED_KINDS, '#h': [ref.id],
    limit: 500 }, { relays: [ref.relay] })`. `FEED_KINDS` = 9 (chat), 10/11/12/1111
    (threads/comments), 7 (reactions), 9000/9001/9005/9009/9021/9022 (moderation).
  - `subscribeGroupState(ref)`: resolve the relay signing pubkey via NIP-11 (TTL-cached
    5 min), then `subscribe({ kinds: [39000,39001,39002,39003], authors: [relayPubkey],
    '#d': [ref.id] })`. Parse only.
  - `subscribeOwnMembership(ref, myPubkey)`: `{ kinds: [9000,9001], '#h': [ref.id],
    '#p': [myPubkey], limit: 1 }`, kept alive even if feed reads are refused.
  - `sendGroupMessage(ref, content, replyTo?)`: `createGroupChatTemplate(ref.id, content,
    replyTo)` (nostr-core) -> `signer.signEvent` -> `pool.publish([ref.relay], event)`;
    throw if the relay does not accept (single host = no partial success).
  - `joinGroup(ref, code?)`: inline kind-9021 template (`content "/join"`, optional `code`
    tag) -> sign -> publish; on rejection, re-read by id to confirm the relay stored it
    for admin review. `leaveGroup` = kind 9022.
  - Admin actions via `createGroupAdminTemplate` (add/remove user, edit metadata, delete
    event, permissions) for the BadgeBox admin.
  - `loadOlder(ref, until)`: `until`-paged one-shot `querySync` for backscroll.
- `frontend/src/stores/groups.js` (Pinia orchestration):
  - `seen = Map<groupId, Set<eventId>>`; `ingest()` drops any event whose id is already in
    the set (dedup by id, mandatory - subscriptions replay on reconnect).
  - Timeline sorted by `created_at` with a same-second id tie-break.
  - Optimistic send, profile batch-fetch (debounced), unread cursor persisted per group.
  - Single-flight + TTL-memoize metadata and relay-identity reads (45s / 5min) so
    reconnects do not re-hit the signer or the relay repeatedly.
- UI: reuse `components/chat/MessageBubble.vue` and `MessageInput.vue` as-is. New
  `views/GroupView.vue` (or a panel) wired into `router/index.js` and the nav where the
  removed Community entry was. Reply uses a bare `q` tag per NIP-29 interop.

Anonymous read-only view (logged-out state):
- Reading a NIP-29 group needs no signer, so the feed/state/profile subscriptions run for
  anonymous visitors as long as the host relay allows unauthenticated reads (many public
  groups do; some are AUTH-gated - degrade gracefully per risk R2). The group store and
  `subscribeGroupFeed`/`subscribeGroupState` must not assume a logged-in user.
- The route/panel is reachable without auth. Messages, names, and avatars render normally.
- The composer is replaced for anonymous users by a single friendly call to action, for
  example "Sign in to join the conversation", opening the existing login. No protocol
  wording. Sending, joining, and reactions require login.
- If the relay refuses unauthenticated reads, show a calm empty state that invites sign-in
  rather than an error.

Deliverable: BadgeBox group chat reads, sends, joins, and moderates against the single
host relay, deduped, without signer spam, and is readable while logged out.

## Phase 4b - "Powered by Lotus" footer

A small, subtle, reusable footer that frames this chat as the light text-only option and
points power users to the full product.

- New `frontend/src/components/chat/LotusFooter.vue`: logo
  (`/Lotus/app-logo.png`, served from `frontend/public/Lotus/`) + one line such as
  "Text-only chat. For voice, video, files and more, try Lotus." linking to
  `https://lotus.mybuho.de` (new tab, `rel="noopener noreferrer"`).
- Placement: rendered once at the bottom of the group chat view and once in the DM chat
  view (`DmsPanel.vue` / `MessagesView.vue`). Muted styling, small type, does not compete
  with the message list; visible but unobtrusive on both light and dark themes.
- Single component reused in both places (no duplication), so there is one place to edit
  copy, link, or logo.

Deliverable: one shared, tasteful Lotus attribution present on group chat and DM chat.

## Phase 5 - Badge / request DM notifications (client-side)

Reuse the gift-wrapped `sendDM(recipientPubkey, text)` from the rewritten DM layer. Hook
points (all have the target pubkey in scope):
- `stores/badges.js` `createAndAwardBadge` (277-306): DM each recipient after success.
- `stores/requests.js` `awardFromRequest` (341-374): DM the requester after success.
- `stores/requests.js` `createRequest` (197-231): DM the issuer (pubkey parsed from the
  badge `aTag`) after success.

Accepted limitation (decided): client-side only. For nsec issuers whose award events are
signed on the backend, the notification may not fire if no browser signer is active. A
backend DM sender can be added later if this matters.

Deliverable: recipients get a gift-wrapped DM on award/request, sent by the acting user's
signer.

## Phase 6 - Relay management reorg

Organize into three clearly labelled sets, all served by the one shared `RelayPool`:
- General / account relays: the user's editable NIP-65 list in `stores/relays.js`
  (persisted `badgebox_relays`), used for account data and outbox routing.
- Group relay: the pinned NIP-29 host relay from `config/groups.js`. Never mixed into the
  general pool for group traffic.
- DM relays: `DM_RELAYS` fallback plus per-recipient kind-10050 routing (Phase 2).

- `services/outbox.js`: remove `PUBLIC_CHAT_RELAYS` / `getPublicChatRelays`, add
  `getGroupRelays()` returning `[ref.relay]`, keep `DM_RELAYS` and NIP-65 helpers.
- `components/common/RelayManager.vue`: present the sets as labelled categories (general
  editable; group and DM shown with their purpose) so it is clear which relay does what.
- Keep NIP-46 handshake relays as a separate concern owned by the NIP-46 service.

Deliverable: one pool, three purposes, visible and organized in the UI.

## Phase 7 - Cross-cutting discipline and cleanup

- Dedup: every subscription consumer dedups by event id (DMs by rumor id, groups by event
  id). No `since` cursor on gift-wrap subs; re-issue the full filter on reconnect.
- Signer hygiene: single-flight and TTL-cache all network reads (metadata, relay identity,
  recipient 10050, profiles). Sign only on explicit user action. Never loop a signer call
  inside a subscription handler.
- Remove now-dead code surfaced during the phases (unused imports, `getBestEncryption`
  if fully unused, orphaned views).
- Lint pass: no em dash (` - `, ` ; `, or rewrite) in any frontend string or comment.
- Drop `nostr-tools` from `package.json` once Phase 3 lands and no imports remain.

## Risks and how we handle them

- **R1 NIP-46 against Amber**: the reference app found nostr-core's NIP-46 client used
  NIP-04 and stalled with Amber (on 1.0.0). Plan: implement Phase 3 with nostr-core
  `NostrConnect` first (satisfies the nostr-core-only rule) and test against the user's
  real signer immediately. If it stalls, port the reference's hand-rolled kind-24133
  client, which still uses nostr-core `nip44` primitives (so the crypto stays nostr-core).
  Decide by test, not assumption.
- **R2 Relay refuses group reads (AUTH-gated)**: keep the own-membership subscription
  alive independently so a later kind-9000 admission unlocks the feed; distinguish a real
  read-refusal from a transient socket drop on `onClosed`.
- **R3 0.7 -> 1.0 API drift**: low, verified the imported symbols and `RelayPool` methods
  are unchanged, but Phase 0 gates everything on a green build before feature work.
- **R4 Strict NIP-17 relay routing**: current code broadcasts DMs; we add recipient
  kind-10050 routing for correctness, with the static `DM_RELAYS` as fallback.

## Suggested sequencing

Phase 0 (upgrade, gate) -> Phase 1 (remove NIP-28) -> Phase 2 (DM rewrite) ->
Phase 3 (NIP-46 paste, test R1 early) -> Phase 4 (NIP-29 group + anonymous read, needs the
relay link) -> Phase 4b (Lotus footer) -> Phase 5 (notifications) -> Phase 6 (relay reorg)
-> Phase 7 (cleanup + lint).

Phases 1-3 do not need the group relay link and can start immediately. Phases 4 and 4b are
gated on that link. Phase 4b (Lotus footer on the DM chat) can also land earlier with
Phase 2 if we want the DM side attributed first.
