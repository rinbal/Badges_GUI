"""
Request Models - Pydantic schemas for API inputs

Supports both:
- NIP-07: Frontend signs events, sends signed_event in request
- nsec: Backend signs events using X-Nsec header
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
import re

# Identifier validation: lowercase letters, numbers, and hyphens only
# Must start and end with alphanumeric, hyphens allowed in middle
IDENTIFIER_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$')
IDENTIFIER_MAX_LENGTH = 64


def validate_badge_identifier(value: str) -> str:
    """Validate badge identifier format."""
    if not value:
        raise ValueError("Identifier is required")

    if len(value) > IDENTIFIER_MAX_LENGTH:
        raise ValueError(f"Identifier must be {IDENTIFIER_MAX_LENGTH} characters or less")

    if not IDENTIFIER_PATTERN.match(value):
        raise ValueError(
            "Identifier must contain only lowercase letters, numbers, and hyphens. "
            "Must start and end with a letter or number."
        )

    return value


class SignedNostrEvent(BaseModel):
    """A fully signed Nostr event from NIP-07 extension"""
    id: str = Field(..., description="Event ID (32-byte hex)")
    pubkey: str = Field(..., description="Event author pubkey (32-byte hex)")
    created_at: int = Field(..., description="Unix timestamp")
    kind: int = Field(..., description="Event kind")
    tags: List[List[str]] = Field(..., description="Event tags")
    content: str = Field(..., description="Event content")
    sig: str = Field(..., description="Event signature (64-byte hex)")


class ValidateKeyRequest(BaseModel):
    """Request to validate a private key"""
    nsec: str = Field(..., description="Private key in nsec format", min_length=60)


class CreateBadgeTemplateRequest(BaseModel):
    """Request to create a new badge template"""
    identifier: str = Field(
        ...,
        description="Unique badge identifier (lowercase, numbers, hyphens only)",
        min_length=1,
        max_length=IDENTIFIER_MAX_LENGTH
    )
    name: str = Field(..., description="Badge display name", min_length=1, max_length=100)
    description: str = Field("", description="Badge description", max_length=500)
    image: str = Field("", description="Badge image URL", max_length=500)

    @field_validator('identifier')
    @classmethod
    def check_identifier(cls, v):
        return validate_badge_identifier(v)


class CreateBadgeDefinitionRequest(BaseModel):
    """Request to create and publish a badge definition

    For NIP-07 users: Include signed_event (backend will validate and publish)
    For nsec users: Omit signed_event (backend will create and sign using X-Nsec header)
    """
    identifier: str = Field(
        ...,
        description="Unique badge identifier (lowercase, numbers, hyphens only)",
        min_length=1,
        max_length=IDENTIFIER_MAX_LENGTH
    )
    name: str = Field(..., description="Badge display name", min_length=1, max_length=100)
    description: str = Field("", description="Badge description", max_length=500)
    image: str = Field("", description="Badge image URL", max_length=500)
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed event from NIP-07 extension (kind 30009)"
    )

    @field_validator('identifier')
    @classmethod
    def check_identifier(cls, v):
        return validate_badge_identifier(v)


class AwardBadgeRequest(BaseModel):
    """Request to award a badge to recipients

    For NIP-07 users: Include signed_event (backend will validate and publish)
    For nsec users: Omit signed_event (backend will create and sign using X-Nsec header)
    """
    a_tag: str = Field(..., description="Badge definition A-tag (30009:pubkey:identifier)")
    recipients: List[str] = Field(..., description="List of recipient pubkeys (npub or hex)")
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed event from NIP-07 extension (kind 8)"
    )


class CreateAndAwardRequest(BaseModel):
    """Request to create badge definition and award in one call

    For NIP-07 users: Include signed_definition_event and signed_award_event
    For nsec users: Omit signed events (backend will create and sign using X-Nsec header)
    """
    identifier: str = Field(
        ...,
        description="Unique badge identifier (lowercase, numbers, hyphens only)",
        min_length=1,
        max_length=IDENTIFIER_MAX_LENGTH
    )
    name: str = Field(..., description="Badge display name", min_length=1, max_length=100)
    description: str = Field("", description="Badge description", max_length=500)
    image: str = Field("", description="Badge image URL", max_length=500)
    recipients: List[str] = Field(..., description="List of recipient pubkeys", min_length=1)
    signed_definition_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed badge definition event (kind 30009)"
    )
    signed_award_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed badge award event (kind 8)"
    )

    @field_validator('identifier')
    @classmethod
    def check_identifier(cls, v):
        return validate_badge_identifier(v)


class AcceptBadgeRequest(BaseModel):
    """Request to accept a badge

    For NIP-07 users: Include signed_event (profile badges event kind 30008)
    For nsec users: Omit signed_event (backend will create and sign using X-Nsec header)
    """
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID (64-char hex)")
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed profile badges event (kind 30008)"
    )


class RemoveBadgeRequest(BaseModel):
    """Request to remove an accepted badge

    For NIP-07 users: Include signed_event (updated profile badges event kind 30008)
    For nsec users: Omit signed_event (backend will create and sign using X-Nsec header)
    """
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID")
    signed_event: Optional[SignedNostrEvent] = Field(
        None,
        description="Pre-signed profile badges event (kind 30008)"
    )

