"""
Inbox Router - Badge inbox endpoints (receiver side)
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

router = APIRouter(prefix="/inbox", tags=["Inbox"])


def get_nsec_from_header(x_nsec: Optional[str]) -> str:
    """Validate and return nsec from header"""
    if not x_nsec:
        raise HTTPException(status_code=401, detail="Missing X-Nsec header")
    
    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")
    
    return x_nsec


@router.get("/pending", response_model=List[PendingBadgeResponse])
async def get_pending_badges(x_nsec: Optional[str] = Header(None)):
    """
    Get pending (unaccepted) badges
    
    Returns list of badges that have been awarded but not yet accepted.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    inbox_service = InboxService(nsec)
    pending = await inbox_service.get_pending_badges()
    
    return [PendingBadgeResponse(**b) for b in pending]


@router.get("/accepted", response_model=List[AcceptedBadgeResponse])
async def get_accepted_badges(x_nsec: Optional[str] = Header(None)):
    """
    Get accepted badges
    
    Returns list of badges that have been accepted and are displayed in profile.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    inbox_service = InboxService(nsec)
    accepted = await inbox_service.get_accepted_badges()
    
    return [AcceptedBadgeResponse(**b) for b in accepted]


@router.post("/accept", response_model=AcceptBadgeResultResponse)
async def accept_badge(
    request: AcceptBadgeRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Accept a badge
    
    Accepts a pending badge and adds it to the profile badges event (kind 30008).
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
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
    x_nsec: Optional[str] = Header(None)
):
    """
    Remove an accepted badge
    
    Removes a badge from the profile badges event.
    The badge will return to pending status.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    inbox_service = InboxService(nsec)
    result = await inbox_service.remove_badge(request.a_tag, request.award_event_id)
    
    return RemoveBadgeResultResponse(
        success=result.get("success", False),
        remaining_badges=result.get("remaining_badges", 0),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.get("/info")
async def get_inbox_info(x_nsec: Optional[str] = Header(None)):
    """
    Get inbox info (recipient public key)
    
    Returns the public key info for the authenticated user.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    inbox_service = InboxService(nsec)
    info = inbox_service.get_recipient_info()
    
    return {
        "npub": info["npub"],
        "hex": info["hex"]
    }

