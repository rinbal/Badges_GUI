"""
Request Service - Handles badge request operations (NIP-58 Extension)

Supports:
- Creating badge requests (kind 30058)
- Withdrawing requests
- Getting incoming/outgoing requests with pagination
- Denying requests (kind 30059)
- Revoking denials
- Verifying proofs (note/zap)

All multi-relay queries run in parallel via asyncio.gather() for fast loading.
"""

import json
import time
import hashlib
import sys
import asyncio
import websockets
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PrivateKey, PublicKey
from nostr.event import Event
from relay_manager import RelayManager
from ..config import settings


# Event kinds for NIP-58 Extension
KIND_BADGE_REQUEST = 30058
KIND_BADGE_DENIAL = 30059
KIND_BADGE_DEFINITION = 30009
KIND_BADGE_AWARD = 8
KIND_NOTE = 1
KIND_ZAP_RECEIPT = 9735

# Default page size for request listings
DEFAULT_PAGE_SIZE = 10


class RequestService:
    """Service for badge request operations"""

    def __init__(self, user_nsec: Optional[str] = None):
        """Initialize with optional user's private key"""
        if user_nsec:
            self.private_key = PrivateKey.from_nsec(user_nsec)
            self.user_hex = self.private_key.public_key.hex()
            self.user_npub = self.private_key.public_key.bech32()
        else:
            self.private_key = None
            self.user_hex = None
            self.user_npub = None

        self.relay_urls = settings.relay_urls

    @classmethod
    def from_pubkey(cls, pubkey_hex: str) -> 'RequestService':
        """Create a read-only RequestService from a public key (for NIP-07 flow)"""
        instance = cls.__new__(cls)
        instance.private_key = None
        instance.user_hex = pubkey_hex
        instance.user_npub = PublicKey(bytes.fromhex(pubkey_hex)).bech32()
        instance.relay_urls = settings.relay_urls
        return instance

    # =========================================================================
    # Relay Communication
    # =========================================================================

    async def _query_relay(
        self,
        relay_url: str,
        req_id: str,
        filter_params: Dict,
        timeout: int = 7
    ) -> List[Dict]:
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

                    if data[0] == "EOSE" and len(data) >= 2 and data[1] == req_id:
                        break

        except Exception as e:
            print(f"Relay query error ({relay_url}): {e}")

        return results

    async def _query_multiple_relays(
        self,
        filter_params: Dict,
        req_prefix: str,
        max_relays: int = 5
    ) -> List[Dict]:
        """Query multiple relays in parallel and deduplicate results"""
        timestamp = int(time.time())

        tasks = [
            self._query_relay(
                relay,
                f"{req_prefix}_{i}_{timestamp}",
                filter_params
            )
            for i, relay in enumerate(self.relay_urls[:max_relays])
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        seen: set = set()
        unique_events: List[Dict] = []
        for result in results:
            if isinstance(result, Exception):
                continue
            for ev in result:
                ev_id = ev.get("id")
                if ev_id and ev_id not in seen:
                    seen.add(ev_id)
                    unique_events.append(ev)

        return unique_events

    # =========================================================================
    # Event Creation
    # =========================================================================

    def _create_badge_request_event(
        self,
        badge_a_tag: str,
        content: str,
        proofs: List[str],
        proof_types: List[str],
        withdrawn: bool = False
    ) -> Dict:
        """Create a badge request event (kind 30058)"""
        if not self.private_key:
            raise ValueError("Private key required for signing")

        # Extract issuer pubkey from a_tag
        parts = badge_a_tag.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid badge a_tag format")

        issuer_pubkey = parts[1]

        tags = [
            ["d", badge_a_tag],
            ["a", badge_a_tag],
            ["p", issuer_pubkey]
        ]

        # Add proof tags
        for i, proof_id in enumerate(proofs):
            proof_type = proof_types[i] if i < len(proof_types) else "note"
            tags.append(["proof", proof_id, proof_type])

        # Add withdrawn status if withdrawing
        if withdrawn:
            tags.append(["status", "withdrawn"])
            content = ""

        event = Event(
            public_key=self.user_hex,
            created_at=int(time.time()),
            kind=KIND_BADGE_REQUEST,
            tags=tags,
            content=content
        )

        self.private_key.sign_event(event)

        return {
            "id": event.id,
            "pubkey": event.public_key,
            "created_at": event.created_at,
            "kind": event.kind,
            "tags": event.tags,
            "content": event.content,
            "sig": event.signature
        }

    def _create_denial_event(
        self,
        request_event_id: str,
        badge_a_tag: str,
        requester_pubkey: str,
        reason: str,
        revoked: bool = False
    ) -> Dict:
        """Create a badge denial event (kind 30059)"""
        if not self.private_key:
            raise ValueError("Private key required for signing")

        tags = [
            ["d", request_event_id],
            ["a", badge_a_tag],
            ["e", request_event_id],
            ["p", requester_pubkey]
        ]

        if revoked:
            tags.append(["status", "revoked"])
            reason = ""

        event = Event(
            public_key=self.user_hex,
            created_at=int(time.time()),
            kind=KIND_BADGE_DENIAL,
            tags=tags,
            content=reason
        )

        self.private_key.sign_event(event)

        return {
            "id": event.id,
            "pubkey": event.public_key,
            "created_at": event.created_at,
            "kind": event.kind,
            "tags": event.tags,
            "content": event.content,
            "sig": event.signature
        }

    def _create_award_event(
        self,
        badge_a_tag: str,
        recipient_pubkey: str
    ) -> Dict:
        """Create a badge award event (kind 8)"""
        if not self.private_key:
            raise ValueError("Private key required for signing")

        event = Event(
            public_key=self.user_hex,
            created_at=int(time.time()),
            kind=KIND_BADGE_AWARD,
            tags=[
                ["a", badge_a_tag],
                ["p", recipient_pubkey]
            ],
            content=""
        )

        self.private_key.sign_event(event)

        return {
            "id": event.id,
            "pubkey": event.public_key,
            "created_at": event.created_at,
            "kind": event.kind,
            "tags": event.tags,
            "content": event.content,
            "sig": event.signature
        }

    # =========================================================================
    # Create / Withdraw Requests
    # =========================================================================

    async def create_request(
        self,
        badge_a_tag: str,
        content: str,
        proofs: List[str],
        proof_types: List[str]
    ) -> Dict[str, Any]:
        """Create and publish a badge request"""
        try:
            event = self._create_badge_request_event(
                badge_a_tag, content, proofs, proof_types
            )

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def create_request_signed(self, signed_event: Dict) -> Dict[str, Any]:
        """Publish a pre-signed badge request event (NIP-07 flow)"""
        try:
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": signed_event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def withdraw_request(self, badge_a_tag: str) -> Dict[str, Any]:
        """Withdraw a badge request"""
        try:
            event = self._create_badge_request_event(
                badge_a_tag, "", [], [], withdrawn=True
            )

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def withdraw_request_signed(self, signed_event: Dict) -> Dict[str, Any]:
        """Publish a pre-signed withdrawal event (NIP-07 flow)"""
        try:
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": signed_event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # =========================================================================
    # Deny / Revoke / Award
    # =========================================================================

    async def deny_request(
        self,
        request_event_id: str,
        badge_a_tag: str,
        requester_pubkey: str,
        reason: str
    ) -> Dict[str, Any]:
        """Deny a badge request"""
        try:
            event = self._create_denial_event(
                request_event_id, badge_a_tag, requester_pubkey, reason
            )

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "denial_event_id": event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def deny_request_signed(self, signed_event: Dict) -> Dict[str, Any]:
        """Publish a pre-signed denial event (NIP-07 flow)"""
        try:
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "denial_event_id": signed_event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def revoke_denial(
        self,
        request_event_id: str,
        badge_a_tag: str,
        requester_pubkey: str
    ) -> Dict[str, Any]:
        """Revoke a denial"""
        try:
            event = self._create_denial_event(
                request_event_id, badge_a_tag, requester_pubkey, "", revoked=True
            )

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def revoke_denial_signed(self, signed_event: Dict) -> Dict[str, Any]:
        """Publish a pre-signed revocation event (NIP-07 flow)"""
        try:
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "event_id": signed_event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def award_from_request(
        self,
        badge_a_tag: str,
        requester_pubkey: str
    ) -> Dict[str, Any]:
        """Award a badge from a request"""
        try:
            event = self._create_award_event(badge_a_tag, requester_pubkey)

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "award_event_id": event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def award_from_request_signed(self, signed_event: Dict) -> Dict[str, Any]:
        """Publish a pre-signed award event (NIP-07 flow)"""
        try:
            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)

            verified_count = sum(1 for r in results if r.verified or r.published)

            return {
                "success": verified_count > 0,
                "award_event_id": signed_event["id"],
                "verified_relays": verified_count
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    # =========================================================================
    # Get Requests (paginated)
    # =========================================================================

    async def get_outgoing_requests(
        self,
        limit: int = DEFAULT_PAGE_SIZE,
        until: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get requests sent by this user, most recent first, paginated"""
        if not self.user_hex:
            return {"requests": [], "has_more": False, "next_until": None}

        filter_params: Dict = {
            "kinds": [KIND_BADGE_REQUEST],
            "authors": [self.user_hex],
            "limit": limit + 1  # fetch one extra to detect next page
        }
        if until:
            filter_params["until"] = until

        raw = await self._query_multiple_relays(filter_params, "out_req")

        # Sort by created_at descending (relays don't always guarantee order)
        raw.sort(key=lambda x: x.get("created_at", 0), reverse=True)

        has_more = len(raw) > limit
        if has_more:
            raw = raw[:limit]

        next_until = (raw[-1]["created_at"] - 1) if has_more and raw else None

        # Enrich all requests in parallel
        results = await asyncio.gather(
            *[self._enrich_outgoing_request(req) for req in raw],
            return_exceptions=True
        )
        enriched = [r for r in results if isinstance(r, dict)]
        enriched.sort(key=lambda x: x["created_at"], reverse=True)

        return {"requests": enriched, "has_more": has_more, "next_until": next_until}

    async def get_incoming_requests(
        self,
        limit: int = DEFAULT_PAGE_SIZE,
        until: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get requests for badges this user has created, most recent first, paginated"""
        if not self.user_hex:
            return {"requests": [], "has_more": False, "next_until": None}

        filter_params: Dict = {
            "kinds": [KIND_BADGE_REQUEST],
            "#p": [self.user_hex],
            "limit": limit + 1  # fetch one extra to detect next page
        }
        if until:
            filter_params["until"] = until

        raw = await self._query_multiple_relays(filter_params, "in_req")

        # Sort by created_at descending
        raw.sort(key=lambda x: x.get("created_at", 0), reverse=True)

        has_more = len(raw) > limit
        if has_more:
            raw = raw[:limit]

        next_until = (raw[-1]["created_at"] - 1) if has_more and raw else None

        # Enrich all requests in parallel
        results = await asyncio.gather(
            *[self._enrich_incoming_request(req) for req in raw],
            return_exceptions=True
        )
        enriched = [r for r in results if isinstance(r, dict)]
        enriched.sort(key=lambda x: x["created_at"], reverse=True)

        return {"requests": enriched, "has_more": has_more, "next_until": next_until}

    async def get_incoming_requests_count(self) -> Dict[str, int]:
        """
        Get a lightweight count of incoming requests.

        Queries active requests, denials, and awards in parallel to compute
        an accurate pending count without full per-request enrichment.
        """
        if not self.user_hex:
            return {"count": 0, "pending_count": 0}

        raw, denial_results, award_results = await asyncio.gather(
            self._query_multiple_relays(
                {"kinds": [KIND_BADGE_REQUEST], "#p": [self.user_hex], "limit": 100},
                "in_req_count"
            ),
            self._query_multiple_relays(
                {"kinds": [KIND_BADGE_DENIAL], "authors": [self.user_hex], "limit": 200},
                "in_req_denials_count"
            ),
            self._query_multiple_relays(
                {"kinds": [KIND_BADGE_AWARD], "authors": [self.user_hex], "limit": 200},
                "in_req_awards_count"
            ),
            return_exceptions=True
        )

        if isinstance(raw, Exception):
            raw = []
        if isinstance(denial_results, Exception):
            denial_results = []
        if isinstance(award_results, Exception):
            award_results = []

        active = [
            req for req in raw
            if not any(
                tag[0] == "status" and tag[1] == "withdrawn"
                for tag in req.get("tags", [])
            )
        ]

        if not active:
            return {"count": 0, "pending_count": 0}

        # Build set of denied request IDs (skip revoked denials)
        denied_request_ids = set()
        for denial in denial_results:
            dtags = denial.get("tags", [])
            if any(tag[0] == "status" and tag[1] == "revoked" for tag in dtags):
                continue
            e_tag = next((tag[1] for tag in dtags if tag[0] == "e"), None)
            if e_tag:
                denied_request_ids.add(e_tag)

        # Build set of (badge_a_tag, requester_pubkey) pairs that are fulfilled
        awarded_pairs = set()
        for award in award_results:
            atags = award.get("tags", [])
            a_tag = next((tag[1] for tag in atags if tag[0] == "a"), None)
            if a_tag:
                for tag in atags:
                    if tag[0] == "p":
                        awarded_pairs.add((a_tag, tag[1]))

        # Pending = active requests that are neither denied nor fulfilled
        pending_count = 0
        for req in active:
            if req["id"] in denied_request_ids:
                continue
            rtags = req.get("tags", [])
            badge_a_tag = next((tag[1] for tag in rtags if tag[0] == "a"), None)
            if badge_a_tag and (badge_a_tag, req["pubkey"]) in awarded_pairs:
                continue
            pending_count += 1

        return {"count": len(active), "pending_count": pending_count}

    # =========================================================================
    # Request Enrichment
    # =========================================================================

    async def _enrich_outgoing_request(self, request: Dict) -> Optional[Dict]:
        """Enrich an outgoing request with badge and issuer info"""
        tags = request.get("tags", [])

        is_withdrawn = any(tag[0] == "status" and tag[1] == "withdrawn" for tag in tags)

        badge_a_tag = next((tag[1] for tag in tags if tag[0] == "a"), None)
        if not badge_a_tag:
            return None

        try:
            _, issuer_hex, identifier = badge_a_tag.split(":")
        except ValueError:
            return None

        issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()

        if is_withdrawn:
            # Withdrawn requests: fetch only badge/issuer info, skip state determination
            results = await asyncio.gather(
                self._get_badge_info(issuer_hex, identifier),
                self._get_profile_info(issuer_hex),
                return_exceptions=True
            )
            badge_info = results[0] if isinstance(results[0], dict) else {"name": "", "description": "", "image": ""}
            issuer_info = results[1] if isinstance(results[1], dict) else {"name": "", "picture": ""}
            return {
                "event_id": request["id"],
                "badge_a_tag": badge_a_tag,
                "badge_name": badge_info["name"],
                "badge_description": badge_info["description"],
                "badge_image": badge_info["image"],
                "issuer_pubkey": issuer_hex,
                "issuer_npub": issuer_npub,
                "issuer_name": issuer_info["name"],
                "issuer_picture": issuer_info["picture"],
                "content": request.get("content", ""),
                "proofs": [],
                "state": "withdrawn",
                "created_at": request["created_at"],
                "denial_reason": None,
                "denial_created_at": None
            }

        proof_tags = [tag for tag in tags if tag[0] == "proof"]

        # Run badge info, issuer profile, state check, and all proofs in parallel
        results = await asyncio.gather(
            self._get_badge_info(issuer_hex, identifier),
            self._get_profile_info(issuer_hex),
            self._determine_request_state(
                request["id"], badge_a_tag, request["pubkey"], issuer_hex
            ),
            *[
                self._verify_proof(
                    tag[1],
                    tag[2] if len(tag) > 2 else "note",
                    request["pubkey"]
                )
                for tag in proof_tags
            ],
            return_exceptions=True
        )

        badge_info = results[0] if isinstance(results[0], dict) else {"name": "", "description": "", "image": ""}
        issuer_info = results[1] if isinstance(results[1], dict) else {"name": "", "picture": ""}
        state = results[2] if isinstance(results[2], str) else "pending"
        proofs = [r for r in results[3:] if isinstance(r, dict)]

        denial_reason = None
        denial_created_at = None
        if state == "denied":
            denial_info = await self._get_denial_info(request["id"], issuer_hex)
            if denial_info:
                denial_reason = denial_info.get("reason")
                denial_created_at = denial_info.get("created_at")

        return {
            "event_id": request["id"],
            "badge_a_tag": badge_a_tag,
            "badge_name": badge_info["name"],
            "badge_description": badge_info["description"],
            "badge_image": badge_info["image"],
            "issuer_pubkey": issuer_hex,
            "issuer_npub": issuer_npub,
            "issuer_name": issuer_info["name"],
            "issuer_picture": issuer_info["picture"],
            "content": request.get("content", ""),
            "proofs": proofs,
            "state": state,
            "created_at": request["created_at"],
            "denial_reason": denial_reason,
            "denial_created_at": denial_created_at
        }

    async def _enrich_incoming_request(self, request: Dict) -> Optional[Dict]:
        """Enrich an incoming request with badge and requester info"""
        tags = request.get("tags", [])

        if any(tag[0] == "status" and tag[1] == "withdrawn" for tag in tags):
            return None  # Don't show withdrawn requests

        badge_a_tag = next((tag[1] for tag in tags if tag[0] == "a"), None)
        if not badge_a_tag:
            return None

        try:
            _, issuer_hex, identifier = badge_a_tag.split(":")
        except ValueError:
            return None

        requester_hex = request["pubkey"]
        proof_tags = [tag for tag in tags if tag[0] == "proof"]

        # Run badge info, requester profile, state check, and all proofs in parallel
        results = await asyncio.gather(
            self._get_badge_info(issuer_hex, identifier),
            self._get_profile_info(requester_hex),
            self._determine_request_state(
                request["id"], badge_a_tag, requester_hex, issuer_hex
            ),
            *[
                self._verify_proof(
                    tag[1],
                    tag[2] if len(tag) > 2 else "note",
                    requester_hex
                )
                for tag in proof_tags
            ],
            return_exceptions=True
        )

        badge_info = results[0] if isinstance(results[0], dict) else {"name": "", "description": "", "image": ""}
        requester_info = results[1] if isinstance(results[1], dict) else {"name": "", "picture": ""}
        state = results[2] if isinstance(results[2], str) else "pending"
        proofs = [r for r in results[3:] if isinstance(r, dict)]

        denial_reason = None
        denial_created_at = None
        if state == "denied":
            denial_info = await self._get_denial_info(request["id"], issuer_hex)
            if denial_info:
                denial_reason = denial_info.get("reason")
                denial_created_at = denial_info.get("created_at")

        requester_npub = PublicKey(bytes.fromhex(requester_hex)).bech32()

        return {
            "event_id": request["id"],
            "badge_a_tag": badge_a_tag,
            "badge_name": badge_info["name"],
            "badge_description": badge_info["description"],
            "badge_image": badge_info["image"],
            "requester_pubkey": requester_hex,
            "requester_npub": requester_npub,
            "requester_name": requester_info["name"],
            "requester_picture": requester_info["picture"],
            "content": request.get("content", ""),
            "proofs": proofs,
            "state": state,
            "created_at": request["created_at"],
            "denial_reason": denial_reason,
            "denial_created_at": denial_created_at
        }

    # =========================================================================
    # State Determination
    # =========================================================================

    async def _determine_request_state(
        self,
        request_event_id: str,
        badge_a_tag: str,
        requester_hex: str,
        issuer_hex: str
    ) -> str:
        """
        Determine request state based on priority:
        1. Fulfilled (award exists)
        2. Denied (denial exists without revoked status)
        3. Pending (default)

        Award and denial checks run in parallel.
        """
        award_filter = {
            "kinds": [KIND_BADGE_AWARD],
            "authors": [issuer_hex],
            "#p": [requester_hex],
            "#a": [badge_a_tag],
            "limit": 1
        }
        denial_filter = {
            "kinds": [KIND_BADGE_DENIAL],
            "authors": [issuer_hex],
            "#e": [request_event_id],
            "limit": 1
        }

        awards, denials = await asyncio.gather(
            self._query_multiple_relays(award_filter, "check_award", max_relays=3),
            self._query_multiple_relays(denial_filter, "check_denial", max_relays=3)
        )

        if awards:
            return "fulfilled"

        for denial in denials:
            is_revoked = any(
                tag[0] == "status" and tag[1] == "revoked"
                for tag in denial.get("tags", [])
            )
            if not is_revoked:
                return "denied"

        return "pending"

    async def _get_denial_info(
        self,
        request_event_id: str,
        issuer_hex: str
    ) -> Optional[Dict]:
        """Get denial info for a request"""
        filter_params = {
            "kinds": [KIND_BADGE_DENIAL],
            "authors": [issuer_hex],
            "#e": [request_event_id],
            "limit": 1
        }

        denials = await self._query_multiple_relays(filter_params, "get_denial", max_relays=3)
        for denial in denials:
            is_revoked = any(
                tag[0] == "status" and tag[1] == "revoked"
                for tag in denial.get("tags", [])
            )
            if not is_revoked:
                return {
                    "reason": denial.get("content", ""),
                    "created_at": denial.get("created_at")
                }

        return None

    # =========================================================================
    # Proof Verification
    # =========================================================================

    def _decode_event_id(self, event_id: str) -> str:
        """Normalize a proof event ID to 64-char hex.

        Accepts: 64-char hex, note1 (NIP-19 simple), nevent1 (NIP-19 TLV).
        Returns the original string unchanged if it cannot be decoded.
        """
        s = event_id.strip().lower()

        # Already hex
        if len(s) == 64 and all(c in '0123456789abcdef' for c in s):
            return s

        if not (s.startswith('note1') or s.startswith('nevent1')):
            return event_id

        try:
            from nostr.bech32 import CHARSET, bech32_verify_checksum, convertbits

            pos = s.rfind('1')
            if pos < 1:
                return event_id

            hrp = s[:pos]
            data_chars = s[pos + 1:]

            if not all(c in CHARSET for c in data_chars):
                return event_id

            data = [CHARSET.find(c) for c in data_chars]

            if bech32_verify_checksum(hrp, data) is None:
                return event_id

            decoded = convertbits(data[:-6], 5, 8, False)
            if not decoded:
                return event_id

            if hrp == 'note':
                # Plain 32-byte event ID
                if len(decoded) == 32:
                    return bytes(decoded).hex()

            elif hrp == 'nevent':
                # TLV: type(1) + length(1) + value; type 0 = event ID (32 bytes)
                raw = bytes(decoded)
                i = 0
                while i + 1 < len(raw):
                    t = raw[i]
                    l = raw[i + 1]
                    v = raw[i + 2: i + 2 + l]
                    if t == 0 and l == 32:
                        return v.hex()
                    i += 2 + l

        except Exception:
            pass

        return event_id

    async def _verify_proof(
        self,
        event_id: str,
        proof_type: str,
        requester_pubkey: str
    ) -> Dict:
        """Verify a proof event and return info"""
        hex_id = self._decode_event_id(event_id)

        result = {
            "event_id": event_id,
            "proof_type": proof_type,
            "verified": False
        }

        try:
            if proof_type == "note":
                result.update(await self._verify_note_proof(hex_id, requester_pubkey))
            elif proof_type == "zap":
                result.update(await self._verify_zap_proof(hex_id, requester_pubkey))
            else:
                result["error"] = f"Unknown proof type: {proof_type}"
        except Exception as e:
            result["error"] = str(e)

        return result

    async def _verify_note_proof(
        self,
        event_id: str,
        requester_pubkey: str
    ) -> Dict:
        """Verify a note proof (kind 1)"""
        filter_params = {
            "ids": [event_id],
            "kinds": [KIND_NOTE],
            "limit": 1
        }

        events = await self._query_multiple_relays(filter_params, "note_proof", max_relays=5)

        if not events:
            return {"error": "Note not found"}

        note = events[0]

        if note.get("pubkey") != requester_pubkey:
            return {"error": "Note not signed by requester", "verified": False}

        return {
            "verified": True,
            "content": note.get("content", "")[:500],
            "created_at": note.get("created_at")
        }

    async def _verify_zap_proof(
        self,
        event_id: str,
        requester_pubkey: str
    ) -> Dict:
        """Verify a zap proof (kind 9735)"""
        filter_params = {
            "ids": [event_id],
            "kinds": [KIND_ZAP_RECEIPT],
            "limit": 1
        }

        events = await self._query_multiple_relays(filter_params, "zap_proof", max_relays=5)

        if not events:
            return {"error": "Zap receipt not found"}

        zap = events[0]
        tags = zap.get("tags", [])

        recipient = next((tag[1] for tag in tags if tag[0] == "p"), None)

        if recipient != requester_pubkey:
            return {"error": "Zap not received by requester", "verified": False}

        amount_sats = None
        for tag in tags:
            if tag[0] == "bolt11":
                amount_sats = self._extract_bolt11_amount(tag[1])
                break

        sender_pubkey = zap.get("pubkey")
        sender_info = await self._get_profile_info(sender_pubkey) if sender_pubkey else {}

        return {
            "verified": True,
            "amount_sats": amount_sats,
            "sender_pubkey": sender_pubkey,
            "sender_name": sender_info.get("name"),
            "created_at": zap.get("created_at")
        }

    def _extract_bolt11_amount(self, bolt11: str) -> Optional[int]:
        """Extract amount in sats from bolt11 invoice (simplified)"""
        try:
            if bolt11.lower().startswith("lnbc"):
                amount_str = ""
                for i, c in enumerate(bolt11[4:]):
                    if c.isdigit():
                        amount_str += c
                    else:
                        multiplier = 1
                        if c == 'm':
                            multiplier = 100000
                        elif c == 'u':
                            multiplier = 100
                        elif c == 'n':
                            multiplier = 0.1
                        elif c == 'p':
                            multiplier = 0.0001

                        if amount_str:
                            return int(float(amount_str) * multiplier)
                        break
        except Exception:
            pass
        return None

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _get_badge_info(self, issuer_hex: str, identifier: str) -> Dict[str, str]:
        """Fetch badge info from definition"""
        filter_params = {
            "kinds": [KIND_BADGE_DEFINITION],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }

        result = {
            "name": "",
            "description": "",
            "image": ""
        }

        events = await self._query_multiple_relays(filter_params, f"badge_{identifier}", max_relays=3)
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

        return result

    async def _get_profile_info(self, pubkey_hex: str) -> Dict[str, str]:
        """Fetch profile info from kind 0"""
        filter_params = {
            "kinds": [0],
            "authors": [pubkey_hex],
            "limit": 1
        }

        result = {
            "name": "",
            "picture": ""
        }

        events = await self._query_multiple_relays(filter_params, f"profile_{pubkey_hex[:8]}", max_relays=3)
        if events:
            try:
                meta = json.loads(events[0]["content"])
                result["name"] = meta.get("name") or meta.get("display_name") or ""
                result["picture"] = meta.get("picture") or ""
            except Exception:
                pass

        return result
