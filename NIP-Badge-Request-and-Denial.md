# Badge Requests and Denials

*An extension to NIP-58 for requestable badges, with private notifications for issuers.*

> Status: Draft
> Depends on: [NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md), [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md), [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md), [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md)
> Reference PR: [nostr-protocol/nips#2204](https://github.com/nostr-protocol/nips/pull/2204)

---

## What this is

NIP-58 gives us badges: an issuer defines a badge, awards it to someone, and that person can display it on their profile. It is a one-way flow. The issuer decides who gets a badge, and there is no standard way for a user to raise their hand and say *"I earned this, please consider me."*

This extension closes that gap. It adds two new events so that badges can be **requested**, and requests can be **denied** with a reason. Nothing about existing NIP-58 changes ; definition, award and Profile Badges events all work exactly as before. Clients that do not understand the new kinds simply ignore them.

> **Note on the Profile Badges event.** Current NIP-58 uses the replaceable kind `10008` for Profile Badges. The older addressable kind `30008` with `d=profile_badges` is deprecated, and clients should treat those legacy events as equivalent. This extension follows that lead: **write new, read both.** See [Displaying awarded badges](#displaying-awarded-badges-profile-badges) below.

On top of the on-relay events, this document also describes how an issuer is **notified** when a request arrives:

1. A public **Badge Request** event tagged to the issuer, which their client can surface in a dedicated **badge inbox**.
2. An optional **private direct message** to the issuer, sealed with NIP-17 + NIP-59, so the notification also lands in a normal DM client the issuer already checks.

---

## The events at a glance

| Kind    | Name          | Published by | Class       | Purpose                                          |
| ------- | ------------- | ------------ | ----------- | ------------------------------------------------ |
| `30058` | Badge Request | Requester    | Addressable | Ask an issuer to award an existing badge         |
| `30059` | Badge Denial  | Issuer       | Addressable | Formally decline a request, with an optional note |

Both are addressable (parameterized replaceable) events, so a later event with the same `d` tag from the same author supersedes the earlier one. That gives us edit and re-submit semantics for free.

---

## Badge Request (kind `30058`)

Published by the **user** who wants the badge. It points at an existing Badge Definition (kind `30009`) and at the issuer, and it may carry evidence.

### Tags

| Tag     | Required | Value                                                        |
| ------- | -------- | ----------------------------------------------------------- |
| `d`     | yes      | The badge's `a` coordinate, e.g. `30009:alice:bravery`. This makes the request addressable per badge. |
| `a`     | yes      | Reference to the Badge Definition, with an optional relay hint. |
| `p`     | yes      | The issuer's pubkey. This is what lets the issuer's client find requests addressed to them. |
| `proof` | no       | One or more proof tags supporting the request. Each value may be a URL, free text, or a Nostr event id. |

The `content` field is a free-form message from the requester to the issuer.

### Example

Bob asks Alice for her `bravery` badge and links a news article as evidence:

```jsonc
{
  "kind": 30058,
  "pubkey": "bob",
  "content": "I helped rescue the trapped hikers last month!",
  "tags": [
    ["d", "30009:alice:bravery"],
    ["a", "30009:alice:bravery", "wss://relay"],
    ["p", "alice"],
    ["proof", "https://news.example/hiker-rescue-article"]
  ]
  // ...id, sig, created_at
}
```

Because the `d` tag is the badge coordinate, Bob has at most one active request per badge. If he wants to strengthen his case, he republishes kind `30058` with the same `d` and better `proof` tags ; the new event replaces the old one.

---

## Badge Denial (kind `30059`)

Published by the **issuer** to formally decline a specific request. Denials are soft by design: they explain what is missing and leave the door open for a stronger re-submission.

### Tags

| Tag | Required | Value                                                     |
| --- | -------- | -------------------------------------------------------- |
| `d` | yes      | The request event's id. One denial addresses one request. |
| `a` | yes      | Reference to the Badge Definition, with an optional relay hint. |
| `e` | yes      | The request event being denied, with an optional relay hint. |
| `p` | yes      | The requester's pubkey, so the denial reaches their client. |

The `content` field carries the reason, which the requester can act on.

### Example

Alice declines Bob's request and tells him what she needs:

```jsonc
{
  "kind": 30059,
  "pubkey": "alice",
  "content": "Please provide photo evidence or witness confirmation.",
  "tags": [
    ["d", "<bob's request event id>"],
    ["a", "30009:alice:bravery", "wss://relay"],
    ["e", "<bob's request event id>", "wss://relay"],
    ["p", "bob"]
  ]
  // ...id, sig, created_at
}
```

A denial is never final. Bob can submit a fresh request with the missing evidence, which produces a new request event that the old denial no longer refers to.

---

## Request lifecycle

A request that exists on relays resolves to one of **three** states. Clients evaluate them **in priority order** and stop at the first match:

| Priority | State         | Condition                                                     |
| -------- | ------------- | ------------------------------------------------------------- |
| 1        | **Fulfilled** | A Badge Award (kind `8`) exists for this badge and user. The user can then accept it into their Profile Badges (see below). |
| 2        | **Denied**    | A Badge Denial (kind `30059`) exists for this request.        |
| 3        | **Pending**   | A request exists and none of the above apply.                 |

Fulfillment wins over everything. If an issuer awards the badge, that is the answer regardless of any earlier denial.

### Withdrawal and revocation use NIP-09

There is no fourth "withdrawn" state and no status tag. State changes are expressed by deleting the underlying event with standard NIP-09 deletion (kind `5`):

- **Withdraw a request:** the requester deletes their own kind `30058` event. The request no longer exists, so it drops out of the states above entirely.
- **Revoke a denial:** because a Badge Denial is an addressable event, the issuer can delete it (NIP-09) or supersede it, for example after deciding to award the badge after all. A request whose denial is gone falls back to Pending (or Fulfilled, once the award is published).

This keeps state changes in one well-understood mechanism instead of a bespoke lifecycle. The core NIP-58 proposal specifies withdrawal via NIP-09 explicitly; denial revocation follows from the same deletion semantics.

---

## Displaying awarded badges (Profile Badges)

When a request is **Fulfilled**, the issuer has published a Badge Award (kind `8`). For that badge to actually show on the requester's profile, the requester accepts it into their **Profile Badges** event. Current NIP-58 changed which kind carries that list, and this extension aligns with the new standard:

| Kind    | Class       | Status                                                        |
| ------- | ----------- | ------------------------------------------------------------ |
| `10008` | Replaceable | **Current.** The Profile Badges event. Write here.           |
| `30008` | Addressable | **Deprecated** (`d=profile_badges`). Read for compatibility only. |

NIP-58 says clients should treat the legacy `30008` events as equivalent to `10008`. The practical rule, and the one BadgeBox follows, is **write new, read both**:

- **Writing (accepting a badge):** publish the user's Profile Badges only as kind `10008`. Do not create new `30008` events.
- **Reading (rendering a profile):** load the user's Profile Badges from **both** kind `10008` and the legacy kind `30008` with `d=profile_badges`, and treat them as the same list. This keeps badges that older clients wrote still visible.

This only concerns how an awarded badge is displayed. It does not change the request (`30058`) or denial (`30059`) events, which are independent of the Profile Badges kind.

---

## Private notifications for the issuer (NIP-17 + NIP-59)

> **Scope.** This section is an **implementation convention**, not part of the core request/denial events. The NIP-58 proposal does not require a DM; it only recommends that issuer clients provide an inbox. BadgeBox and Lotus layer the DM on top so issuers are notified through a channel they already watch. A client can implement the request/denial spec fully without it.

The public request event is enough for a client to build a badge inbox by subscribing to kind `30058` filtered on `#p = <issuer>`. But an issuer who is not actively watching their inbox can miss it. So BadgeBox additionally sends the issuer a **private direct message** the moment a request is published.

The DM uses standard sealed messaging exactly as defined by NIP-17 and NIP-59:

- **NIP-17** defines the private direct message as a kind `14` chat message (an unsigned rumor), `p`-tagged to the receiver.
- **NIP-59** wraps it in two layers: the rumor is sealed in a kind `13` event (encrypted to the receiver, no `p` tag), and the seal is gift-wrapped in a kind `1059` event that carries the routing tags. Both layers use NIP-44 encryption.

The flow when Bob requests Alice's badge:

1. Bob's client publishes the public Badge Request (kind `30058`) as usual.
2. Bob's client also builds a NIP-17 chat message (kind `14`) to Alice, seals it (kind `13`), and gift-wraps it (kind `1059`) per NIP-59.
3. The gift wrap is published to Alice's DM relays (her NIP-17 inbox relays, per kind `10050`).
4. Alice unwraps it in any NIP-17 capable client and sees a human-readable heads-up (see the message pattern below).

### What the message should contain

The recommended pattern is to mirror the full request in the DM so the issuer can judge it without leaving their messaging client. That means **the request details and the proof, when proof was supplied**. Concretely:

- **Who and what:** the requester (npub or resolved profile name) and the badge being requested (name plus its `a` coordinate).
- **The message:** the request's `content`, if present.
- **The proof:** every `proof` tag, **rendered by type** rather than dumped as raw strings:
  - a URL becomes a clickable link (and, where the client supports previews, a link card),
  - a `nostr:` event id or `nevent`/`note` reference becomes a quoted or linked event,
  - free text is shown as a short quote.
- **An action link:** a deep link back to the request in NostrHub / BadgeBox so Alice can award or deny in one tap.

Because NIP-17 messages are plain text, do the rendering with conventions the receiving client already understands: real URLs (auto-linked), `nostr:` URIs for events and profiles (NIP-21), and simple line breaks. Do not invent custom markup that only your client can read.

A well-formed notification, as delivered by BadgeBox, reads like:

> **New badge request: Bravery**
> From nostr:npub1bob... (Bob)
> Badge: `30009:alice:bravery`
>
> "I helped rescue the trapped hikers last month!"
>
> Proof:
> - https://news.example/hiker-rescue-article
> - nostr:nevent1... (linked witness note)
>
> Review it: https://badgebox.rinbal.de/requests/...

If a request carries **no** proof tags, omit the Proof block entirely rather than showing an empty heading.

The DM is a **notification, not the source of truth**. The authoritative record is always the public kind `30058` event, including its proof tags. If a client only reads the public event, nothing is lost ; the DM just makes sure the issuer hears about it promptly, privately, and with everything needed to decide.

> **Note on privacy:** because the Badge Request itself is a public event, the request is not confidential. The DM does not add secrecy to the request ; it adds reliable, direct delivery to the issuer's regular messaging surface.

---

## Recommendations for clients

**For issuer clients**

- Provide a **badge inbox**: subscribe to kind `30058` with `#p = <issuer pubkey>`, group by badge, and show each request with its message and proof tags.
- Offer one-tap **Award** (publish kind `8`) and **Deny** (publish kind `30059`) actions from the inbox.
- Optionally send the NIP-17 notification described above so requests are not missed.

**For requester clients**

- On any badge the user does not yet hold, show a **"Request Badge"** action that publishes kind `30058`.
- Let users attach one or more proof tags and a short message.
- Surface the resolved state (Pending, Denied, Fulfilled) and, on denial, show the issuer's reason and a **Re-submit** path. A withdrawn request is simply deleted, so it leaves the list.

**For every client**

- **Rate-limit** request submissions per user and per badge to keep issuers from being spammed.
- Treat unknown kinds gracefully. A client that does not implement this extension keeps working with plain NIP-58.

---

## Backward compatibility

This is purely additive. It introduces two new event kinds and reuses NIP-09 for state changes. Existing NIP-58 definition, award and profile events are untouched, and clients that have never heard of `30058` or `30059` simply ignore them. Adopting the extension is opt-in on both the issuer and requester sides.

---

## Summary

| Concern              | Mechanism                                             |
| -------------------- | ----------------------------------------------------- |
| Request a badge      | Kind `30058`, addressable, with `proof` tags          |
| Deny a request       | Kind `30059`, addressable, with a reason              |
| Withdraw / revoke    | NIP-09 deletion (kind `5`), no status tag              |
| Issuer awareness     | Badge inbox on `#p` filter; optional NIP-17 + NIP-59 DM |
| Resolve state        | Fulfilled > Denied > Pending (three states)           |
| Display awarded badge | Profile Badges: write kind `10008`, read `10008` + legacy `30008` |
| Compatibility        | Additive, unknown kinds ignored                       |

---

## Specification and status

This document describes an open, in-progress extension to NIP-58. The canonical proposal, its discussion, and the latest wording live in the Nostr NIPs repository:

- **Open spec (NIP proposal):** [nostr-protocol/nips#2204 - "NIP58 - Badge Event 'Request' and 'Denial'"](https://github.com/nostr-protocol/nips/pull/2204)

The PR is open and awaiting more implementers before merge. Feedback, review and additional implementations are welcome there.

## Implementations

The extension is already implemented and running in production, which is what this proposal needs to move forward:

- **BadgeBox** - [badgebox.rinbal.de](https://badgebox.rinbal.de)
- **Lotus** - [lotus.mybuho.de](https://lotus.mybuho.de)

Both publish and read the request (`30058`) and denial (`30059`) events, surface incoming requests in an issuer inbox, send the NIP-17 + NIP-59 private notification, and follow the "write `10008`, read `10008` + legacy `30008`" rule for Profile Badges.
