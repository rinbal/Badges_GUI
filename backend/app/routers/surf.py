"""
Surf Router - Badge discovery endpoints

Provides endpoints for:
- Browsing recent badges
- Searching badges
- Getting badge details
- Getting badge holders
"""

from typing import Optional, List
from fastapi import APIRouter, Query
from pydantic import BaseModel
from ..services.surf_service import SurfService


router = APIRouter(prefix="/surf", tags=["Surf"])


# =========================================================================
# Response Models
# =========================================================================

class BadgeInfo(BaseModel):
    """Badge definition info"""
    a_tag: str
    identifier: str
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    thumb: Optional[str] = None
    issuer_pubkey: str
    issuer_npub: Optional[str] = None
    event_id: Optional[str] = None
    created_at: Optional[int] = None
    holder_count: Optional[int] = None


class BadgeOwner(BaseModel):
    """Badge holder info"""
    pubkey: str
    awarded_at: Optional[int] = None
    profile: Optional[dict] = None


class BadgeOwnersResponse(BaseModel):
    """Response for badge owners endpoint"""
    owners: List[BadgeOwner]
    total_count: int


class BadgeListResponse(BaseModel):
    """Response for badge list endpoints"""
    badges: List[BadgeInfo]
    count: int


# =========================================================================
# Endpoints
# =========================================================================

@router.get("/recent", response_model=BadgeListResponse)
async def get_recent_badges(
    limit: int = Query(default=50, le=100, ge=1),
    since: Optional[int] = Query(default=None, description="Unix timestamp to filter badges created after")
):
    """
    Get recent badge definitions from Nostr.

    Returns badges sorted by creation time (most recent first).
    No authentication required - badge definitions are public.

    Args:
        limit: Maximum number of badges (1-100)
        since: Optional timestamp filter
    """
    surf_service = SurfService()
    badges = await surf_service.get_recent_badges(limit=limit, since=since)

    return BadgeListResponse(badges=badges, count=len(badges))


@router.get("/popular", response_model=BadgeListResponse)
async def get_popular_badges(
    limit: int = Query(default=30, le=50, ge=1)
):
    """
    Get popular badges sorted by holder count.

    This endpoint is heavier as it counts awards for each badge.
    No authentication required.

    Args:
        limit: Maximum number of badges (1-50)
    """
    surf_service = SurfService()
    badges = await surf_service.get_badges_with_stats(limit=limit)

    return BadgeListResponse(badges=badges, count=len(badges))


@router.get("/search", response_model=BadgeListResponse)
async def search_badges(
    q: str = Query(..., min_length=2, max_length=100, description="Search query"),
    limit: int = Query(default=30, le=100, ge=1)
):
    """
    Search badges by name, description, or identifier.

    Searches are case-insensitive. Results are sorted by relevance
    (name matches first, then by recency).
    No authentication required.

    Args:
        q: Search query (2-100 characters)
        limit: Maximum number of results (1-100)
    """
    surf_service = SurfService()
    badges = await surf_service.search_badges(query=q, limit=limit)

    return BadgeListResponse(badges=badges, count=len(badges))


@router.get("/issuer/{pubkey}", response_model=BadgeListResponse)
async def get_badges_by_issuer(
    pubkey: str,
    limit: int = Query(default=50, le=100, ge=1)
):
    """
    Get all badges created by a specific issuer.

    Args:
        pubkey: Issuer's public key (hex or npub)
        limit: Maximum number of badges (1-100)
    """
    # Normalize pubkey if needed
    from nostr.key import PublicKey
    if pubkey.startswith("npub"):
        try:
            pubkey = PublicKey.from_npub(pubkey).hex()
        except Exception:
            pass

    surf_service = SurfService()
    badges = await surf_service.get_badges_by_issuer(
        issuer_pubkey=pubkey,
        limit=limit
    )

    return BadgeListResponse(badges=badges, count=len(badges))


@router.get("/badge/details", response_model=BadgeInfo)
async def get_badge_details(
    a_tag: str = Query(..., description="Badge a-tag (e.g., '30009:pubkey:identifier')")
):
    """
    Get detailed info for a specific badge.

    Args:
        a_tag: Badge a-tag (e.g., "30009:pubkey:identifier")
    """
    surf_service = SurfService()
    badge = await surf_service.get_badge_details(badge_a_tag=a_tag)

    if not badge:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Badge not found")

    return BadgeInfo(**badge)


@router.get("/badge/owners", response_model=BadgeOwnersResponse)
async def get_badge_owners(
    a_tag: str = Query(..., description="Badge a-tag (e.g., '30009:pubkey:identifier')"),
    limit: int = Query(default=50, le=100, ge=1),
    include_profiles: bool = Query(default=True)
):
    """
    Get users who hold a specific badge.

    Args:
        a_tag: Badge a-tag (e.g., "30009:pubkey:identifier")
        limit: Maximum number of owners (1-100)
        include_profiles: Whether to fetch profile metadata
    """
    surf_service = SurfService()
    result = await surf_service.get_badge_owners(
        badge_a_tag=a_tag,
        limit=limit,
        include_profiles=include_profiles
    )

    return BadgeOwnersResponse(
        owners=result["owners"],
        total_count=result["total_count"]
    )
