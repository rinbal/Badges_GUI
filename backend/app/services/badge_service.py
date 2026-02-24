"""
Badge Service - Handles badge creation, awarding, and deletion
Wraps existing badge_creator.py functionality
"""

import json
import asyncio
import time
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import websockets

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "badge_tool"))

from badge_creator import BadgeCreator, normalize_pubkey
from relay_manager import RelayManager
from ..config import settings


class BadgeService:
    """Service for badge operations (creator side)"""

    # Characters allowed in badge identifiers (lowercase alphanumeric and hyphens)
    IDENTIFIER_PATTERN = r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'

    def __init__(self, issuer_nsec: str):
        """Initialize with issuer's private key"""
        self.badge_creator = BadgeCreator(issuer_nsec)
        # Use all relays from config.json
        self.relay_urls = settings.relay_urls

    @staticmethod
    def validate_identifier(identifier: str) -> Tuple[bool, Optional[str]]:
        """
        Validate badge identifier for safety and format.
        Returns (is_valid, error_message).
        """
        import re

        if not identifier:
            return False, "Identifier is required"

        if len(identifier) > 64:
            return False, "Identifier must be 64 characters or less"

        # Block path traversal attempts
        if '..' in identifier or '/' in identifier or '\\' in identifier:
            return False, "Identifier contains invalid characters"

        # Must match pattern: lowercase alphanumeric and hyphens
        if not re.match(BadgeService.IDENTIFIER_PATTERN, identifier):
            return False, "Identifier must be lowercase letters, numbers, and hyphens only"

        return True, None

    def get_issuer_info(self) -> Dict[str, str]:
        """Get issuer public key info"""
        return self.badge_creator.get_issuer_info()
    
    @staticmethod
    def _load_templates_from_dir(directory: Path) -> List[Dict[str, Any]]:
        """Load badge templates from a directory of JSON files"""
        templates = []

        if not directory.exists():
            return templates

        for file in directory.glob("*.json"):
            try:
                with open(file, "r") as f:
                    data = json.load(f)

                # Extract info from tags
                tags = data.get("tags", [])
                identifier = next((tag[1] for tag in tags if tag[0] == "d"), file.stem)
                name = next((tag[1] for tag in tags if tag[0] == "name"), identifier)
                description = next((tag[1] for tag in tags if tag[0] == "description"), "")
                image = next((tag[1] for tag in tags if tag[0] == "image"), "")

                templates.append({
                    "identifier": identifier,
                    "name": name,
                    "description": description,
                    "image": image
                })
            except Exception as e:
                print(f"Error loading template {file}: {e}")

        return templates

    @staticmethod
    def get_app_templates() -> List[Dict[str, Any]]:
        """
        Load app-provided badge templates (read-only).
        These come from badge_tool/badges/definitions/
        """
        return BadgeService._load_templates_from_dir(settings.app_templates_path)

    async def publish_signed_event(self, signed_event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Publish a pre-signed event (from NIP-07) to relays.
        No signing needed - just validate and publish.
        """
        try:
            print(f"  → Publishing pre-signed event (kind {signed_event.get('kind')}) to {len(self.relay_urls)} relays")

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)
            relay_manager.print_summary()

            published_count = sum(1 for r in results if r.published or r.verified)
            verified_count = sum(1 for r in results if r.verified)

            if published_count > 0:
                print(f"  ✅ Pre-signed event delivered to {published_count} relay(s)")
                return {
                    "success": True,
                    "event_id": signed_event.get("id"),
                    "published_relays": published_count,
                    "verified_relays": verified_count
                }
            else:
                print("  ❌ Pre-signed event could not be delivered to any relay")
                return {
                    "success": False,
                    "event_id": signed_event.get("id"),
                    "published_relays": 0,
                    "verified_relays": 0,
                    "error": "No relay accepted the event"
                }
        except Exception as e:
            print(f"  ❌ Exception publishing signed event: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    async def create_definition(self, badge_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create and publish a badge definition (kind 30009)"""
        try:
            print(f"  → Publishing to {len(self.relay_urls)} relays: {self.relay_urls}")
            result = await self.badge_creator.publish_badge_definition(
                badge_data, self.relay_urls
            )

            print(f"  → Result status: {result.get('status')}")
            print(f"  → Published: {result.get('published_relays', 0)}, Verified: {result.get('verified_relays', 0)}")

            return {
                "success": result["status"] == "success",
                "a_tag": result.get("a_tag"),
                "event_id": result.get("event", {}).get("id"),
                "published_relays": result.get("published_relays", 0),
                "verified_relays": result.get("verified_relays", 0),
                "error": result.get("error")
            }
        except Exception as e:
            print(f"  ❌ Exception in create_definition: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }
    
    async def award_badge(
        self,
        a_tag: str,
        recipients: List[str]
    ) -> Dict[str, Any]:
        """Award a badge to recipients (kind 8)"""
        try:
            # Normalize all recipients to hex format (required by Nostr protocol)
            normalized_recipients = []
            for r in recipients:
                try:
                    hex_pubkey = normalize_pubkey(r)
                    print(f"✓ Normalized {r[:20]}... -> {hex_pubkey[:16]}...")
                    normalized_recipients.append(hex_pubkey)
                except Exception as e:
                    print(f"✗ Failed to normalize pubkey: {r} - {e}")
                    return {
                        "success": False,
                        "error": f"Invalid recipient pubkey: {r}"
                    }

            print(f"📋 Awarding badge to {len(normalized_recipients)} recipients (hex format)")

            result = await self.badge_creator.award_badge(
                a_tag, normalized_recipients, self.relay_urls
            )

            return {
                "success": result["status"] == "success",
                "award_event_id": result.get("event", {}).get("id"),
                "recipients_count": len(normalized_recipients),
                "published_relays": result.get("published_relays", 0),
                "verified_relays": result.get("verified_relays", 0),
                "error": result.get("error")
            }
        except Exception as e:
            print(f"❌ Award badge error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_badge(self, a_tag: str) -> Dict[str, Any]:
        """
        Delete a badge definition and all its awards (NIP-09 kind 5).

        Queries relays for the badge definition (kind 30009) and all award
        events (kind 8) referencing this badge, then publishes a kind 5
        deletion event targeting all of them.

        Args:
            a_tag: Badge definition identifier (e.g. "30009:pubkey:identifier")

        Returns:
            Result dictionary with deletion status
        """
        parts = a_tag.split(":")
        if len(parts) != 3 or parts[0] != "30009":
            return {"success": False, "error": "Invalid a_tag format"}

        issuer_hex = parts[1]

        if issuer_hex != self.badge_creator.issuer_hex:
            return {"success": False, "error": "Only the badge issuer can delete this badge"}

        print(f"\n{'='*50}")
        print(f"🗑️  DELETE BADGE: {a_tag}")
        print(f"{'='*50}")

        # Step 1 & 2: Find all event IDs (definition + awards)
        print("\n🔍 Finding badge events...")
        query_service = BadgeQueryService()
        query_result = await query_service.get_badge_event_ids(a_tag)
        event_ids = query_result["event_ids"]
        print(f"   Found {query_result['definition_count']} definition(s), {query_result['award_count']} award(s)")

        if not event_ids:
            return {"success": False, "error": "No events found for this badge"}

        # Step 3: Create and publish kind 5 deletion event
        print(f"\n🗑️  Step 3: Deleting {len(event_ids)} event(s)...")
        deletion_event = self.badge_creator.create_deletion_event(
            event_ids=event_ids,
            a_tags=[a_tag],
            reason="Badge deleted by issuer"
        )

        relay_manager = RelayManager()
        results = await relay_manager.publish_event(deletion_event, self.relay_urls)
        relay_manager.print_summary()

        published_count = sum(1 for r in results if r.published or r.verified)
        verified_count = sum(1 for r in results if r.verified)

        if published_count > 0:
            print(f"✅ Deletion published to {published_count} relay(s) — {len(event_ids)} event(s) targeted")
            return {
                "success": True,
                "deletion_event_id": deletion_event["id"],
                "deleted_events": len(event_ids),
                "published_relays": published_count,
                "verified_relays": verified_count
            }
        else:
            print("❌ Deletion event could not be published to any relay")
            return {
                "success": False,
                "error": "No relay accepted the deletion event"
            }

    async def create_and_award(
        self,
        badge_data: Dict[str, Any],
        recipients: List[str]
    ) -> Dict[str, Any]:
        """Create badge definition and award in one call"""
        print(f"\n{'='*50}")
        print(f"🎯 CREATE AND AWARD")
        print(f"Badge: {badge_data.get('name')} ({badge_data.get('identifier')})")
        print(f"Recipients: {len(recipients)}")
        print(f"{'='*50}")

        # First create the definition
        print("\n📝 Step 1: Creating badge definition...")
        definition_result = await self.create_definition(badge_data)

        if not definition_result.get("success"):
            print(f"❌ Definition failed: {definition_result.get('error')}")
            return definition_result

        a_tag = definition_result.get("a_tag")
        print(f"✅ Definition created: {a_tag}")

        # Then award the badge
        print("\n🏅 Step 2: Awarding badge...")
        award_result = await self.award_badge(a_tag, recipients)

        if award_result.get("success"):
            print(f"✅ Badge awarded successfully!")
        else:
            print(f"❌ Award failed: {award_result.get('error')}")

        return {
            "success": award_result.get("success"),
            "a_tag": a_tag,
            "definition_event_id": definition_result.get("event_id"),
            "award_event_id": award_result.get("award_event_id"),
            "recipients_count": award_result.get("recipients_count"),
            "published_relays": award_result.get("published_relays"),
            "verified_relays": award_result.get("verified_relays"),
            "error": award_result.get("error")
        }


class BadgeQueryService:
    """Lightweight service for querying badge events from relays (no signing needed)"""

    def __init__(self):
        self.relay_urls = settings.relay_urls

    async def _query_relay(self, relay_url, req_id, filter_params, timeout=10):
        """Query a single relay for events"""
        results = []
        try:
            async with websockets.connect(relay_url, open_timeout=5) as ws:
                await ws.send(json.dumps(["REQ", req_id, filter_params]))
                start = asyncio.get_event_loop().time()
                while True:
                    if asyncio.get_event_loop().time() - start > timeout:
                        break
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
                    if data[0] == "EOSE":
                        break
        except Exception as e:
            print(f"Query error ({relay_url}): {e}")
        return results

    async def _query_multiple(self, filter_params, prefix):
        """Query multiple relays and deduplicate by event ID"""
        tasks = []
        for i, relay in enumerate(self.relay_urls[:5]):
            req_id = f"{prefix}_{int(time.time())}_{i}"
            tasks.append(self._query_relay(relay, req_id, filter_params))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        events_by_id = {}
        for result in results:
            if isinstance(result, list):
                for ev in result:
                    if ev.get("id"):
                        events_by_id[ev["id"]] = ev
        return list(events_by_id.values())

    async def get_badge_event_ids(self, a_tag: str) -> Dict[str, Any]:
        """
        Get all event IDs (definition + awards) for a badge.
        Used by NIP-07 flow to build the deletion event client-side.
        """
        parts = a_tag.split(":")
        if len(parts) != 3 or parts[0] != "30009":
            return {"event_ids": [], "definition_count": 0, "award_count": 0}

        issuer_hex = parts[1]
        identifier = parts[2]

        definition_events = await self._query_multiple(
            {"kinds": [30009], "authors": [issuer_hex], "#d": [identifier]},
            "qdef"
        )
        award_events = await self._query_multiple(
            {"kinds": [8], "authors": [issuer_hex], "#a": [a_tag]},
            "qaward"
        )

        event_ids = [ev["id"] for ev in definition_events if ev.get("id")]
        event_ids += [ev["id"] for ev in award_events if ev.get("id")]

        return {
            "event_ids": event_ids,
            "definition_count": len(definition_events),
            "award_count": len(award_events)
        }

