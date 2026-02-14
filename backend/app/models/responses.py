"""
Response Models - Pydantic schemas for API outputs
"""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel


class KeyValidationResponse(BaseModel):
    """Response for key validation"""
    valid: bool
    npub: Optional[str] = None
    hex: Optional[str] = None
    error: Optional[str] = None


class ProfileResponse(BaseModel):
    """Response for profile data - all NIP-01 kind 0 fields"""
    npub: str
    hex: str
    # Core identity
    name: Optional[str] = None
    display_name: Optional[str] = None
    picture: Optional[str] = None
    banner: Optional[str] = None
    about: Optional[str] = None
    # Verification & contacts
    nip05: Optional[str] = None
    lud16: Optional[str] = None
    website: Optional[str] = None
    # Metadata
    created_at: Optional[int] = None


class BadgeTemplateResponse(BaseModel):
    """Response for a badge template"""
    identifier: str
    name: str
    description: str
    image: str


class BadgeDefinitionResponse(BaseModel):
    """Response for a badge definition"""
    a_tag: str
    identifier: str
    name: str
    description: str
    image: str
    issuer_hex: str
    issuer_npub: str
    issuer_name: Optional[str] = None


class CreateDefinitionResponse(BaseModel):
    """Response for badge definition creation"""
    success: bool
    a_tag: Optional[str] = None
    event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class AwardBadgeResponse(BaseModel):
    """Response for badge award"""
    success: bool
    award_event_id: Optional[str] = None
    recipients_count: int = 0
    verified_relays: int = 0
    error: Optional[str] = None


class DeleteBadgeResponse(BaseModel):
    """Response for badge deletion (NIP-09)"""
    success: bool
    deletion_event_id: Optional[str] = None
    deleted_events: int = 0
    published_relays: int = 0
    verified_relays: int = 0
    error: Optional[str] = None


class PendingBadgeResponse(BaseModel):
    """Response for a pending badge"""
    award_event_id: str
    a_tag: str
    badge_name: str
    badge_description: str
    badge_image: Optional[str] = None
    issuer_hex: str
    issuer_npub: str
    issuer_name: Optional[str] = None
    issuer_picture: Optional[str] = None


class AcceptedBadgeResponse(BaseModel):
    """Response for an accepted badge"""
    a_tag: str
    award_event_id: str
    badge_name: str
    badge_description: Optional[str] = None
    badge_image: Optional[str] = None
    issuer_hex: str
    issuer_npub: str
    issuer_name: Optional[str] = None
    issuer_picture: Optional[str] = None


class AcceptBadgeResultResponse(BaseModel):
    """Response for badge acceptance"""
    success: bool
    profile_event_id: Optional[str] = None
    total_badges: int = 0
    verified_relays: int = 0
    error: Optional[str] = None


class RemoveBadgeResultResponse(BaseModel):
    """Response for badge removal"""
    success: bool
    remaining_badges: int = 0
    verified_relays: int = 0
    error: Optional[str] = None


class RelayStatusResponse(BaseModel):
    """Response for relay status"""
    url: str
    status: str  # "configured"


class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None

