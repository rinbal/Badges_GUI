"""
Inbox Router - Badge inbox endpoints (receiver side)

Supports two authentication flows:
- NIP-07: Use X-Pubkey header (hex format) for reads, signed_event in body for writes
- nsec: Use X-Nsec header for all operations (backend signs)
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header
from ..models.requests import AcceptBadgeRequest, RemoveBadgeRequest
from ..models.responses import (
    PendingBadgeResponse,
    AcceptedBadgeResponse,
    AcceptBadgeResultResponse,
    RemoveBadgeResultResponse
)
from ..services.inbox_service import InboxService
from ..services.key_service import KeyService
from ..config import settings

router = APIRouter(prefix="/inbox", tags=["Inbox"])


def get_nsec_from_header(x_nsec: Optional[str], required: bool = True) -> Optional[str]:
    """Validate and return nsec from header"""
    if not x_nsec:
        if required:
            raise HTTPException(status_code=401, detail="Missing X-Nsec header")
        return None

    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")

    return x_nsec


def get_auth_context(x_nsec: Optional[str], x_pubkey: Optional[str]) -> tuple:
    """
    Get authentication context from headers.
    Returns (nsec, pubkey_hex, is_nip07)

    For NIP-07: X-Pubkey header provides the user's pubkey
    For nsec: X-Nsec header provides the private key (pubkey derived)
    """
    if x_pubkey:
        # NIP-07 flow: pubkey provided directly
        if len(x_pubkey) != 64 or not all(c in '0123456789abcdef' for c in x_pubkey.lower()):
            raise HTTPException(status_code=400, detail="Invalid X-Pubkey format (must be 64-char hex)")
        return None, x_pubkey, True

    if x_nsec:
        # nsec flow: derive pubkey from nsec
        is_valid, key_info, error = KeyService.validate_nsec(x_nsec)
        if not is_valid:
            raise HTTPException(status_code=401, detail=f"Invalid key: {error}")
        return x_nsec, key_info["hex"], False

    raise HTTPException(status_code=401, detail="Missing authentication (X-Nsec or X-Pubkey header)")


@router.get("/pending", response_model=List[PendingBadgeResponse])
async def get_pending_badges(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get pending (unaccepted) badges

    Returns list of badges that have been awarded but not yet accepted.
    Supports both NIP-07 (X-Pubkey) and nsec (X-Nsec) authentication.
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        # NIP-07: Create service with pubkey only (read-only operations)
        inbox_service = InboxService.from_pubkey(pubkey_hex)
    else:
        # nsec: Full service with signing capability
        inbox_service = InboxService(nsec)

    pending = await inbox_service.get_pending_badges()

    return [PendingBadgeResponse(**b) for b in pending]


@router.get("/accepted", response_model=List[AcceptedBadgeResponse])
async def get_accepted_badges(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get accepted badges

    Returns list of badges that have been accepted and are displayed in profile.
    Supports both NIP-07 (X-Pubkey) and nsec (X-Nsec) authentication.
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        inbox_service = InboxService.from_pubkey(pubkey_hex)
    else:
        inbox_service = InboxService(nsec)

    accepted = await inbox_service.get_accepted_badges()

    return [AcceptedBadgeResponse(**b) for b in accepted]


@router.post("/accept", response_model=AcceptBadgeResultResponse)
async def accept_badge(
    request: AcceptBadgeRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Accept a badge

    Accepts a pending badge and adds it to the profile badges event (kind 30008).

    Supports two flows:
    - NIP-07: Include signed_event in request body (profile badges event)
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"📥 Accept badge request: a_tag={request.a_tag}, has_signed_event={request.signed_event is not None}")
    print(f"   Headers: X-Nsec={'present' if x_nsec else 'missing'}, X-Pubkey={'present' if x_pubkey else 'missing'}")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed profile badges event")
        from relay_manager import RelayManager

        relay_manager = RelayManager()
        results = await relay_manager.publish_event(
            request.signed_event.model_dump(),
            settings.relay_urls
        )
        relay_manager.print_summary()

        published_count = sum(1 for r in results if r.published or r.verified)
        verified_count = sum(1 for r in results if r.verified)

        # Count badges from tags
        total_badges = sum(1 for tag in request.signed_event.tags if tag[0] == "a")

        return AcceptBadgeResultResponse(
            success=published_count > 0,
            profile_event_id=request.signed_event.id,
            total_badges=total_badges,
            verified_relays=verified_count,
            error=None if published_count > 0 else "No relay accepted the event"
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing profile badges event")

    inbox_service = InboxService(nsec)
    result = await inbox_service.accept_badge(request.a_tag, request.award_event_id)

    return AcceptBadgeResultResponse(
        success=result.get("success", False),
        profile_event_id=result.get("profile_event_id"),
        total_badges=result.get("total_badges", 0),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/remove", response_model=RemoveBadgeResultResponse)
async def remove_badge(
    request: RemoveBadgeRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Remove an accepted badge

    Removes a badge from the profile badges event.
    The badge will return to pending status.

    Supports two flows:
    - NIP-07: Include signed_event in request body (updated profile badges event)
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"🗑️ NIP-07 flow: Publishing pre-signed profile badges event")
        from relay_manager import RelayManager

        relay_manager = RelayManager()
        results = await relay_manager.publish_event(
            request.signed_event.model_dump(),
            settings.relay_urls
        )
        relay_manager.print_summary()

        published_count = sum(1 for r in results if r.published or r.verified)
        verified_count = sum(1 for r in results if r.verified)

        # Count remaining badges from tags
        remaining_badges = sum(1 for tag in request.signed_event.tags if tag[0] == "a")

        return RemoveBadgeResultResponse(
            success=published_count > 0,
            remaining_badges=remaining_badges,
            verified_relays=verified_count,
            error=None if published_count > 0 else "No relay accepted the event"
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"🗑️ nsec flow: Creating and signing profile badges event")

    inbox_service = InboxService(nsec)
    result = await inbox_service.remove_badge(request.a_tag, request.award_event_id)

    return RemoveBadgeResultResponse(
        success=result.get("success", False),
        remaining_badges=result.get("remaining_badges", 0),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.get("/info")
async def get_inbox_info(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get inbox info (recipient public key)

    Returns the public key info for the authenticated user.
    Supports both NIP-07 (X-Pubkey) and nsec (X-Nsec) authentication.
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        # For NIP-07, we just return the pubkey they provided
        # Convert to npub for display
        from nostr.key import PublicKey
        pub = PublicKey(bytes.fromhex(pubkey_hex))
        return {
            "npub": pub.bech32(),
            "hex": pubkey_hex
        }

    inbox_service = InboxService(nsec)
    info = inbox_service.get_recipient_info()

    return {
        "npub": info["npub"],
        "hex": info["hex"]
    }

