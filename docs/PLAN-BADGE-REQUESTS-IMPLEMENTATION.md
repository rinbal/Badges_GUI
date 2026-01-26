# Badge Requests - Implementation Plan for Badges_GUI

## Overview

Implement NIP-58 Extension (Badge Requests) in Badges_GUI application.

### New Event Kinds

| Kind | Name | Purpose |
|------|------|---------|
| 30058 | Badge Request | User requests a badge |
| 30059 | Badge Denial | Issuer denies a request |

---

## Phase 1: Backend Implementation

### 1.1 New Service: `RequestService`

**File:** `backend/app/services/request_service.py`

```python
class RequestService:
    # Create badge request (kind 30058)
    async def create_request(pubkey, badge_a_tag, content, proofs=[])

    # Withdraw request (kind 30058 with status:withdrawn)
    async def withdraw_request(pubkey, badge_a_tag)

    # Get user's outgoing requests
    async def get_outgoing_requests(pubkey)

    # Get incoming requests for issuer's badges
    async def get_incoming_requests(issuer_pubkey)

    # Create denial (kind 30059)
    async def deny_request(issuer_pubkey, request_event_id, reason)

    # Revoke denial (kind 30059 with status:revoked)
    async def revoke_denial(issuer_pubkey, request_event_id)

    # Check request state (pending/fulfilled/denied/withdrawn)
    async def get_request_state(request_event_id)
```

### 1.2 New Router: `requests.py`

**File:** `backend/app/routers/requests.py`

```python
# Requester endpoints
POST   /api/v1/requests/create          # Create request
POST   /api/v1/requests/withdraw        # Withdraw request
GET    /api/v1/requests/outgoing        # Get my requests

# Issuer endpoints
GET    /api/v1/requests/incoming        # Get requests for my badges
POST   /api/v1/requests/deny            # Deny a request
POST   /api/v1/requests/revoke-denial   # Revoke a denial

# Status endpoint
GET    /api/v1/requests/{id}/state      # Get request state
```

### 1.3 RelayManager Extensions

**File:** `common/relay_manager.py`

Add query support for:
- Kind 30058 (Badge Request)
- Kind 30059 (Badge Denial)

### 1.4 Models

**File:** `backend/app/models/requests.py`

```python
class BadgeRequest:
    event_id: str
    pubkey: str           # requester
    badge_a_tag: str
    issuer_pubkey: str
    content: str
    proofs: List[str]
    created_at: int
    state: str            # pending/fulfilled/denied/withdrawn

class BadgeDenial:
    event_id: str
    pubkey: str           # issuer
    request_event_id: str
    requester_pubkey: str
    badge_a_tag: str
    reason: str
    created_at: int
```

---

## Phase 2: Frontend Implementation

### 2.1 New Store: `requests.js`

**File:** `frontend/src/stores/requests.js`

```javascript
export const useRequestsStore = defineStore('requests', {
  state: () => ({
    outgoingRequests: [],      // requests I sent
    incomingRequests: [],      // requests for my badges
    loading: false,
    error: null
  }),

  actions: {
    // Requester actions
    async createRequest(badgeAtag, content, proofs)
    async withdrawRequest(badgeAtag)
    async fetchOutgoingRequests()

    // Issuer actions
    async fetchIncomingRequests()
    async denyRequest(requestEventId, reason)
    async revokeDenial(requestEventId)
    async awardFromRequest(requestEventId)  // uses existing badge award flow
  }
})
```

### 2.2 New Components

**Request Creation:**
- `RequestBadgeModal.vue` - Modal to compose request with message and proofs

**Outgoing Requests (Requester View):**
- `OutgoingRequestCard.vue` - Shows request with state badge (pending/fulfilled/denied)
- `MyRequestsView.vue` - List of user's outgoing requests

**Incoming Requests (Issuer View):**
- `IncomingRequestCard.vue` - Shows request with Award/Deny buttons
- `RequestInboxTab.vue` - Tab in inbox for incoming requests

**Shared:**
- `RequestStateChip.vue` - State indicator (pending/fulfilled/denied/withdrawn)
- `ProofLink.vue` - Renders proof URL with preview

### 2.3 View Modifications

**InboxView.vue:**
```
┌─────────────────────────────────────────┐
│  [Pending] [Collection] [Requests]      │  ← Add "Requests" tab
├─────────────────────────────────────────┤
│                                         │
│  Incoming badge requests for my badges  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ User X requests "Contributor"   │    │
│  │ "I fixed the login bug"         │    │
│  │ Proof: github.com/...           │    │
│  │                                 │    │
│  │ [View Profile] [Award] [Deny]   │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**ProfileView.vue (viewing others):**
```
┌─────────────────────────────────────────┐
│  Badge: "Early Adopter"                 │
│  Issued by: @conference                 │
│                                         │
│  [Request This Badge]  ← New button     │
└─────────────────────────────────────────┘
```

**New: MyRequestsView.vue:**
```
┌─────────────────────────────────────────┐
│  My Badge Requests                      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ "Contributor" from @project     │    │
│  │ Status: [PENDING]               │    │
│  │                                 │    │
│  │ [Withdraw]                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ "VIP Member" from @club         │    │
│  │ Status: [DENIED]                │    │
│  │ Reason: "Members only"          │    │
│  │                                 │    │
│  │ [Request Again]                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 2.4 Router Addition

