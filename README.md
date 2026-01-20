# Badge Box

**Create, award, and manage decentralized badges on the Nostr network.**

Badge Box is a web application for badge management using the NIP-58 specification. All badge data lives on Nostr relays - no centralized database required.

---

## What is Badge Box?

Badge Box enables you to:

- **Create custom badges** with names, descriptions, and images
- **Award badges** to any Nostr user by their public key
- **Receive badges** from others and choose which to display
- **View badge profiles** for any Nostr user

All badges are cryptographically signed and stored across decentralized Nostr relays, making them verifiable and censorship-resistant.

---

## Quick Start

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- A Nostr private key (nsec) OR a NIP-07 browser extension (nos2x, Alby, etc.)

### Installation

**1. Clone and install backend:**

```bash
cd backend
pip install -r requirements.txt
pip install -r ../requirements.txt
```

**2. Install frontend:**

```bash
cd frontend
npm install
```

**3. Start both servers:**

Terminal 1 (Backend):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

**4. Open the application:**

Navigate to http://localhost:5173 in your browser.

---

## Authentication Methods

Badge Box supports two ways to authenticate:

### NIP-07 Browser Extension (Recommended)

Install a Nostr browser extension like:
- [nos2x](https://github.com/nickytonline/nos2x) (Chrome)
- [Alby](https://getalby.com/) (Firefox/Chrome)

Your private key stays safely in the extension. Badge Box only requests signatures when needed.

### Private Key (nsec)

Enter your Nostr private key (starts with `nsec1...`) directly. The key is stored only in your browser session and cleared when you close the browser.

---

## How Badges Work

Badge Box implements the NIP-58 badge specification using three Nostr event types:

| Event Kind | Purpose |
|------------|---------|
| 30009 | Badge Definition - defines badge metadata (name, image, description) |
| 8 | Badge Award - records that a badge was awarded to specific users |
| 30008 | Profile Badges - user's list of accepted badges to display |

### Badge Lifecycle

1. **Creator defines a badge** (publishes kind 30009 event)
2. **Creator awards badge to recipients** (publishes kind 8 event)
3. **Recipient sees badge in their inbox** (queries kind 8 events)
4. **Recipient accepts badge** (updates their kind 30008 event)
5. **Badge displays on recipient's profile**

---

## Project Structure

```
Badge_Box/
├── backend/              # FastAPI REST API (Port 8000)
│   ├── app/
│   │   ├── main.py       # Application entry
│   │   ├── routers/      # API endpoints
│   │   ├── services/     # Business logic
│   │   └── models/       # Request/response schemas
│   └── requirements.txt
│
├── frontend/             # Vue.js 3 SPA (Port 5173)
│   ├── src/
│   │   ├── views/        # Page components
│   │   ├── components/   # Reusable UI components
│   │   ├── stores/       # Pinia state management
│   │   ├── composables/  # Event signing logic
│   │   └── api/          # HTTP client
│   └── package.json
│
├── badge_tool/           # CLI badge creation tool
├── badge_inbox/          # CLI inbox tool
├── common/               # Shared Python modules
│
├── README.md             # This file
├── GUIDE.md              # Detailed user guide
└── USE_CASES.md          # Use case examples
```

---

## Technology Stack

**Backend:**
- FastAPI - Python web framework
- Pydantic - Data validation
- websockets - Relay communication
- python-nostr - Nostr protocol implementation

**Frontend:**
- Vue.js 3 - UI framework (Composition API)
- Pinia - State management
- Vue Router - Client-side routing
- Axios - HTTP client
- Vite - Build tool

**Protocol:**
- Nostr - Decentralized event storage
- NIP-58 - Badge specification
- NIP-07 - Browser extension signing

---

## API Reference

### Authentication
```
POST /api/v1/auth/validate    Validate nsec and derive public key
```

### Badge Templates
```
GET  /api/v1/badges/templates/app     List built-in badge templates
GET  /api/v1/badges/templates/user    List user-created templates
POST /api/v1/badges/templates         Create new template
DELETE /api/v1/badges/templates/{id}  Delete template
```

### Badge Operations
```
POST /api/v1/badges/create-definition   Create badge definition
POST /api/v1/badges/award               Award badge to recipients
POST /api/v1/badges/create-and-award    Create and award in one call
GET  /api/v1/badges/owners              List users with a specific badge
```

### Inbox
```
GET  /api/v1/inbox/pending    Get pending badges
GET  /api/v1/inbox/accepted   Get accepted badges
POST /api/v1/inbox/accept     Accept a badge
POST /api/v1/inbox/remove     Remove a badge from profile
```

### Profile
```
GET /api/v1/profile/{pubkey}          Get user profile metadata
GET /api/v1/profile/{pubkey}/badges   Get user's displayed badges
```

API documentation is available at http://localhost:8000/docs when the backend is running.

---

## Security

- **No server-side key storage** - Private keys are never saved to disk
- **Session-only storage** - Keys cleared when browser closes
- **Cryptographic verification** - All events signed and verified by relays
- **NIP-07 isolation** - Extension-based signing keeps keys secure

For production deployments, always use HTTPS.

---

## Configured Relays

Badge Box publishes to multiple relays for redundancy:

- wss://relay.damus.io
- wss://nos.lol
- wss://nostr.wine
- wss://offchain.pub
- wss://relay.snort.social
- wss://relay.primal.net
- wss://relay.nostr.band
- wss://relay.0xchat.com
- wss://relay.azzamo.net
- wss://shu05.shugur.net

Relay configuration is in `badge_tool/config.json`.

---

## Documentation

- **[GUIDE.md](./GUIDE.md)** - Step-by-step user guide for all features
- **[USE_CASES.md](./USE_CASES.md)** - Real-world use case examples

---

## Development

### Running in Development Mode

Backend (with auto-reload):
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Frontend (with hot module replacement):
```bash
cd frontend
npm run dev
```

### Building for Production

```bash
cd frontend
npm run build
```

This creates optimized assets in `frontend/dist/`.

---

## License

MIT

---

## Credits

Built on the Nostr protocol using the NIP-58 Badges specification.
