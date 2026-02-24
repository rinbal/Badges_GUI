"""
Template Service — NIP-78 (kind 30078) app-specific data for user badge templates.

All user templates are stored in a single replaceable kind 30078 event on Nostr relays,
keyed by d-tag "badgebox-templates". Publishing a new event replaces the old one.

Content format: JSON array of template objects
  [{"identifier": "...", "name": "...", "description": "...", "image": "..."}, ...]

Supports both auth flows:
- NIP-07: Frontend signs the event, backend publishes it.
- nsec:   Backend fetches current list, applies the change, signs, and publishes.
"""

import json
import time
import asyncio
import sys
import websockets
from pathlib import Path
from typing import Dict, List, Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PrivateKey
from nostr.event import Event
from relay_manager import RelayManager
from ..config import settings

KIND_APP_DATA = 30078
TEMPLATES_D_TAG = "badgebox-templates"


class TemplateService:
    """Manages user badge templates as NIP-78 kind 30078 events on Nostr relays."""

    def __init__(self):
        self.relay_urls = settings.relay_urls

    # ── Read ──────────────────────────────────────────────────────────────────

    async def fetch_templates(self, pubkey_hex: str) -> List[Dict[str, Any]]:
        """
        Fetch the user's current template list from Nostr relays.
        Queries for kind 30078 events authored by pubkey_hex with the app d-tag.
        Returns the template list parsed from the latest event's content, or [].
        """
        filter_params = {
            "kinds": [KIND_APP_DATA],
            "authors": [pubkey_hex],
            "#d": [TEMPLATES_D_TAG],
            "limit": 1
        }
        events = await self._query_relays(filter_params)
        if not events:
            return []

        latest = max(events, key=lambda e: e.get("created_at", 0))
        try:
            templates = json.loads(latest.get("content", "[]"))
            return templates if isinstance(templates, list) else []
        except (json.JSONDecodeError, Exception):
            return []

    # ── Write (NIP-07) ────────────────────────────────────────────────────────

    async def publish_signed_event(self, signed_event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Publish a pre-signed kind 30078 event to relays (NIP-07 flow).
        The event was signed by the user's browser extension.
        """
        relay_manager = RelayManager()
        results = await relay_manager.publish_event(signed_event, self.relay_urls)
        published = sum(1 for r in results if r.published or r.verified)
        return {
            "success": published > 0,
            "event_id": signed_event.get("id"),
            "published_relays": published,
            "error": None if published > 0 else "No relay accepted the event"
        }

    # ── Write (nsec) ──────────────────────────────────────────────────────────

    async def sync_templates(
        self,
        nsec: str,
        action: str,
        template: Optional[Dict] = None,
        identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Apply a change to the user's template list and republish (nsec flow).
        Fetches the current list, applies the action, signs a new event, publishes.

        Actions:
          "create"  — append template (replacing any existing entry with same identifier)
          "delete"  — remove entry by identifier
          "update"  — merge template fields into the entry matching identifier
        """
        pubkey_hex = PrivateKey.from_nsec(nsec).public_key.hex()
        current = await self.fetch_templates(pubkey_hex)

        if action == "create":
            if not template:
                return {"success": False, "error": "Template data required"}
            # Remove any duplicate identifier before appending
            current = [t for t in current if t.get("identifier") != template["identifier"]]
            current.append(template)

        elif action == "delete":
            if not identifier:
                return {"success": False, "error": "Identifier required"}
            current = [t for t in current if t.get("identifier") != identifier]

        elif action == "update":
            if not identifier or not template:
                return {"success": False, "error": "Identifier and template data required"}
            current = [
                {**t, **template} if t.get("identifier") == identifier else t
                for t in current
            ]

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

        signed = self._sign_event(current, nsec)
        return await self.publish_signed_event(signed)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _sign_event(self, templates: List[Dict], nsec: str) -> Dict[str, Any]:
        """Create and sign a kind 30078 event containing the given template list."""
        pk = PrivateKey.from_nsec(nsec)
        ev = Event(
            public_key=pk.public_key.hex(),
            content=json.dumps(templates),
            created_at=int(time.time()),
            kind=KIND_APP_DATA,
            tags=[["d", TEMPLATES_D_TAG]]
        )
        pk.sign_event(ev)
        sig = getattr(ev, "signature", None) or getattr(ev, "sig", None)
        return {
            "id": ev.id,
            "pubkey": pk.public_key.hex(),
            "created_at": int(ev.created_at),
            "kind": ev.kind,
            "tags": ev.tags,
            "content": ev.content,
            "sig": sig
        }

    async def _query_relays(self, filter_params: Dict) -> List[Dict]:
        """Query all configured relays in parallel and return deduplicated events."""
        tasks = [self._query_relay(url, filter_params) for url in self.relay_urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        seen_ids: set = set()
        events = []
        for result in results:
            if isinstance(result, list):
                for event in result:
                    eid = event.get("id")
                    if eid and eid not in seen_ids:
                        seen_ids.add(eid)
                        events.append(event)
        return events

    async def _query_relay(self, relay_url: str, filter_params: Dict) -> List[Dict]:
        """Query a single relay and return matching events."""
        results = []
        req_id = f"tmpl:{int(time.time() * 1000) % 100000}"
        try:
            async with websockets.connect(relay_url, open_timeout=5) as ws:
                await ws.send(json.dumps(["REQ", req_id, filter_params]))
                start = asyncio.get_event_loop().time()
                while asyncio.get_event_loop().time() - start < 7:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2.5)
                    except asyncio.TimeoutError:
                        break
                    try:
                        data = json.loads(msg)
                    except Exception:
                        continue
                    if not isinstance(data, list):
                        continue
                    if data[0] == "EVENT" and len(data) >= 3 and data[1] == req_id:
                        results.append(data[2])
                    if data[0] == "EOSE" and len(data) >= 2 and data[1] == req_id:
                        break
        except Exception as e:
            print(f"Template relay query error ({relay_url}): {e}")
        return results
