"""
Inbox Service - Handles badge inbox operations (receiver side)
Wraps existing badge_inbox.py functionality
"""

import json
import sys
import asyncio
import websockets
from pathlib import Path
from typing import Dict, List, Any, Optional, Set

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PrivateKey, PublicKey
from recipient_acceptance import BadgeAcceptanceManager
from relay_manager import RelayManager
from ..config import settings


class InboxService:
    """Service for badge inbox operations (receiver side)"""

    def __init__(self, recipient_nsec: str):
        """Initialize with recipient's private key"""
        self.recipient_pk = PrivateKey.from_nsec(recipient_nsec)
        self.recipient_hex = self.recipient_pk.public_key.hex()
        self.recipient_npub = self.recipient_pk.public_key.bech32()
        self.acceptance_manager = BadgeAcceptanceManager(recipient_nsec)
        self.relay_urls = settings.relay_urls

    @classmethod
    def from_pubkey(cls, pubkey_hex: str) -> 'InboxService':
        """
        Create a read-only InboxService from a public key (for NIP-07 flow).
        Only supports read operations (get_pending_badges, get_accepted_badges).
        """
        instance = cls.__new__(cls)
        instance.recipient_pk = None
        instance.recipient_hex = pubkey_hex
        instance.recipient_npub = PublicKey(bytes.fromhex(pubkey_hex)).bech32()
        instance.acceptance_manager = None  # Not available for NIP-07
        instance.relay_urls = settings.relay_urls
        return instance
    
    def get_recipient_info(self) -> Dict[str, str]:
        """Get recipient public key info"""
        return {
            "hex": self.recipient_hex,
            "npub": self.recipient_npub
        }
    
    async def _query_relay(
        self, 
        relay_url: str, 
        req_id: str, 
        filter_params: Dict, 
        timeout: int = 7
    ) -> List[Dict]:
        """Query a relay for events"""
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
                    except:
                        continue
                    
                    if not isinstance(data, list):
                        continue
                    
                    if data[0] == "EVENT" and len(data) >= 3 and data[1] == req_id:
                        results.append(data[2])
                    
                    if data[0] == "EOSE" and len(data) >= 2 and data[1] == req_id:
                        break
        
        except Exception as e:
            print(f"Relay query error ({relay_url}): {e}")
        
        return results
    
    async def get_accepted_badges(self) -> List[Dict[str, Any]]:
        """Get list of accepted badges"""
        filter_params = {
            "kinds": [30008],
            "authors": [self.recipient_hex],
            "limit": 1
        }
        
        profile_event = None
        
        for relay in self.relay_urls:
            events = await self._query_relay(
                relay, f"accepted_{self.recipient_hex[:8]}", filter_params
            )
            if events:
                profile_event = events[0]
                break
        
        if not profile_event:
            return []
        
        tags = profile_event.get("tags", [])
        
        # Extract badge pairs (a-tag + e-tag)
        badge_pairs = []
        last_a_tag = None
        
        for tag in tags:
            if tag[0] == "a":
                last_a_tag = tag[1]
            elif tag[0] == "e" and last_a_tag:
                badge_pairs.append((last_a_tag, tag[1]))
                last_a_tag = None
        
        # --- Pass 1: collect valid pairs and resolve issuer pubkeys ---
        valid_pairs = []
        for a_tag, award_event_id in badge_pairs:
            try:
                _, issuer_hex, identifier = a_tag.split(":")
            except Exception:
                continue
            valid_pairs.append((a_tag, award_event_id, issuer_hex, identifier))

        if not valid_pairs:
            return []

        # --- Batch-fetch all unique issuer profiles in parallel (batches of 10) ---
        issuer_hexes = [vp[2] for vp in valid_pairs]
        profiles = await self._fetch_profiles_batch(issuer_hexes)

        # --- Pass 2: assemble response using cached profiles ---
        accepted_badges = []
        for a_tag, award_event_id, issuer_hex, identifier in valid_pairs:
            issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()
            badge_info = await self._get_badge_info(issuer_hex, identifier)
            profile = profiles.get(issuer_hex)

            accepted_badges.append({
                "a_tag": a_tag,
                "award_event_id": award_event_id,
                "badge_name": badge_info["name"],
                "badge_description": badge_info["description"],
                "badge_image": badge_info["image"],
                "issuer_hex": issuer_hex,
                "issuer_npub": issuer_npub,
                "issuer_name": (profile.get("name") or profile.get("display_name")) if profile else None,
                "issuer_picture": profile.get("picture") if profile else None,
            })

        return accepted_badges
    
    async def get_pending_badges(self) -> List[Dict[str, Any]]:
        """Get list of pending (unaccepted) badges"""
        # First get accepted badge a-tags
        accepted_a_tags = set()
        
        filter_params = {
            "kinds": [30008],
            "authors": [self.recipient_hex],
            "limit": 1
        }
        
        for relay in self.relay_urls:
            events = await self._query_relay(
                relay, f"profile_{self.recipient_hex[:8]}", filter_params
            )
            if events:
                for tag in events[0].get("tags", []):
                    if tag[0] == "a":
                        accepted_a_tags.add(tag[1])
                break
        
        # Fetch award events (kind 8)
        filter_params = {
            "kinds": [8],
            "#p": [self.recipient_hex],
            "limit": 50
        }
        
        award_events = []
        for relay in self.relay_urls:
            events = await self._query_relay(
                relay, f"awards_{self.recipient_hex[:8]}", filter_params
            )
            award_events.extend(events)
        
        # Deduplicate
        seen = set()
        unique_awards = []
        for ev in award_events:
            if ev["id"] not in seen:
                seen.add(ev["id"])
                unique_awards.append(ev)
        
        # --- Pass 1: collect valid awards and resolve issuer pubkeys ---
        valid_awards = []
        for ev in unique_awards:
            a_tag = next((x[1] for x in ev.get("tags", []) if x[0] == "a"), None)
            if not a_tag or a_tag in accepted_a_tags:
                continue
            try:
                _, issuer_hex, identifier = a_tag.split(":")
            except Exception:
                continue
            valid_awards.append((ev, a_tag, issuer_hex, identifier))

        if not valid_awards:
            return []

        # --- Batch-fetch all unique issuer profiles in parallel (batches of 10) ---
        issuer_hexes = [vaw[2] for vaw in valid_awards]
        profiles = await self._fetch_profiles_batch(issuer_hexes)

        # --- Pass 2: assemble response using cached profiles ---
        pending_badges = []
        for ev, a_tag, issuer_hex, identifier in valid_awards:
            issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()
            badge_info = await self._get_badge_info(issuer_hex, identifier)
            profile = profiles.get(issuer_hex)

            pending_badges.append({
                "award_event_id": ev["id"],
                "a_tag": a_tag,
                "badge_name": badge_info["name"],
                "badge_description": badge_info["description"],
                "badge_image": badge_info["image"],
                "issuer_hex": issuer_hex,
                "issuer_npub": issuer_npub,
                "issuer_name": (profile.get("name") or profile.get("display_name")) if profile else None,
                "issuer_picture": profile.get("picture") if profile else None,
            })

        return pending_badges
    
    async def accept_badge(
        self, 
        a_tag: str, 
        award_event_id: str
    ) -> Dict[str, Any]:
        """Accept a badge"""
        try:
            result = await self.acceptance_manager.accept_badge(
                a_tag, award_event_id, self.relay_urls
            )
            
            return {
                "success": result["status"] == "success",
                "profile_event_id": result.get("event", {}).get("id"),
                "total_badges": result.get("total_badges", 0),
                "verified_relays": result.get("verified_relays", 0),
                "error": result.get("error")
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def remove_badge(
        self, 
        a_tag: str, 
        award_event_id: str
    ) -> Dict[str, Any]:
        """Remove an accepted badge"""
        try:
            # Get current accepted badges
            accepted = await self.get_accepted_badges()
            
            # Filter out the badge to remove
            remaining = [
                b for b in accepted 
                if not (b["a_tag"] == a_tag and b["award_event_id"] == award_event_id)
            ]
            
            # Create badge pairs for new profile event
            badge_pairs = [(b["a_tag"], b["award_event_id"]) for b in remaining]
            
            # Create and publish new profile badges event
            profile_event = self.acceptance_manager.create_merged_profile_badges_event(
                badge_pairs, self.relay_urls
            )
            
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(profile_event, self.relay_urls)
            
            verified_count = sum(1 for r in results if r.verified or r.published)
            
            return {
                "success": verified_count > 0,
                "remaining_badges": len(remaining),
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _get_badge_info(self, issuer_hex: str, identifier: str) -> Dict[str, str]:
        """Fetch badge info (name, description, image) from definition"""
        filter_params = {
            "kinds": [30009],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }
        
        result = {
            "name": "(unknown badge)",
            "description": "",
            "image": ""
        }
        
        for relay in self.relay_urls[:3]:  # Only try first 3 relays
            events = await self._query_relay(relay, f"def_{identifier}", filter_params)
            if events:
                for tag in events[0].get("tags", []):
                    if tag[0] == "name":
                        result["name"] = tag[1]
                    elif tag[0] == "description":
                        result["description"] = tag[1]
                    elif tag[0] == "image":
                        result["image"] = tag[1]
                    elif tag[0] == "thumb" and not result["image"]:
                        result["image"] = tag[1]
                break
        
        return result
    
    async def _get_badge_name(self, issuer_hex: str, identifier: str) -> str:
        """Fetch badge name from definition"""
        info = await self._get_badge_info(issuer_hex, identifier)
        return info["name"]
    
    async def _get_badge_description(self, issuer_hex: str, identifier: str) -> str:
        """Fetch badge description from definition"""
        info = await self._get_badge_info(issuer_hex, identifier)
        return info["description"]
    
    async def _fetch_issuer_profile(self, pubkey_hex: str) -> Optional[Dict[str, Optional[str]]]:
        """
        Fetch a single issuer's profile (name, display_name, picture) from kind 0.
        Optimised for speed: tries the first 2 relays with a 3-second timeout.
        Returns None when the profile is not found on any relay.
        """
        filter_params = {
            "kinds": [0],
            "authors": [pubkey_hex],
            "limit": 1
        }

        for relay in self.relay_urls[:2]:
            try:
                events = await self._query_relay(
                    relay,
                    f"ip_{pubkey_hex[:8]}",
                    filter_params,
                    timeout=3
                )
                if events:
                    meta = json.loads(events[0]["content"])
                    return {
                        "name": meta.get("name") or None,
                        "display_name": meta.get("display_name") or None,
                        "picture": meta.get("picture") or None,
                    }
            except Exception:
                continue

        return None

    async def _fetch_profiles_batch(
        self, pubkey_hexes: List[str]
    ) -> Dict[str, Optional[Dict[str, Optional[str]]]]:
        """
        Fetch profiles for multiple issuers in parallel, processed in batches of 10.
        Deduplicates the input list before fetching.
        Returns a mapping of pubkey_hex -> profile dict (or None if not found).
        """
        unique = list(dict.fromkeys(pubkey_hexes))  # deduplicate, preserve order
        results: Dict[str, Optional[Dict]] = {}

        for i in range(0, len(unique), 10):
            batch = unique[i:i + 10]
            tasks = [self._fetch_issuer_profile(pk) for pk in batch]
            profiles = await asyncio.gather(*tasks, return_exceptions=True)

            for pk, profile in zip(batch, profiles):
                results[pk] = None if isinstance(profile, Exception) else profile

        return results

    async def _get_profile_info(self, pubkey_hex: str) -> Dict[str, str]:
        """Fetch profile info (name, picture) from kind 0 — legacy single-profile helper."""
        profile = await self._fetch_issuer_profile(pubkey_hex)
        if profile:
            return {
                "name": profile.get("name") or profile.get("display_name") or "(no name)",
                "picture": profile.get("picture") or "",
            }
        return {"name": "(no name)", "picture": ""}
    
    async def _get_profile_name(self, pubkey_hex: str) -> str:
        """Fetch profile name (kind 0)"""
        info = await self._get_profile_info(pubkey_hex)
        return info["name"]

