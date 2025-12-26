"""
Relays Router - Relay configuration endpoints
"""

from typing import List
from fastapi import APIRouter
from ..models.responses import RelayStatusResponse
from ..config import settings

router = APIRouter(prefix="/relays", tags=["Relays"])


@router.get("", response_model=List[RelayStatusResponse])
async def get_relays():
    """
    Get configured relays
    
    Returns list of configured Nostr relays.
    No authentication required.
    """
    return [
        RelayStatusResponse(url=url, status="configured")
        for url in settings.relay_urls
    ]

