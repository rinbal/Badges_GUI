"""
Badge Request Models - Pydantic schemas for NIP-58 Extension (kinds 30058, 30059)

Badge Request (kind 30058): User requests a badge from an issuer
Badge Denial (kind 30059): Issuer denies a badge request
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from .requests import SignedNostrEvent


# =============================================================================
# Request Models (API Inputs)
# =============================================================================

class CreateBadgeRequestRequest(BaseModel):
    """Request to create a badge request (kind 30058)

    For NIP-07 users: Include signed_event
    For nsec users: Omit signed_event (backend signs)
    """
    badge_a_tag: str = Field(
        ...,
        description="Badge definition A-tag (30009:pubkey:identifier)"
    )
    content: str = Field(
        "",
        description="Message to issuer explaining why you want this badge",
        max_length=1000
    )
    proofs: List[str] = Field(
        default_factory=list,
        description="List of proof event IDs (note or zap events)"
    )
    proof_types: List[str] = Field(
        default_factory=list,
        description="Type of each proof: 'note' or 'zap'"
    )
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed badge request event (kind 30058)"
    )


class WithdrawBadgeRequestRequest(BaseModel):
    """Request to withdraw a badge request (kind 30058 with status:withdrawn)

    For NIP-07 users: Include signed_event
    For nsec users: Omit signed_event (backend signs)
    """
    badge_a_tag: str = Field(
        ...,
        description="Badge definition A-tag to withdraw request for"
    )
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed withdrawal event (kind 30058 with status:withdrawn)"
    )


class DenyBadgeRequestRequest(BaseModel):
    """Request to deny a badge request (kind 30059)

    For NIP-07 users: Include signed_event
    For nsec users: Omit signed_event (backend signs)
    """
    request_event_id: str = Field(
        ...,
        description="Event ID of the badge request to deny"
    )
    badge_a_tag: str = Field(
        ...,
        description="Badge definition A-tag"
    )
    requester_pubkey: str = Field(
        ...,
        description="Pubkey of the requester (hex)"
    )
    reason: str = Field(
        "",
        description="Reason for denial (optional)",
        max_length=500
    )
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed denial event (kind 30059)"
    )


class RevokeDenialRequest(BaseModel):
    """Request to revoke a denial (kind 30059 with status:revoked)

    For NIP-07 users: Include signed_event
    For nsec users: Omit signed_event (backend signs)
    """
    request_event_id: str = Field(
        ...,
        description="Event ID of the original request"
    )
    badge_a_tag: str = Field(
        ...,
        description="Badge definition A-tag"
    )
    requester_pubkey: str = Field(
        ...,
        description="Pubkey of the requester (hex)"
    )
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed revocation event (kind 30059 with status:revoked)"
    )


class AwardFromRequestRequest(BaseModel):
    """Request to award a badge from a request (standard kind 8)

    For NIP-07 users: Include signed_event
    For nsec users: Omit signed_event (backend signs)
    """
    request_event_id: str = Field(
        ...,
        description="Event ID of the badge request"
    )
    badge_a_tag: str = Field(
        ...,
        description="Badge definition A-tag"
    )
    requester_pubkey: str = Field(
        ...,
        description="Pubkey of the requester to award (hex)"
    )
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed award event (kind 8)"
    )


# =============================================================================
# Response Models (API Outputs)
# =============================================================================

class ProofInfo(BaseModel):
    """Information about a proof"""
    event_id: str
    proof_type: str  # "note" or "zap"
    verified: bool = False
    # For note proofs
    content: Optional[str] = None
    # For zap proofs
    amount_sats: Optional[int] = None
    sender_pubkey: Optional[str] = None
    sender_name: Optional[str] = None
    # Common
    created_at: Optional[int] = None
    error: Optional[str] = None


class BadgeRequestResponse(BaseModel):
    """Response for a badge request"""
    event_id: str
    badge_a_tag: str
    badge_name: str
    badge_description: Optional[str] = None
    badge_image: Optional[str] = None
    # Requester info (for incoming requests)
    requester_pubkey: Optional[str] = None
    requester_npub: Optional[str] = None
    requester_name: Optional[str] = None
    requester_picture: Optional[str] = None
    # Issuer info (for outgoing requests)
    issuer_pubkey: Optional[str] = None
    issuer_npub: Optional[str] = None
    issuer_name: Optional[str] = None
    issuer_picture: Optional[str] = None
    # Request details
    content: str = ""
    proofs: List[ProofInfo] = []
    state: str = "pending"  # pending, fulfilled, denied, withdrawn
    created_at: int
    # Denial info (if denied)
    denial_reason: Optional[str] = None
    denial_created_at: Optional[int] = None


class CreateBadgeRequestResponse(BaseModel):
    """Response for badge request creation"""
    success: bool
    event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class WithdrawBadgeRequestResponse(BaseModel):
    """Response for badge request withdrawal"""
    success: bool
    event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class DenyBadgeRequestResponse(BaseModel):
    """Response for badge request denial"""
    success: bool
    denial_event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class RevokeDenialResponse(BaseModel):
    """Response for denial revocation"""
    success: bool
    event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class AwardFromRequestResponse(BaseModel):
    """Response for awarding from a request"""
    success: bool
    award_event_id: Optional[str] = None
    verified_relays: int = 0
    error: Optional[str] = None


class IncomingRequestsCountResponse(BaseModel):
    """Response for incoming requests count"""
    count: int
    pending_count: int = 0