**File:** `frontend/src/router/index.js`

```javascript
{
  path: '/my-requests',
  name: 'MyRequests',
  component: () => import('../views/MyRequestsView.vue')
}
```

### 2.5 Navigation Update

Add "My Requests" to navigation menu.

---

## Phase 3: NIP-07 Support

### 3.1 Event Signing

**File:** `frontend/src/utils/nip07.js`

Add signing support for:
- Kind 30058 (Badge Request)
- Kind 30059 (Badge Denial)

Same pattern as existing badge events.

---

## Phase 4: State Logic Implementation

### 4.1 Request State Resolution

```javascript
async function getRequestState(request) {
  // 1. Check for award
  const award = await checkForAward(request.badge_a_tag, request.pubkey)
  if (award) return 'fulfilled'

  // 2. Check for withdrawal
  if (request.status === 'withdrawn') return 'withdrawn'

  // 3. Check for denial
  const denial = await checkForDenial(request.event_id)
  if (denial && denial.status !== 'revoked') return 'denied'

  // 4. Default
  return 'pending'
}
```

---

## Implementation Order

### MVP (Minimum Viable Product)

1. **Backend: RequestService** - create/withdraw requests
2. **Backend: Router endpoints** - REST API
3. **Frontend: requests store** - state management
4. **Frontend: RequestBadgeModal** - create requests
5. **Frontend: MyRequestsView** - view outgoing requests
6. **Frontend: InboxView Requests tab** - view incoming requests
7. **Frontend: Award/Deny actions** - issuer workflow

### Post-MVP

8. State tracking (fulfilled/denied detection)
9. Proof link previews
10. DM notifications (optional)
11. Request filtering for issuers

---

## API Contracts

### Create Request

```
POST /api/v1/requests/create
Content-Type: application/json

{
  "badge_a_tag": "30009:issuer123:contributor",
  "content": "I contributed to the project",
  "proofs": ["https://github.com/org/repo/pull/42"]
}

Response: {
  "event_id": "abc123...",
  "state": "pending"
}
```

### Get Outgoing Requests

```
GET /api/v1/requests/outgoing

Response: {
  "requests": [
    {
      "event_id": "abc123...",
      "badge_a_tag": "30009:issuer:badge",
      "badge_name": "Contributor",
      "issuer_pubkey": "issuer123...",
      "issuer_name": "Project X",
      "content": "My message",
      "proofs": [...],
      "state": "pending",
      "created_at": 1704067200
    }
  ]
}
```

### Get Incoming Requests (Issuer)

```
GET /api/v1/requests/incoming

Response: {
  "requests": [
    {
      "event_id": "abc123...",
      "badge_a_tag": "30009:me:badge",
      "badge_name": "My Badge",
      "requester_pubkey": "user456...",
      "requester_name": "Alice",
      "content": "Please give me badge",
      "proofs": [...],
      "state": "pending",
      "created_at": 1704067200
    }
  ]
}
```

### Deny Request

```
POST /api/v1/requests/deny
Content-Type: application/json

{
  "request_event_id": "abc123...",
  "reason": "Badge requires verified attendance"
}

Response: {
  "denial_event_id": "def456...",
  "success": true
}
```

---

## File Structure Summary

```
backend/
├── app/
│   ├── routers/
│   │   └── requests.py          # NEW
│   ├── services/
│   │   └── request_service.py   # NEW
│   └── models/
│       └── requests.py          # NEW

frontend/
├── src/
│   ├── views/
│   │   └── MyRequestsView.vue   # NEW
│   ├── stores/
│   │   └── requests.js          # NEW
│   ├── components/
│   │   └── requests/            # NEW folder
│   │       ├── RequestBadgeModal.vue
│   │       ├── OutgoingRequestCard.vue
│   │       ├── IncomingRequestCard.vue
│   │       ├── RequestStateChip.vue
│   │       └── ProofLink.vue
│   └── router/
│       └── index.js             # MODIFY
```

---

## Testing Checklist

- [ ] Create request without proof
- [ ] Create request with single proof
- [ ] Create request with multiple proofs
- [ ] Update existing request (same badge)
- [ ] Withdraw request
- [ ] Re-request after withdrawal
- [ ] Issuer views incoming requests
- [ ] Issuer awards from request
- [ ] Issuer denies request
- [ ] Requester sees denial + reason
- [ ] Re-request after denial
- [ ] State shows "fulfilled" after award
- [ ] NIP-07 signing works for all operations
- [ ] nsec signing works for all operations
