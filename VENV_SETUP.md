# Virtual Environment Setup Guide

## Single venv for Both Projects ✅

Since both **badge_tool** and **badge_inbox** share code from `common/`, you only need **ONE virtual environment** for both projects.

---

## Setup Instructions

### 1. Create venv in Project Root

```bash
cd /home/adevs/Schreibtisch/nostr/accept_removing_working
python3 -m venv venv
```

This creates: `accept_removing_working/venv/`

### 2. Activate venv

```bash
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### 3. Install Dependencies

```bash
# Make sure you're in the project root
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Verify Installation

```bash
python -c "from nostr.key import PrivateKey; print('✅ nostr library OK')"
python -c "import websockets; print('✅ websockets OK')"
```

---

## Dependencies (from requirements.txt)

Your `requirements.txt` contains:

```
git+https://github.com/jeffthibault/python-nostr.git
websockets>=12.0
wheel
werkzeug
```

**Key dependencies:**
- `python-nostr` - Nostr protocol library (for PrivateKey, Event classes)
- `websockets>=12.0` - WebSocket client for relay connections

---

## Usage

### After venv is set up and activated:

**Project 1 - Badge Tool:**
```bash
cd badge_tool
python badge_tool.py              # Award badges
python accept_badge.py            # Accept a badge
python profile_badges_helper.py   # Helper tool
```

**Project 2 - Badge Inbox:**
```bash
cd badge_inbox
python badge_inbox.py             # Check inbox, accept/remove badges
```

**Important:** Always activate the venv first:
```bash
source venv/bin/activate  # From project root
```

---

## Alternative: Keep Existing venv

If you already have a working venv in `accept_uni/`, you can:

### Option A: Use existing venv (if it's in accept_uni/)
```bash
source accept_uni/venv/bin/activate  # or wherever your old venv is
cd badge_tool
python badge_tool.py
```

### Option B: Move/copy venv to root (recommended)
```bash
# Copy your existing venv to project root
cp -r accept_uni/venv venv

# Activate it
source venv/bin/activate

# Reinstall/reverify dependencies
pip install -r requirements.txt
```

---

## Directory Structure After Setup

```
accept_removing_working/
├── venv/                    # ← Virtual environment (NEW)
├── badge_tool/              # Project 1
├── badge_inbox/             # Project 2
├── common/                  # Shared code
├── requirements.txt         # Dependencies
└── ...
```

---

## Quick Commands Summary

```bash
# Create venv
python3 -m venv venv

# Activate venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Deactivate venv (when done)
deactivate
```

---

## Troubleshooting

### If import errors occur:
1. Make sure venv is activated: `source venv/bin/activate`
2. Verify dependencies: `pip list | grep -E "nostr|websockets"`
3. Reinstall if needed: `pip install -r requirements.txt --force-reinstall`

### If "Module not found" errors:
- Check that you're in the correct directory
- Verify `common/` directory exists with all files
- Ensure venv is activated

---

**Note**: Both projects use the same venv since they share `common/` modules. This is the cleanest approach! ✅

