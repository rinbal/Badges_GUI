"""
Requests Router - Badge request endpoints (NIP-58 Extension)

Supports two authentication flows:
- NIP-07: Use X-Pubkey header for reads, signed_event in body for writes
- nsec: Use X-Nsec header for all operations (backend signs)
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header
from ..models.badge_requests import (
    CreateBadgeRequestRequest,
    WithdrawBadgeRequestRequest,
    DenyBadgeRequestRequest,
    RevokeDenialRequest,
    AwardFromRequestRequest,
    BadgeRequestResponse,
    CreateBadgeRequestResponse,
    WithdrawBadgeRequestResponse,
    DenyBadgeRequestResponse,
    RevokeDenialResponse,
    AwardFromRequestResponse,
    IncomingRequestsCountResponse,
    ProofInfo
)
from ..services.request_service import RequestService
from ..services.key_service import KeyService
from ..config import settings

router = APIRouter(prefix="/requests", tags=["Badge Requests"])


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


def get_nsec_from_header(x_nsec: Optional[str]) -> str:
    """Validate and return nsec from header (required for write operations)"""
    if not x_nsec:
        raise HTTPException(status_code=401, detail="Missing X-Nsec header")

    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")

    return x_nsec


# =============================================================================
# Requester Endpoints
# =============================================================================

@router.post("/create", response_model=CreateBadgeRequestResponse)
async def create_badge_request(
    request: CreateBadgeRequestRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Create a badge request (kind 30058)

    Request a badge from an issuer with optional message and proofs.

    Supports two flows:
    - NIP-07: Include signed_event in request body
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"📨 Create badge request: badge={request.badge_a_tag}")
    print(f"   Content: {request.content[:50]}..." if request.content else "   Content: (empty)")
    print(f"   Proofs: {len(request.proofs)}")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed badge request")

        request_service = RequestService.from_pubkey(request.signed_event.pubkey)
        result = await request_service.create_request_signed(request.signed_event.model_dump())

        return CreateBadgeRequestResponse(
            success=result.get("success", False),
            event_id=result.get("event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing badge request")

    request_service = RequestService(nsec)
    result = await request_service.create_request(
        request.badge_a_tag,
        request.content,
        request.proofs,
        request.proof_types
    )

    return CreateBadgeRequestResponse(
        success=result.get("success", False),
        event_id=result.get("event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/withdraw", response_model=WithdrawBadgeRequestResponse)
async def withdraw_badge_request(
    request: WithdrawBadgeRequestRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Withdraw a badge request (kind 30058 with status:withdrawn)

    Cancel a pending badge request. The request will no longer be visible to the issuer.

    Supports two flows:
    - NIP-07: Include signed_event in request body
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"🚫 Withdraw badge request: badge={request.badge_a_tag}")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed withdrawal")

        request_service = RequestService.from_pubkey(request.signed_event.pubkey)
        result = await request_service.withdraw_request_signed(request.signed_event.model_dump())

        return WithdrawBadgeRequestResponse(
            success=result.get("success", False),
            event_id=result.get("event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing withdrawal")

    request_service = RequestService(nsec)
    result = await request_service.withdraw_request(request.badge_a_tag)

    return WithdrawBadgeRequestResponse(
        success=result.get("success", False),
        event_id=result.get("event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.get("/outgoing", response_model=List[BadgeRequestResponse])
async def get_outgoing_requests(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get outgoing badge requests (requests you have sent)

    Returns list of badge requests with their current state (pending/fulfilled/denied).
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        request_service = RequestService.from_pubkey(pubkey_hex)
    else:
        request_service = RequestService(nsec)

    requests = await request_service.get_outgoing_requests()

    return [BadgeRequestResponse(
        event_id=r["event_id"],
        badge_a_tag=r["badge_a_tag"],
        badge_name=r["badge_name"],
        badge_description=r.get("badge_description"),
        badge_image=r.get("badge_image"),
        issuer_pubkey=r.get("issuer_pubkey"),
        issuer_npub=r.get("issuer_npub"),
        issuer_name=r.get("issuer_name"),
        issuer_picture=r.get("issuer_picture"),
        content=r.get("content", ""),
        proofs=[ProofInfo(**p) for p in r.get("proofs", [])],
        state=r.get("state", "pending"),
        created_at=r["created_at"],
        denial_reason=r.get("denial_reason"),
        denial_created_at=r.get("denial_created_at")
    ) for r in requests]


# =============================================================================
# Issuer Endpoints
# =============================================================================

@router.get("/incoming", response_model=List[BadgeRequestResponse])
async def get_incoming_requests(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get incoming badge requests (requests for badges you created)

    Returns list of badge requests from other users for your badges.
    Includes verified proofs (note/zap).
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        request_service = RequestService.from_pubkey(pubkey_hex)
    else:
        request_service = RequestService(nsec)

    requests = await request_service.get_incoming_requests()

    return [BadgeRequestResponse(
        event_id=r["event_id"],
        badge_a_tag=r["badge_a_tag"],
        badge_name=r["badge_name"],
        badge_description=r.get("badge_description"),
        badge_image=r.get("badge_image"),
        requester_pubkey=r.get("requester_pubkey"),
        requester_npub=r.get("requester_npub"),
        requester_name=r.get("requester_name"),
        requester_picture=r.get("requester_picture"),
        content=r.get("content", ""),
        proofs=[ProofInfo(**p) for p in r.get("proofs", [])],
        state=r.get("state", "pending"),
        created_at=r["created_at"],
        denial_reason=r.get("denial_reason"),
        denial_created_at=r.get("denial_created_at")
    ) for r in requests]


@router.get("/incoming/count", response_model=IncomingRequestsCountResponse)
async def get_incoming_requests_count(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get count of incoming badge requests

    Returns total count and pending count for the notification badge.
    """
    nsec, pubkey_hex, is_nip07 = get_auth_context(x_nsec, x_pubkey)

    if is_nip07:
        request_service = RequestService.from_pubkey(pubkey_hex)
    else:
        request_service = RequestService(nsec)

    counts = await request_service.get_incoming_requests_count()

    return IncomingRequestsCountResponse(
        count=counts["count"],
        pending_count=counts["pending_count"]
    )


