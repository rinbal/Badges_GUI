"""
Profile Router - Profile data endpoints
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from ..models.responses import ProfileResponse
from ..services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["Profile"])


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

