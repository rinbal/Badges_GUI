"""
Surf Service - Handles badge discovery on Nostr

Provides functionality for:
- Browsing badge definitions (kind 30009)
- Searching badges by name/description
- Filtering by issuer
- Getting recent/popular badges
"""

import json
import time
import asyncio
import websockets
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PublicKey
from ..config import settings

# Event kinds
KIND_BADGE_DEFINITION = 30009
KIND_BADGE_AWARD = 8


class SurfService:
    """Service for badge discovery operations"""

    def __init__(self):
        """Initialize surf service"""
        self.relay_urls = settings.relay_urls

    # =========================================================================
    # Relay Communication
    # =========================================================================

    async def _query_relay(
        self,
        relay_url: str,
        req_id: str,
        filter_params: Dict,
        timeout: int = 10
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

    async def _query_multiple_relays(
        self,
        filter_params: Dict,
        req_prefix: str,
        max_relays: int = 5,
        timeout: int = 10
    ) -> List[Dict]:
        """Query multiple relays concurrently and deduplicate results"""
        tasks = []
        for i, relay in enumerate(self.relay_urls[:max_relays]):
            req_id = f"{req_prefix}_{int(time.time())}_{i}"
            tasks.append(self._query_relay(relay, req_id, filter_params, timeout))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine all events
        all_events = []
        for result in results:
            if isinstance(result, list):
                all_events.extend(result)

        # Deduplicate by event ID, keeping most recent
        events_by_id = {}
        for ev in all_events:
            event_id = ev.get("id")
            if event_id:
                existing = events_by_id.get(event_id)
                if not existing or ev.get("created_at", 0) > existing.get("created_at", 0):
                    events_by_id[event_id] = ev

        return list(events_by_id.values())

    @staticmethod
    def _deduplicate_replaceable(badges: List[Dict]) -> List[Dict]:
        """
        Deduplicate replaceable events (kind 30009) by a_tag.

        Multiple relays may return different versions of the same replaceable
        event. This keeps only the latest version (highest created_at) for each
        unique a_tag (author + d-tag combination).
        """
        by_a_tag = {}
        for badge in badges:
            a_tag = badge.get("a_tag")
            if not a_tag:
                continue
            existing = by_a_tag.get(a_tag)
            if not existing or badge.get("created_at", 0) > existing.get("created_at", 0):
                by_a_tag[a_tag] = badge
        return list(by_a_tag.values())

    # =========================================================================
    # Badge Discovery
    # =========================================================================

    async def get_recent_badges(
        self,
        limit: int = 50,
        since: Optional[int] = None,
        until: Optional[int] = None
    ) -> List[Dict]:
        """
        Get recent badge definitions from Nostr relays.

        Args:
            limit: Maximum number of badges to return
            since: Unix timestamp - only badges created AFTER this time
            until: Unix timestamp - only badges created BEFORE this time (for pagination)

        Returns:
            List of badge definitions
        """
        filter_params = {
            "kinds": [KIND_BADGE_DEFINITION],
            "limit": limit
        }

        if since:
            filter_params["since"] = since
        if until:
            filter_params["until"] = until

        events = await self._query_multiple_relays(
            filter_params, "surf_recent", timeout=12
        )

        # Parse, deduplicate replaceable events, sort by recency
        badges = [self._parse_badge_event(ev) for ev in events]
        badges = [b for b in badges if b is not None]
        badges = self._deduplicate_replaceable(badges)
        badges.sort(key=lambda x: x.get("created_at", 0), reverse=True)

        badges = badges[:limit]
        await self._enrich_with_issuer_profiles(badges)
        return badges

    async def get_badges_by_issuer(
        self,
        issuer_pubkey: str,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get all badges created by a specific issuer.

        Args:
            issuer_pubkey: Issuer's public key (hex)
            limit: Maximum number of badges to return

        Returns:
            List of badge definitions
        """
        filter_params = {
            "kinds": [KIND_BADGE_DEFINITION],
            "authors": [issuer_pubkey],
            "limit": limit
        }

        events = await self._query_multiple_relays(
            filter_params, "surf_issuer", timeout=10
        )

        badges = [self._parse_badge_event(ev) for ev in events]
        badges = [b for b in badges if b is not None]
        badges = self._deduplicate_replaceable(badges)
        badges.sort(key=lambda x: x.get("created_at", 0), reverse=True)

        badges = badges[:limit]
        await self._enrich_with_issuer_profiles(badges)
        return badges

    async def search_badges(
        self,
        query: str,
        limit: int = 50
    ) -> List[Dict]:
        """
        Search for badges by name or description.

        Note: Since Nostr doesn't support full-text search, we fetch recent
        badges and filter client-side. For production, consider indexing.

        Args:
            query: Search query string
            limit: Maximum number of results

        Returns:
            List of matching badge definitions
        """
        # Fetch a larger set to search through
        filter_params = {
            "kinds": [KIND_BADGE_DEFINITION],
            "limit": 200
        }

        events = await self._query_multiple_relays(
            filter_params, "surf_search", timeout=15
        )

        # Parse badges and deduplicate replaceable events
        badges = [self._parse_badge_event(ev) for ev in events]
        badges = [b for b in badges if b is not None]
        badges = self._deduplicate_replaceable(badges)

        # Filter by query (case-insensitive, multi-word support)
        query_lower = query.lower().strip()
        query_words = query_lower.split()

        matching = []
        for badge in badges:
            name = (badge.get("name") or "").lower()
            desc = (badge.get("description") or "").lower()
            identifier = (badge.get("identifier") or "").lower()
            searchable = f"{name} {desc} {identifier}"

            # Match if ALL words are found somewhere in the badge
            if all(word in searchable for word in query_words):
                matching.append(badge)

        # Sort by relevance (name match first, then by recency)
        def sort_key(badge):
            name = (badge.get("name") or "").lower()
            # Prioritize: exact phrase match > all words in name > partial match
            exact_match = query_lower in name
            words_in_name = all(word in name for word in query_words)
            return (not exact_match, not words_in_name, -badge.get("created_at", 0))

        matching.sort(key=sort_key)

        matching = matching[:limit]
        await self._enrich_with_issuer_profiles(matching)
        return matching

    async def get_badge_details(
        self,
        badge_a_tag: str
    ) -> Optional[Dict]:
        """
        Get detailed info for a specific badge by a-tag.

        Args:
            badge_a_tag: Badge a-tag (e.g., "30009:pubkey:identifier")

        Returns:
            Badge definition dict or None if not found
        """
        parts = badge_a_tag.split(":")
        if len(parts) != 3:
            return None

        kind_str, pubkey, identifier = parts

        filter_params = {
            "kinds": [KIND_BADGE_DEFINITION],
            "authors": [pubkey],
            "#d": [identifier],
            "limit": 1
        }

        events = await self._query_multiple_relays(
            filter_params, "surf_detail", timeout=8
        )

        if not events:
            return None

        # Deduplicate and return the most recent version
        badges = [self._parse_badge_event(ev) for ev in events]
        badges = [b for b in badges if b is not None]
        badges = self._deduplicate_replaceable(badges)
        return badges[0] if badges else None

    async def get_badge_owners(
        self,
        badge_a_tag: str,
        limit: int = 50,
        include_profiles: bool = False
    ) -> Dict:
        """
        Get users who have been awarded a specific badge.

        Args:
            badge_a_tag: Badge a-tag
            limit: Maximum number of owners to return
            include_profiles: Whether to fetch profile metadata

        Returns:
            Dict with owners list and total count
        """
        filter_params = {
            "kinds": [KIND_BADGE_AWARD],
            "#a": [badge_a_tag],
            "limit": 100  # Fetch more to count
        }

        events = await self._query_multiple_relays(
            filter_params, "surf_owners", timeout=10
        )

        # Extract unique recipients from award events
        owners = {}
        for ev in events:
            for tag in ev.get("tags", []):
                if tag[0] == "p" and len(tag) > 1:
                    pubkey = tag[1]
                    if pubkey not in owners:
                        owners[pubkey] = {
                            "pubkey": pubkey,
                            "awarded_at": ev.get("created_at")
                        }

        owner_list = list(owners.values())
        total_count = len(owner_list)

        # Sort by awarded_at (most recent first)
        owner_list.sort(key=lambda x: x.get("awarded_at", 0), reverse=True)

        # Limit results
        owner_list = owner_list[:limit]

        # Optionally fetch profiles
        if include_profiles and owner_list:
            profiles = await self._fetch_profiles([o["pubkey"] for o in owner_list])
            for owner in owner_list:
                owner["profile"] = profiles.get(owner["pubkey"])

        return {
            "owners": owner_list,
            "total_count": total_count
        }

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _parse_badge_event(self, event: Dict) -> Optional[Dict]:
        """Parse a badge definition event into a structured format"""
        try:
            tags = event.get("tags", [])

            # Extract data from tags
            identifier = None
            name = None
            description = None
            image = None
            thumb = None

            for tag in tags:
                if len(tag) < 2:
                    continue
                if tag[0] == "d":
                    identifier = tag[1]
                elif tag[0] == "name":
                    name = tag[1]
                elif tag[0] == "description":
                    description = tag[1]
                elif tag[0] == "image":
                    image = tag[1]
                elif tag[0] == "thumb":
                    thumb = tag[1]

            if not identifier:
                return None

            issuer_pubkey = event.get("pubkey")

            # Build a-tag
            a_tag = f"30009:{issuer_pubkey}:{identifier}"

            # Try to get npub
            try:
                npub = PublicKey(bytes.fromhex(issuer_pubkey)).bech32()
            except:
                npub = None

            return {
                "a_tag": a_tag,
                "identifier": identifier,
                "name": name or identifier,
                "description": description,
                "image": image,
                "thumb": thumb or image,
                "issuer_pubkey": issuer_pubkey,
                "issuer_npub": npub,
                "event_id": event.get("id"),
                "created_at": event.get("created_at")
            }

        except Exception as e:
            print(f"Error parsing badge event: {e}")
            return None

    async def _fetch_profiles(self, pubkeys: List[str]) -> Dict[str, Dict]:
        """Fetch profile metadata for multiple pubkeys"""
        if not pubkeys:
            return {}

        filter_params = {
            "kinds": [0],  # Metadata
            "authors": pubkeys,
            "limit": len(pubkeys)
        }

        events = await self._query_multiple_relays(
            filter_params, "surf_profiles", timeout=8
        )

        # Parse profiles, keeping most recent for each pubkey
        profiles = {}
        for ev in events:
            pubkey = ev.get("pubkey")
            if pubkey:
                existing = profiles.get(pubkey)
                if not existing or ev.get("created_at", 0) > existing.get("_created_at", 0):
                    try:
                        content = json.loads(ev.get("content", "{}"))
                        content["_created_at"] = ev.get("created_at")
                        profiles[pubkey] = content
                    except:
                        pass

        # Clean up internal fields
        for p in profiles.values():
            p.pop("_created_at", None)

        return profiles

    async def _enrich_with_issuer_profiles(self, badges: List[Dict]) -> List[Dict]:
        """Attach issuer_name and issuer_picture to each badge from profile metadata"""
        if not badges:
            return badges

        # Collect unique issuer pubkeys
        pubkeys = list({b["issuer_pubkey"] for b in badges if b.get("issuer_pubkey")})
        if not pubkeys:
            return badges

        profiles = await self._fetch_profiles(pubkeys)

        for badge in badges:
            profile = profiles.get(badge.get("issuer_pubkey")) or {}
            badge["issuer_name"] = profile.get("display_name") or profile.get("name")
            badge["issuer_picture"] = profile.get("picture")

        return badges

    async def get_badges_with_stats(
        self,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get recent badges with award counts.
        This is a heavier operation but provides more useful data.

        Args:
            limit: Maximum number of badges to return

        Returns:
            List of badge definitions with holder counts
        """
        # Get recent badges
        badges = await self.get_recent_badges(limit=limit)

        # Fetch award counts in parallel
        async def get_count(badge):
            a_tag = badge.get("a_tag")
            if not a_tag:
                return 0
            result = await self.get_badge_owners(a_tag, limit=1, include_profiles=False)
            return result.get("total_count", 0)

        counts = await asyncio.gather(*[get_count(b) for b in badges])

        for i, badge in enumerate(badges):
            badge["holder_count"] = counts[i]

        # Sort by holder count (most popular first)
        badges.sort(key=lambda x: x.get("holder_count", 0), reverse=True)

        return badges