@router.post("/deny", response_model=DenyBadgeRequestResponse)
async def deny_badge_request(
    request: DenyBadgeRequestRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Deny a badge request (kind 30059)

    Deny a badge request with optional reason. The requester can still
    submit a new request after denial (soft denial).

    Supports two flows:
    - NIP-07: Include signed_event in request body
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"❌ Deny badge request: request_id={request.request_event_id}")
    print(f"   Reason: {request.reason[:50]}..." if request.reason else "   Reason: (none)")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed denial")

        request_service = RequestService.from_pubkey(request.signed_event.pubkey)
        result = await request_service.deny_request_signed(request.signed_event.model_dump())

        return DenyBadgeRequestResponse(
            success=result.get("success", False),
            denial_event_id=result.get("denial_event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing denial")

    request_service = RequestService(nsec)
    result = await request_service.deny_request(
        request.request_event_id,
        request.badge_a_tag,
        request.requester_pubkey,
        request.reason
    )

    return DenyBadgeRequestResponse(
        success=result.get("success", False),
        denial_event_id=result.get("denial_event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/revoke-denial", response_model=RevokeDenialResponse)
async def revoke_denial(
    request: RevokeDenialRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Revoke a denial (kind 30059 with status:revoked)

    Revoke a previous denial, allowing the request to be reconsidered.

    Supports two flows:
    - NIP-07: Include signed_event in request body
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"↩️ Revoke denial: request_id={request.request_event_id}")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed revocation")

        request_service = RequestService.from_pubkey(request.signed_event.pubkey)
        result = await request_service.revoke_denial_signed(request.signed_event.model_dump())

        return RevokeDenialResponse(
            success=result.get("success", False),
            event_id=result.get("event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing revocation")

    request_service = RequestService(nsec)
    result = await request_service.revoke_denial(
        request.request_event_id,
        request.badge_a_tag,
        request.requester_pubkey
    )

    return RevokeDenialResponse(
        success=result.get("success", False),
        event_id=result.get("event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/award", response_model=AwardFromRequestResponse)
async def award_from_request(
    request: AwardFromRequestRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Award a badge from a request (kind 8)

    Award a badge to the requester. This creates a standard NIP-58 badge award.

    Supports two flows:
    - NIP-07: Include signed_event in request body
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    print(f"🏆 Award from request: badge={request.badge_a_tag}")
    print(f"   Requester: {request.requester_pubkey[:16]}...")

    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"✅ NIP-07 flow: Publishing pre-signed award")

        request_service = RequestService.from_pubkey(request.signed_event.pubkey)
        result = await request_service.award_from_request_signed(request.signed_event.model_dump())

        return AwardFromRequestResponse(
            success=result.get("success", False),
            award_event_id=result.get("award_event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"✅ nsec flow: Creating and signing award")

    request_service = RequestService(nsec)
    result = await request_service.award_from_request(
        request.badge_a_tag,
        request.requester_pubkey
    )

    return AwardFromRequestResponse(
        success=result.get("success", False),
        award_event_id=result.get("award_event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )
