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
        
        for relay in self.relay_urls:
            events = await self._query_relay(relay, f"profile_{hex_key[:8]}", filter_params)
            if events:
                try:
                    meta = json.loads(events[0]["content"])
                    return {
                        "npub": npub,
                        "hex": hex_key,
                        "name": meta.get("name"),
                        "display_name": meta.get("display_name"),
                        "picture": meta.get("picture"),
                        "about": meta.get("about")
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
            "about": None
        }
    
    async def get_profile_badges(self, pubkey: str) -> Dict[str, List[Dict]]:
        """
        Get accepted and pending badges for a pubkey
        
        Note: For pending badges, we need the private key.
        This method only returns accepted (public) badges.
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
                            
                            badge_name = await self._get_badge_name(issuer_hex, identifier)
                            
                            accepted.append({
                                "a_tag": last_a_tag,
                                "award_event_id": tag[1],
                                "badge_name": badge_name,
                                "issuer_hex": issuer_hex,
                                "issuer_npub": issuer_npub
                            })
                        except:
                            pass
                        last_a_tag = None
                break
        
        return {
            "accepted": accepted,
            "pending": []  # Would need private key to check pending
        }
    
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

