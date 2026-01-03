"""
Profile Service - Handles profile data fetching
"""

import json
import sys
import asyncio
import websockets
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PublicKey
from ..config import settings
from .key_service import KeyService


class ProfileService:
    """Service for profile operations"""
    
    def __init__(self):
        self.relay_urls = settings.relay_urls
    
    async def _query_relay(
        self, 
        relay_url: str, 
        req_id: str, 
        filter_params: Dict, 
        timeout: int = 5
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
                        msg = await asyncio.wait_for(ws.recv(), timeout=2)
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
    
    async def get_profile(self, pubkey: str) -> Optional[Dict[str, Any]]:
        """
        Get profile metadata for a pubkey
        
        Args:
            pubkey: npub or hex format
            
        Returns full Nostr kind 0 profile data including:
        - name, display_name, picture, banner, about
        - nip05 (verified address), lud16 (lightning), website
        """
        try:
            hex_key = KeyService.normalize_pubkey(pubkey)
            npub = KeyService.hex_to_npub(hex_key)
        except ValueError as e:
            return None
        
        filter_params = {
            "kinds": [0],
            "authors": [hex_key],
            "limit": 1
        }
        
        for relay in self.relay_urls[:5]:  # Query fewer relays for speed
            events = await self._query_relay(relay, f"profile_{hex_key[:8]}", filter_params)
            if events:
                try:
                    meta = json.loads(events[0]["content"])
                    return {
                        "npub": npub,
                        "hex": hex_key,
                        # Core identity
                        "name": meta.get("name"),
                        "display_name": meta.get("display_name"),
                        "picture": meta.get("picture"),
                        "banner": meta.get("banner"),
                        "about": meta.get("about"),
                        # Verification & contacts
                        "nip05": meta.get("nip05"),
                        "lud16": meta.get("lud16"),  # Lightning address
                        "website": meta.get("website"),
                        # Additional info
                        "created_at": events[0].get("created_at")
                    }
                except:
                    pass
        
        # Return basic info if no metadata found
        return {
            "npub": npub,
            "hex": hex_key,
            "name": None,
            "display_name": None,
            "picture": None,
            "banner": None,
            "about": None,
            "nip05": None,
            "lud16": None,
            "website": None,
            "created_at": None
        }
    
    async def get_profile_badges(self, pubkey: str) -> Dict[str, List[Dict]]:
        """
        Get accepted and pending badges for a pubkey

        Note: For pending badges, we need the private key.
        This method only returns accepted (public) badges.

        Returns full badge info including name, description, image,
        and issuer profile (name, picture).
        """
        try:
            hex_key = KeyService.normalize_pubkey(pubkey)
        except ValueError:
            return {"accepted": [], "pending": []}

        # Get accepted badges (kind 30008)
        filter_params = {
            "kinds": [30008],
            "authors": [hex_key],
            "limit": 1
        }

        accepted = []

        for relay in self.relay_urls:
            events = await self._query_relay(relay, f"badges_{hex_key[:8]}", filter_params)
            if events:
                tags = events[0].get("tags", [])

                # Parse badge pairs
                last_a_tag = None
                for tag in tags:
                    if tag[0] == "a":
                        last_a_tag = tag[1]
                    elif tag[0] == "e" and last_a_tag:
                        try:
                            _, issuer_hex, identifier = last_a_tag.split(":")
                            issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()

                            # Fetch full badge info (name, description, image)
                            badge_info = await self._get_badge_info_full(issuer_hex, identifier)

                            # Fetch issuer profile (name, picture)
                            issuer_info = await self._get_issuer_profile(issuer_hex)

                            accepted.append({
                                "a_tag": last_a_tag,
                                "award_event_id": tag[1],
                                "identifier": identifier,
                                "badge_name": badge_info["name"],
                                "badge_description": badge_info["description"],
                                "badge_image": badge_info["image"],
                                "issuer_hex": issuer_hex,
                                "issuer_npub": issuer_npub,
                                "issuer_name": issuer_info["name"],
                                "issuer_picture": issuer_info["picture"]
                            })
                        except:
                            pass
                        last_a_tag = None
                break

        return {
            "accepted": accepted,
            "pending": []  # Would need private key to check pending
        }

    async def _get_badge_info_full(self, issuer_hex: str, identifier: str) -> Dict[str, str]:
        """Fetch full badge info (name, description, image) from definition"""
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

        for relay in self.relay_urls[:3]:
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

    async def _get_issuer_profile(self, pubkey_hex: str) -> Dict[str, str]:
        """Fetch issuer profile info (name, picture) from kind 0"""
        filter_params = {
            "kinds": [0],
            "authors": [pubkey_hex],
            "limit": 1
        }

        result = {
            "name": "(no name)",
            "picture": ""
        }

        for relay in self.relay_urls[:3]:
            events = await self._query_relay(relay, f"meta_{pubkey_hex[:8]}", filter_params)
            if events:
                try:
                    meta = json.loads(events[0]["content"])
                    result["name"] = meta.get("name") or meta.get("display_name") or "(no name)"
                    result["picture"] = meta.get("picture") or ""
                except:
                    pass
                break

        return result
    
    async def _get_badge_name(self, issuer_hex: str, identifier: str) -> str:
        """Fetch badge name from definition"""
        filter_params = {
            "kinds": [30009],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }

        for relay in self.relay_urls[:3]:
            events = await self._query_relay(relay, f"def_{identifier}", filter_params)
            if events:
                for tag in events[0].get("tags", []):
                    if tag[0] == "name":
                        return tag[1]
                break

        return "(unknown badge)"

    async def get_badge_owners(
        self,
        a_tag: str,
        limit: int = 50,
        include_profiles: bool = True
    ) -> Dict[str, Any]:
        """
        Discover all users who have accepted a specific badge.

        This queries Nostr relays for kind 30008 (Profile Badges) events
        that contain the specified badge a_tag.

        Args:
            a_tag: Badge identifier in format "30009:pubkey:identifier"
            limit: Maximum number of owners to return
            include_profiles: Whether to fetch profile metadata for owners

        Returns:
            Dictionary with:
            - owners: List of owner info (pubkey, name, picture)
            - total: Total count of owners found
            - badge_info: Basic badge information
        """
        # Validate a_tag format
        try:
            parts = a_tag.split(":")
            if len(parts) != 3 or parts[0] != "30009":
                return {"owners": [], "total": 0, "badge_info": None}
            issuer_hex = parts[1]
            identifier = parts[2]
        except Exception:
            return {"owners": [], "total": 0, "badge_info": None}

        # Query relays for profile badge events containing this a_tag
        # Kind 30008 events with #a tag matching our badge
        filter_params = {
            "kinds": [30008],
            "#a": [a_tag],
            "limit": 100  # Get more, we'll dedupe
        }

        # Collect unique owners from all relays
        seen_pubkeys = set()
        owner_pubkeys = []

        for relay in self.relay_urls[:5]:
            try:
                events = await self._query_relay(
                    relay,
                    f"owners_{identifier[:8]}",
                    filter_params,
                    timeout=7
                )

                for event in events:
                    pubkey = event.get("pubkey")
                    if pubkey and pubkey not in seen_pubkeys:
                        seen_pubkeys.add(pubkey)
                        owner_pubkeys.append(pubkey)

            except Exception as e:
                print(f"Error querying relay for owners: {e}")
                continue

        # Limit results
        total_count = len(owner_pubkeys)
        owner_pubkeys = owner_pubkeys[:limit]

        # Build owner list
        owners = []

        if include_profiles and owner_pubkeys:
            # Fetch profiles in parallel (batch of 10)
            for i in range(0, len(owner_pubkeys), 10):
                batch = owner_pubkeys[i:i+10]
                profile_tasks = [self._get_owner_profile(pk) for pk in batch]
                profiles = await asyncio.gather(*profile_tasks, return_exceptions=True)

                for pubkey, profile in zip(batch, profiles):
                    if isinstance(profile, Exception):
                        profile = None

                    owners.append({
                        "pubkey": pubkey,
                        "npub": KeyService.hex_to_npub(pubkey) if pubkey else None,
                        "name": profile.get("name") if profile else None,
                        "display_name": profile.get("display_name") if profile else None,
                        "picture": profile.get("picture") if profile else None
                    })
        else:
            # Just return pubkeys without profile data
            for pubkey in owner_pubkeys:
                try:
                    npub = KeyService.hex_to_npub(pubkey)
                except Exception:
                    npub = None

                owners.append({
                    "pubkey": pubkey,
                    "npub": npub,
                    "name": None,
                    "display_name": None,
                    "picture": None
                })

        # Get basic badge info
        badge_info = await self._get_badge_info(issuer_hex, identifier)

        return {
            "owners": owners,
            "total": total_count,
            "badge_info": badge_info
        }

    async def _get_owner_profile(self, pubkey: str) -> Optional[Dict]:
        """
        Fetch minimal profile data for an owner.
        Optimized for speed - only gets name and picture.
        """
        filter_params = {
            "kinds": [0],
            "authors": [pubkey],
            "limit": 1
        }

        # Try just 2 relays for speed
        for relay in self.relay_urls[:2]:
            try:
                events = await self._query_relay(
                    relay,
                    f"op_{pubkey[:8]}",
                    filter_params,
                    timeout=3
                )
                if events:
                    meta = json.loads(events[0]["content"])
                    return {
                        "name": meta.get("name"),
                        "display_name": meta.get("display_name"),
                        "picture": meta.get("picture")
                    }
            except Exception:
                continue

        return None

    async def _get_badge_info(self, issuer_hex: str, identifier: str) -> Optional[Dict]:
        """
        Fetch basic badge definition info.
        Returns name, description, and image.
        """
        filter_params = {
            "kinds": [30009],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }

        for relay in self.relay_urls[:3]:
            try:
                events = await self._query_relay(
                    relay,
                    f"bi_{identifier[:8]}",
                    filter_params,
                    timeout=5
                )
                if events:
                    tags = events[0].get("tags", [])
                    info = {"identifier": identifier}

                    for tag in tags:
                        if len(tag) >= 2:
                            if tag[0] == "name":
                                info["name"] = tag[1]
                            elif tag[0] == "description":
                                info["description"] = tag[1]
                            elif tag[0] == "image":
                                info["image"] = tag[1]

                    return info
            except Exception:
                continue

        return None

