"""
Request Service - Handles badge request operations (NIP-58 Extension)

Supports:
- Creating badge requests (kind 30058)
- Withdrawing requests
- Getting incoming/outgoing requests
- Denying requests (kind 30059)
- Revoking denials
- Verifying proofs (note/zap)
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
        max_relays: int = 5
    ) -> List[Dict]:
        """Query multiple relays and deduplicate results"""
        all_events = []

        for relay in self.relay_urls[:max_relays]:
            events = await self._query_relay(
                relay, f"{req_prefix}_{int(time.time())}", filter_params
            )
            all_events.extend(events)

        # Deduplicate by event ID
        seen = set()
        unique_events = []
        for ev in all_events:
            if ev.get("id") not in seen:
                seen.add(ev["id"])
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
    # Get Requests
    # =========================================================================

    async def get_outgoing_requests(self) -> List[Dict[str, Any]]:
        """Get requests sent by this user"""
        if not self.user_hex:
            return []

        filter_params = {
            "kinds": [KIND_BADGE_REQUEST],
            "authors": [self.user_hex],
            "limit": 100
        }

        requests = await self._query_multiple_relays(filter_params, "out_req")

        # Process and enrich requests
        enriched = []
        for req in requests:
            enriched_req = await self._enrich_outgoing_request(req)
            if enriched_req:
                enriched.append(enriched_req)

        # Sort by created_at descending
        enriched.sort(key=lambda x: x["created_at"], reverse=True)

        return enriched

    async def get_incoming_requests(self) -> List[Dict[str, Any]]:
        """Get requests for badges this user has created"""
        if not self.user_hex:
            return []

        filter_params = {
            "kinds": [KIND_BADGE_REQUEST],
            "#p": [self.user_hex],
            "limit": 100
        }

        requests = await self._query_multiple_relays(filter_params, "in_req")

        # Process and enrich requests
        enriched = []
        for req in requests:
            enriched_req = await self._enrich_incoming_request(req)
            if enriched_req:
                enriched.append(enriched_req)

        # Sort by created_at descending
        enriched.sort(key=lambda x: x["created_at"], reverse=True)

        return enriched

    async def get_incoming_requests_count(self) -> Dict[str, int]:
        """Get count of incoming requests"""
        requests = await self.get_incoming_requests()
        pending_count = sum(1 for r in requests if r["state"] == "pending")

        return {
            "count": len(requests),
            "pending_count": pending_count
        }

    # =========================================================================
    # Request Enrichment
    # =========================================================================

    async def _enrich_outgoing_request(self, request: Dict) -> Optional[Dict]:
        """Enrich an outgoing request with badge and issuer info"""
        tags = request.get("tags", [])

        # Check for withdrawn status
        is_withdrawn = any(
            tag[0] == "status" and tag[1] == "withdrawn"
            for tag in tags
        )

        if is_withdrawn:
            return None  # Don't show withdrawn requests

        # Get badge a_tag
        badge_a_tag = None
        for tag in tags:
            if tag[0] == "a":
                badge_a_tag = tag[1]
                break

        if not badge_a_tag:
            return None

        # Parse a_tag
        try:
            _, issuer_hex, identifier = badge_a_tag.split(":")
        except:
            return None

        # Get proofs
        proofs = []
        for tag in tags:
            if tag[0] == "proof":
                proof_info = await self._verify_proof(
                    tag[1],
                    tag[2] if len(tag) > 2 else "note",
                    request["pubkey"]
                )
                proofs.append(proof_info)

        # Get badge info
        badge_info = await self._get_badge_info(issuer_hex, identifier)

        # Get issuer info
        issuer_info = await self._get_profile_info(issuer_hex)
        issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()

        # Determine state
        state = await self._determine_request_state(
            request["id"],
            badge_a_tag,
            request["pubkey"],
            issuer_hex
        )

        # Get denial info if denied
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

        # Check for withdrawn status
        is_withdrawn = any(
            tag[0] == "status" and tag[1] == "withdrawn"
            for tag in tags
        )

        if is_withdrawn:
            return None  # Don't show withdrawn requests

        # Get badge a_tag
        badge_a_tag = None
        for tag in tags:
            if tag[0] == "a":
                badge_a_tag = tag[1]
                break

        if not badge_a_tag:
            return None

        # Parse a_tag
        try:
            _, issuer_hex, identifier = badge_a_tag.split(":")
        except:
            return None

        # Get proofs
        proofs = []
        for tag in tags:
            if tag[0] == "proof":
                proof_info = await self._verify_proof(
                    tag[1],
                    tag[2] if len(tag) > 2 else "note",
                    request["pubkey"]
                )
                proofs.append(proof_info)

        # Get badge info
        badge_info = await self._get_badge_info(issuer_hex, identifier)

        # Get requester info
        requester_hex = request["pubkey"]
        requester_info = await self._get_profile_info(requester_hex)
        requester_npub = PublicKey(bytes.fromhex(requester_hex)).bech32()

        # Determine state
        state = await self._determine_request_state(
            request["id"],
            badge_a_tag,
            requester_hex,
            issuer_hex
        )

        # Get denial info if denied
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
        """
        # Check for award (kind 8)
        filter_params = {
            "kinds": [KIND_BADGE_AWARD],
            "authors": [issuer_hex],
            "#p": [requester_hex],
            "#a": [badge_a_tag],
            "limit": 1
        }

        awards = await self._query_multiple_relays(filter_params, "check_award", max_relays=3)
        if awards:
            return "fulfilled"

        # Check for denial (kind 30059)
        filter_params = {
            "kinds": [KIND_BADGE_DENIAL],
            "authors": [issuer_hex],
            "#e": [request_event_id],
            "limit": 1
        }

        denials = await self._query_multiple_relays(filter_params, "check_denial", max_relays=3)
        for denial in denials:
            # Check if denial is revoked
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

    async def _verify_proof(
        self,
        event_id: str,
        proof_type: str,
        requester_pubkey: str
    ) -> Dict:
        """Verify a proof event and return info"""
        result = {
            "event_id": event_id,
            "proof_type": proof_type,
            "verified": False
        }

        try:
            if proof_type == "note":
                result.update(await self._verify_note_proof(event_id, requester_pubkey))
            elif proof_type == "zap":
                result.update(await self._verify_zap_proof(event_id, requester_pubkey))
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

        events = await self._query_multiple_relays(filter_params, "note_proof", max_relays=3)

        if not events:
            return {"error": "Note not found"}

        note = events[0]

        # Verify author is the requester
        if note.get("pubkey") != requester_pubkey:
            return {"error": "Note not signed by requester", "verified": False}

        return {
            "verified": True,
            "content": note.get("content", "")[:500],  # Truncate for display
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

        events = await self._query_multiple_relays(filter_params, "zap_proof", max_relays=3)

        if not events:
            return {"error": "Zap receipt not found"}

        zap = events[0]
        tags = zap.get("tags", [])

        # Get recipient from p tag
        recipient = None
        for tag in tags:
            if tag[0] == "p":
                recipient = tag[1]
                break

        # Verify recipient is the requester
        if recipient != requester_pubkey:
            return {"error": "Zap not received by requester", "verified": False}

        # Extract amount from bolt11 (simplified - would need proper bolt11 decoding)
        amount_sats = None
        for tag in tags:
            if tag[0] == "bolt11":
                # Try to extract amount from bolt11 invoice
                # This is simplified - real implementation would decode the invoice
                bolt11 = tag[1]
                # Look for amount in lnbc format
                amount_sats = self._extract_bolt11_amount(bolt11)
                break

        # Get sender info
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
            # Remove prefix
            if bolt11.lower().startswith("lnbc"):
                amount_str = ""
                for i, c in enumerate(bolt11[4:]):
                    if c.isdigit():
                        amount_str += c
                    else:
                        # Check multiplier
                        multiplier = 1
                        if c == 'm':  # milli-bitcoin
                            multiplier = 100000
                        elif c == 'u':  # micro-bitcoin
                            multiplier = 100
                        elif c == 'n':  # nano-bitcoin
                            multiplier = 0.1
                        elif c == 'p':  # pico-bitcoin
                            multiplier = 0.0001

                        if amount_str:
                            return int(float(amount_str) * multiplier)
                        break
        except:
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
            "name": "(unknown badge)",
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
            "name": "(no name)",
            "picture": ""
        }

        events = await self._query_multiple_relays(filter_params, f"profile_{pubkey_hex[:8]}", max_relays=3)
        if events:
            try:
                meta = json.loads(events[0]["content"])
                result["name"] = meta.get("name") or meta.get("display_name") or "(no name)"
                result["picture"] = meta.get("picture") or ""
            except:
                pass

        return result
