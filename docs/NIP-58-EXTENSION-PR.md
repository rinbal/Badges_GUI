# NIP-58 Extension: Badge Requests

`draft` `optional`

This extends [NIP-58](https://github.com/nostr-protocol/nips/blob/master/58.md) with badge requests and denials.

## Motivation

NIP-58 defines badge creation and awarding but provides no mechanism for users to request badges. This extension adds:

- Users can request badges from issuers
- Issuers can formally deny requests
- Users can withdraw requests
- Issuers can revoke denials

## Event Kinds

| Kind | Name | Publisher | Type |
|------|------|-----------|------|
| 30009 | Badge Definition | Issuer | Addressable |
| 8 | Badge Award | Issuer | Regular |
| 30008 | Profile Badges | Recipient | Addressable |
| **30058** | **Badge Request** | **Requester** | **Addressable** |
| **30059** | **Badge Denial** | **Issuer** | **Addressable** |

## Badge Request (kind 30058)

An addressable event where a user requests a badge from an issuer.

```json
{
  "kind": 30058,
  "content": "<message to issuer>",
  "tags": [
    ["d", "30009:<issuer-pubkey>:<badge-d-tag>"],
    ["a", "30009:<issuer-pubkey>:<badge-d-tag>", "<relay-url>"],
    ["p", "<issuer-pubkey>"]
  ]
}
```

- The `d` tag MUST be the badge's `a` tag identifier
- This ensures one active request per badge per user
- Publishing a new request for the same badge updates/replaces the previous one

### Proof Tag

Requesters MAY include evidence to support their request:

```json
["proof", "<url, text, or nostr event id>"]
```

Multiple `proof` tags are allowed. Verification method is left to the issuer.

### Withdrawal

To withdraw a request, publish with `status` tag:

```json
{
  "kind": 30058,
  "content": "",
  "tags": [
    ["d", "30009:<issuer-pubkey>:<badge-d-tag>"],
    ["a", "30009:<issuer-pubkey>:<badge-d-tag>"],
    ["p", "<issuer-pubkey>"],
    ["status", "withdrawn"]
  ]
}
```

Clients MUST ignore requests with `["status", "withdrawn"]`.

## Badge Denial (kind 30059)

An addressable event where an issuer formally denies a badge request.

```json
{
  "kind": 30059,
  "content": "<reason for denial>",
  "tags": [
    ["d", "<request-event-id>"],
    ["a", "30009:<issuer-pubkey>:<badge-d-tag>", "<relay-url>"],
    ["e", "<request-event-id>", "<relay-url>"],
    ["p", "<requester-pubkey>"]
  ]
}
```

- The `d` tag MUST be the request event id
- This ensures one denial per request event

### Soft Denial

Denials are **soft** by design. A denied user CAN submit a new request for the same badge (e.g., with better proof). The new request generates a new event id, making the old denial obsolete.

### Revocation

To revoke a denial, publish with `status` tag:

```json
{
  "kind": 30059,
  "content": "",
  "tags": [
    ["d", "<request-event-id>"],
    ["a", "30009:<issuer-pubkey>:<badge-d-tag>"],
    ["e", "<request-event-id>"],
    ["p", "<requester-pubkey>"],
    ["status", "revoked"]
  ]
}
```

Clients MUST ignore denials with `["status", "revoked"]`.

## Request States

A request can be in one of four states:

| State | Priority | Condition |
|-------|----------|-----------|
| **Fulfilled** | 1 (highest) | Badge Award (kind 8) exists for this badge+user |
| **Denied** | 2 | Badge Denial (kind 30059) exists for this request |
| **Withdrawn** | 3 | Request has `["status", "withdrawn"]` |
| **Pending** | 4 (lowest) | Request exists, none of the above |

### State Resolution

```
1. Check for Badge Award (kind 8) from issuer to requester for this badge
   → If exists: FULFILLED

2. Check request for ["status", "withdrawn"]
   → If exists: WITHDRAWN

3. Check for Badge Denial (kind 30059) referencing this request
   → If exists and not ["status", "revoked"]: DENIED

4. Otherwise: PENDING
```

### Edge Cases

| Scenario | Result |
|----------|--------|
| Award exists + Denial exists | Fulfilled (award takes precedence) |
| Request withdrawn + Denial exists | Withdrawn (denial invalid) |
| User re-requests after denial | New pending request (old denial obsolete) |
| Denial without valid request | Invalid (clients ignore) |

## Querying

**Issuer finds incoming requests:**
```json
{"kinds": [30058], "#p": ["<issuer-pubkey>"]}
```

**User finds own outgoing requests:**
```json
{"kinds": [30058], "authors": ["<user-pubkey>"]}
```

**User finds denials:**
```json
{"kinds": [30059], "#p": ["<user-pubkey>"]}
```

## Protocol Flow

```
USER                                              ISSUER
  │                                                  │
  │         ┌─────────────────────────┐              │
  │         │ Badge Definition        │              │
  │         │ (kind 30009)            │◀─────────────┤
  │         └───────────┬─────────────┘              │
  │                     │                            │
  │              discover                            │
  │                     ▼                            │
  │         ┌─────────────────────────┐              │
  ├────────▶│ Badge Request           │              │
  │         │ (kind 30058)            │─────────────▶│
  │         │ + optional proof        │              │
  │         └───────────┬─────────────┘              │
  │                     │                            │
  │        ┌────────────┤                   ┌────────┴────────┐
  │        │            │                   │     REVIEW      │
  │        ▼            │                   └────────┬────────┘
  │  ┌───────────┐      │              ┌─────────────┼─────────────┐
  │  │ WITHDRAW  │      │              │             │             │
  │  │ status:   │      │              ▼             ▼             ▼
  │  │ withdrawn │      │          APPROVE         DENY         IGNORE
  │  └───────────┘      │              │             │
  │                     │              ▼             ▼
  │                     │         ┌────────┐   ┌──────────┐
  │                     │         │ Award  │   │ Denial   │
  │                     │         │ kind 8 │   │kind 30059│
  │                     │         └───┬────┘   └────┬─────┘
  │                     │             │             │
  │◀──────────────────────────────────┘             │
  │  FULFILLED                                      │
  │                                                 │
  │◀────────────────────────────────────────────────┘
  │  DENIED (can re-request)
  │
  │         ┌─────────────────────────┐
  ├────────▶│ Accept to Profile       │
  │         │ (kind 30008)            │
  │         └─────────────────────────┘
```

## Examples

### Request with Proof

```json
{
  "kind": 30058,
  "pubkey": "a1b2c3...",
  "created_at": 1704067200,
  "content": "I contributed the auth module!",
  "tags": [
    ["d", "30009:x1y2z3:contributor"],
    ["a", "30009:x1y2z3:contributor", "wss://relay.damus.io"],
    ["p", "x1y2z3..."],
    ["proof", "https://github.com/project/repo/pull/42"]
  ]
}
```

### Denial with Reason

```json
{
  "kind": 30059,
  "pubkey": "x1y2z3...",
  "created_at": 1704153600,
  "content": "Please provide ticket confirmation.",
  "tags": [
    ["d", "req123..."],
    ["a", "30009:x1y2z3:attendee"],
    ["e", "req123...", "wss://relay.damus.io"],
    ["p", "a1b2c3..."]
  ]
}
```

## Client Guidelines

### For Requesters

- SHOULD display "Request Badge" on discoverable badges
- SHOULD allow adding message and proof
- SHOULD show request status (pending/fulfilled/denied/withdrawn)
- SHOULD allow withdrawing pending requests

### For Issuers

- SHOULD provide inbox for incoming requests
- SHOULD display proof links prominently
- SHOULD provide Award and Deny actions
- SHOULD NOT auto-award without confirmation
- MAY send DM notification on new requests

### For All Clients

- MUST check state priority (fulfilled > denied > withdrawn > pending)
- MUST ignore requests with `status:withdrawn`
- MUST ignore denials with `status:revoked`

## Backward Compatibility

Fully backward compatible with NIP-58:

- Existing kind 30009, 8, 30008 events unchanged
- Badge award without request still works
- Clients unaware of 30058/30059 simply ignore them

## Security Considerations

- Proof is self-reported; issuers must verify
- Requests are public; users should be aware
- Denial reasons are public; issuers may leave empty
- Clients should rate-limit requests to prevent spam
