"""
Profile Router - Profile data endpoints
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..models.responses import ProfileResponse
from ..services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["Profile"])


class ProfileSearchResult(BaseModel):
    hex: str
    npub: str
    name: Optional[str] = None
    display_name: Optional[str] = None
    picture: Optional[str] = None
    nip05: Optional[str] = None


class ProfileSearchResponse(BaseModel):
    profiles: List[ProfileSearchResult]
    count: int


@router.get("/search", response_model=ProfileSearchResponse)
async def search_profiles(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(default=10, le=25, ge=1)
):
    """
    Search for Nostr profiles by name or display name.

    Uses the NIP-50 search extension supported by many relays.
    Results are filtered client-side to ensure name relevance.

    Args:
        q: Search query (3-100 characters)
        limit: Maximum number of results (1-25)
    """
    profile_service = ProfileService()
    profiles = await profile_service.search_profiles(query=q, limit=limit)
    return ProfileSearchResponse(profiles=profiles, count=len(profiles))


@router.get("/{pubkey}", response_model=ProfileResponse)
async def get_profile(pubkey: str):
    """
    Get profile data for a pubkey
    
    Fetches profile metadata (kind 0) from Nostr relays.
    No authentication required - profiles are public.
    
    Args:
        pubkey: Public key in npub or hex format
    """
    profile_service = ProfileService()
    profile = await profile_service.get_profile(pubkey)
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found or invalid pubkey")
    
    return ProfileResponse(**profile)


@router.get("/{pubkey}/badges")
async def get_profile_badges(pubkey: str):
    """
    Get badges for a profile
    
    Returns accepted badges that are publicly displayed.
    No authentication required.
    
    Args:
        pubkey: Public key in npub or hex format
    """
    profile_service = ProfileService()
    badges = await profile_service.get_profile_badges(pubkey)
    
    return badges

