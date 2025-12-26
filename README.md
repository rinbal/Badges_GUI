# 🏅 Nostr Badges GUI

A full-stack web application for creating, awarding, and managing badges on the Nostr network using the NIP-58 specification.

## 🎯 Features

- **Badge Creator**: Create custom badges and award them to Nostr users
- **Badge Inbox**: View pending badges, accept or remove them from your profile
- **Profile View**: Display accepted badges publicly
- **No Database**: All data lives on Nostr relays
- **Secure**: Private keys never leave your browser session

## 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│  Vue.js Frontend    │←──→│  FastAPI Backend    │
│  (Port 5173)        │    │  (Port 8000)        │
└─────────────────────┘    └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │ Existing CLI Modules│
                           │ (badge_creator.py,  │
                           │  relay_manager.py)  │
                           └────────┬────────────┘
                                    │
                           ┌────────▼────────────┐
                           │   Nostr Relays      │
                           └─────────────────────┘
```

## 📁 Project Structure

```
nostrbadges_gui/
├── backend/                 # FastAPI REST API
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── config.py        # Configuration
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   └── models/          # Pydantic models
│   └── requirements.txt
│
├── frontend/                # Vue.js 3 SPA
│   ├── src/
│   │   ├── views/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── stores/          # Pinia state management
│   │   ├── api/             # API client
│   │   └── assets/          # CSS & static files
│   └── package.json
│
├── badge_tool/              # Original CLI tools
├── badge_inbox/             # Original inbox CLI
├── common/                  # Shared Python modules
└── requirements.txt         # Original dependencies
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Install Backend Dependencies

```bash
# From project root
cd backend
pip install -r requirements.txt

# Also install base project dependencies
cd ..
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start the Backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at http://localhost:5173

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/validate` - Validate a private key (nsec)

### Badges (Creator)
- `GET /api/v1/badges/templates` - List badge templates
- `POST /api/v1/badges/templates` - Create badge template
- `POST /api/v1/badges/create-definition` - Publish badge definition
- `POST /api/v1/badges/award` - Award badge to recipients
- `POST /api/v1/badges/create-and-award` - Create and award in one call

### Inbox (Receiver)
- `GET /api/v1/inbox/pending` - Get pending badges
- `GET /api/v1/inbox/accepted` - Get accepted badges
- `POST /api/v1/inbox/accept` - Accept a badge
- `POST /api/v1/inbox/remove` - Remove an accepted badge

### Profile
- `GET /api/v1/profile/{pubkey}` - Get profile data
- `GET /api/v1/profile/{pubkey}/badges` - Get profile badges

### Relays
- `GET /api/v1/relays` - Get configured relays

## 🔐 Security

- **Private keys are never stored on the server**
- Keys are stored in browser sessionStorage (cleared when browser closes)
- All signing happens client-side via the API
- HTTPS is recommended for production

## 🎨 Tech Stack

**Backend:**
- FastAPI (Python web framework)
- Pydantic (data validation)
- websockets (Nostr relay connections)
- python-nostr (Nostr protocol)

**Frontend:**
- Vue.js 3 (Composition API)
- Vue Router (routing)
- Pinia (state management)
- Axios (HTTP client)
- Vite (build tool)

## 📋 NIP-58 Event Types

| Kind | Name | Description |
|------|------|-------------|
| 30009 | Badge Definition | Defines a badge (name, image, description) |
| 8 | Badge Award | Awards a badge to recipients |
| 30008 | Profile Badges | User's displayed badges |

## 🛠️ Development

### Backend Development

```bash
cd backend
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Build for Production

```bash
# Frontend
cd frontend
npm run build
```

## 📄 License

MIT

## 🙏 Credits

Built on the Nostr protocol using the NIP-58 Badges specification.

