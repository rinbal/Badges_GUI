"""
Request Models - Pydantic schemas for API inputs
"""

from typing import List, Optional
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
    """Request to create and publish a badge definition"""
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


class AwardBadgeRequest(BaseModel):
    """Request to award a badge to recipients"""
    a_tag: str = Field(..., description="Badge definition A-tag (30009:pubkey:identifier)")
    recipients: List[str] = Field(..., description="List of recipient pubkeys (npub or hex)")


class CreateAndAwardRequest(BaseModel):
    """Request to create badge definition and award in one call"""
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

    @field_validator('identifier')
    @classmethod
    def check_identifier(cls, v):
        return validate_badge_identifier(v)


class AcceptBadgeRequest(BaseModel):
    """Request to accept a badge"""
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID (64-char hex)")


class RemoveBadgeRequest(BaseModel):
    """Request to remove an accepted badge"""
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID")

