# Badge Box User Guide

This guide covers everything you need to use Badge Box effectively. Whether you're new to Nostr or an experienced developer, you'll find the information you need here.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Logging In](#logging-in)
3. [Creating Badges](#creating-badges)
4. [Awarding Badges](#awarding-badges)
5. [Managing Your Inbox](#managing-your-inbox)
6. [Viewing Profiles](#viewing-profiles)
7. [Technical Reference](#technical-reference)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### What You Need

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A Nostr identity (public/private key pair)

### Understanding Nostr Keys

Nostr uses cryptographic key pairs for identity:

- **Public Key (npub)**: Your public identifier, like a username. Starts with `npub1...`. Share this freely.
- **Private Key (nsec)**: Your secret key for signing. Starts with `nsec1...`. Never share this.

If you don't have Nostr keys yet, you can generate them using:
- A Nostr client app (Damus, Primal, Amethyst)
- A browser extension (Alby, nos2x)
- Online key generators (use with caution)

---

## Logging In

Badge Box offers two authentication methods:

### Method 1: Browser Extension (Recommended)

This is the safest method. Your private key stays in the extension.

**Step 1**: Install a NIP-07 compatible extension:
- [Alby](https://getalby.com/) - Works on Firefox and Chrome
- [nos2x](https://github.com/nickytonline/nos2x) - Chrome extension

**Step 2**: Set up your Nostr identity in the extension

**Step 3**: On the Badge Box login page, click "Connect with Extension"

**Step 4**: Approve the connection request in your extension

The extension will ask for permission each time Badge Box needs to sign an event.

### Method 2: Private Key (nsec)

Use this if you don't have a browser extension installed.

**Step 1**: On the login page, click "Use Private Key"

**Step 2**: Enter your nsec (starts with `nsec1...`)

**Step 3**: Click "Login"

Your key is stored only in browser session storage and is automatically cleared when you close the browser.

**Security Note**: While convenient, entering your private key directly is less secure than using an extension. Only use this method on trusted devices.

---

## Creating Badges

Badges are digital credentials you create and award to others. Each badge has:

- **Identifier**: A unique lowercase ID (e.g., `early-supporter`)
- **Name**: Display name (e.g., "Early Supporter")
- **Description**: What the badge represents
- **Image**: Visual representation (URL to an image)

### Creating a Badge from a Template

**Step 1**: Navigate to the Creator page

**Step 2**: Browse available templates in the "App Templates" or "My Templates" tabs

**Step 3**: Click on a template to select it

**Step 4**: Review the badge details

**Step 5**: Proceed to award the badge to recipients

### Creating a Custom Badge

**Step 1**: Navigate to the Creator page

**Step 2**: Click "Create New Badge"

**Step 3**: Fill in the badge details:

| Field | Description | Example |
|-------|-------------|---------|
| Identifier | Unique lowercase ID, letters/numbers/hyphens only | `community-helper` |
| Name | Display name | Community Helper |
| Description | What this badge means | Awarded to members who help others in the community |
| Image URL | Link to badge image | `https://example.com/badge.png` |

**Step 4**: Click "Create Badge"

**Step 5**: If using a browser extension, approve the signing request

**Step 6**: Wait for relay confirmation

Your badge definition is now published to Nostr relays and ready to award.

### Saving Badge Templates

To reuse a badge design later:

**Step 1**: After creating a badge, click "Save as Template"

**Step 2**: The template appears in "My Templates" tab

Templates are stored locally and can be deleted anytime.

---

## Awarding Badges

Once you have a badge definition, you can award it to any Nostr user.

### Adding Recipients

**Step 1**: Select a badge to award (from templates or recently created)

**Step 2**: Enter recipient public keys in the recipients field

You can enter keys in two formats:
- **npub format**: `npub1abc123...`
- **Hex format**: `abc123def456...` (64 characters)

**Step 3**: Add multiple recipients by:
- Entering one key per line
- Separating keys with commas
- Pasting a list of keys

### Publishing the Award

**Step 1**: Review the list of recipients

**Step 2**: Click "Award Badge"

**Step 3**: If using a browser extension, approve the signing request

**Step 4**: Wait for relay confirmation

Recipients will see the badge in their inbox the next time they check.

### Awarding Tips

- Double-check recipient keys before awarding
- Badge awards are permanent and cannot be revoked
- Each award creates a public record on Nostr relays
- You can award the same badge to different recipients multiple times

---

## Managing Your Inbox

The Inbox shows badges others have awarded to you.

### Pending Badges Tab

Shows badges you've received but haven't accepted yet.

Each pending badge displays:
- Badge name and image
- Issuer's name and profile picture
- Description
- Award date

**To accept a badge**:
1. Click "Accept" on the badge card
2. Approve the signing request (if using extension)
3. Wait for relay confirmation

**To decline a badge**:
- Simply don't accept it
- Pending badges remain available indefinitely

### My Collection Tab

Shows badges you've accepted. These appear on your public profile.

Each badge displays:
- Badge name and image
- Issuer information
- When you received it

**To remove a badge from your collection**:
1. Click "Remove" on the badge card
2. Approve the signing request
3. The badge returns to your pending list

Removing a badge doesn't delete the award - it just hides it from your public profile.

---

## Viewing Profiles

View any Nostr user's badges by visiting their profile.

### Viewing Your Own Profile

**Step 1**: Click your profile picture in the navigation

**Step 2**: Select "View Profile"

### Viewing Someone Else's Profile

**Step 1**: Navigate to `/profile/{pubkey}` in your browser

Replace `{pubkey}` with either:
- npub format: `/profile/npub1abc123...`
- Hex format: `/profile/abc123def456...`

### Profile Information

Profiles display:
- User's Nostr metadata (name, picture, about)
- List of badges they've accepted
- Each badge's issuer and details

---

## Technical Reference

This section covers details for developers and power users.

### NIP-58 Event Structure

Badge Box implements the NIP-58 specification with three event kinds:

#### Kind 30009: Badge Definition

Published when creating a badge.

```json
{
  "kind": 30009,
  "pubkey": "<issuer_hex>",
  "created_at": 1234567890,
  "tags": [
    ["d", "badge-identifier"],
    ["name", "Badge Name"],
    ["description", "Badge description"],
    ["image", "https://example.com/image.png"],
    ["thumb", "https://example.com/thumb.png"]
  ],
  "content": "",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

The `d` tag creates an addressable event with the a-tag format:
`30009:<issuer_pubkey>:<identifier>`

#### Kind 8: Badge Award

Published when awarding a badge.

```json
{
  "kind": 8,
  "pubkey": "<issuer_hex>",
  "created_at": 1234567890,
  "tags": [
    ["a", "30009:<issuer_hex>:<identifier>"],
    ["p", "<recipient_1_hex>"],
    ["p", "<recipient_2_hex>"]
  ],
  "content": "",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

Each `p` tag identifies a recipient by their hex public key.

#### Kind 30008: Profile Badges

Published when accepting/removing badges.

```json
{
  "kind": 30008,
  "pubkey": "<user_hex>",
  "created_at": 1234567890,
  "tags": [
    ["d", "profile_badges"],
    ["a", "30009:<issuer_hex>:<identifier>"],
    ["e", "<award_event_id>"],
    ["a", "30009:<other_issuer>:<other_badge>"],
    ["e", "<other_award_id>"]
  ],
  "content": "",
  "id": "<event_id>",
  "sig": "<signature>"
}
```

Badge references come in pairs: `a` tag (badge definition) and `e` tag (award event).

### API Authentication

Badge Box API uses header-based authentication:

**For NIP-07 users**:
- Read operations: `X-Pubkey` header with hex public key
- Write operations: Include `signed_event` in request body

**For nsec users**:
- All operations: `X-Nsec` header with nsec value

### Key Conversion

Converting between key formats:

| From | To | Method |
|------|-----|--------|
| npub | hex | Bech32 decode, remove prefix |
| hex | npub | Bech32 encode with "npub" prefix |
| nsec | hex | Bech32 decode, remove prefix |
| hex | nsec | Bech32 encode with "nsec" prefix |

Badge Box handles conversions automatically. The API accepts either format.

### Relay Communication

Badge Box publishes to multiple relays and waits for confirmation:

1. Connect to relay via WebSocket
2. Send EVENT message with signed event
3. Wait for OK response
4. Verify event storage by querying relay

Events are published to all configured relays for redundancy.

### Backend Services

Key backend services and their responsibilities:

**BadgeService** (`backend/app/services/badge_service.py`)
- Template management
- Badge definition creation
- Badge awarding

**InboxService** (`backend/app/services/inbox_service.py`)
- Pending badge queries
- Badge acceptance
- Profile badge management

**KeyService** (`backend/app/services/key_service.py`)
- Key validation
- Format conversion
- Public key derivation

**ProfileService** (`backend/app/services/profile_service.py`)
- Profile metadata fetching
- Badge collection queries

### Frontend Architecture

**Stores** (Pinia):
- `auth.js` - Authentication state, user profile
- `badges.js` - Templates, pending/accepted badges
- `ui.js` - Toasts, loading states

**Composables**:
- `useEventSigning.js` - Event creation and signing logic

**API Client** (`api/client.js`):
- Axios instance with auth interceptors
- Automatic header injection
- Error handling

### Configuration Files

**Relay configuration** (`badge_tool/config.json`):
```json
{
  "relay_urls": ["wss://relay.example.com"],
  "safe_mode": true,
  "log_level": "info"
}
```

**Frontend environment** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:8000
```

---

## Troubleshooting

### Login Issues

**"Extension not found"**
- Ensure your NIP-07 extension is installed and enabled
- Try refreshing the page
- Check if the extension works on other Nostr sites

**"Invalid nsec format"**
- Verify your key starts with `nsec1`
- Check for extra spaces or characters
- Ensure you're using your private key, not public key

### Badge Creation Issues

**"Badge definition failed"**
- Check your internet connection
- Verify the image URL is accessible
- Try using a different image host

**"Identifier already exists"**
- Choose a different badge identifier
- Identifiers must be unique per issuer

### Award Issues

**"Invalid recipient pubkey"**
- Verify the key format (npub or 64-char hex)
- Check for typos or extra characters
- Ensure you're using the recipient's public key

**"Award not published"**
- Check relay connectivity
- Wait a few seconds and retry
- Check if any relays confirmed the event

### Inbox Issues

**"Badges not loading"**
- Verify you're logged in correctly
- Check your internet connection
- Try refreshing the page

**"Accept failed"**
- Approve the signing request in your extension
- Check for relay connectivity issues
- Try accepting again after a few seconds

### General Issues

**Slow loading**
- Relay queries can take a few seconds
- Some relays may be slow or unresponsive
- Wait for the loading indicator to complete

**Events not appearing on other clients**
- Relay propagation takes time
- Different clients may use different relays
- Verify the event was published to shared relays

### Getting Help

If you encounter issues not covered here:

1. Check the browser console for error messages
2. Verify your network connection
3. Try a different browser
4. Report issues at the project repository

---

## Glossary

| Term | Definition |
|------|------------|
| **Badge** | A digital credential published on Nostr |
| **Badge Definition** | The template that defines a badge (kind 30009) |
| **Badge Award** | A record of giving a badge to recipients (kind 8) |
| **Profile Badges** | User's list of accepted badges (kind 30008) |
| **npub** | Public key in bech32 format (starts with npub1) |
| **nsec** | Private key in bech32 format (starts with nsec1) |
| **NIP** | Nostr Implementation Possibility - protocol specifications |
| **NIP-07** | Browser extension signing specification |
| **NIP-58** | Badge specification |
| **Relay** | Server that stores and distributes Nostr events |
| **Event** | A signed data structure on Nostr |
| **Kind** | Event type identifier (number) |
| **a-tag** | Addressable event reference |
| **p-tag** | Public key reference |
| **e-tag** | Event ID reference |
