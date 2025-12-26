"""
Request Models - Pydantic schemas for API inputs
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ValidateKeyRequest(BaseModel):
    """Request to validate a private key"""
    nsec: str = Field(..., description="Private key in nsec format", min_length=60)


class CreateBadgeTemplateRequest(BaseModel):
    """Request to create a new badge template"""
    identifier: str = Field(..., description="Unique badge identifier", min_length=1)
    name: str = Field(..., description="Badge display name")
    description: str = Field("", description="Badge description")
    image: str = Field("", description="Badge image URL")


class CreateBadgeDefinitionRequest(BaseModel):
    """Request to create and publish a badge definition"""
    identifier: str = Field(..., description="Unique badge identifier")
    name: str = Field(..., description="Badge display name")
    description: str = Field("", description="Badge description")
    image: str = Field("", description="Badge image URL")


class AwardBadgeRequest(BaseModel):
    """Request to award a badge to recipients"""
    a_tag: str = Field(..., description="Badge definition A-tag (30009:pubkey:identifier)")
    recipients: List[str] = Field(..., description="List of recipient pubkeys (npub or hex)")


class CreateAndAwardRequest(BaseModel):
    """Request to create badge definition and award in one call"""
    identifier: str = Field(..., description="Unique badge identifier")
    name: str = Field(..., description="Badge display name")
    description: str = Field("", description="Badge description")
    image: str = Field("", description="Badge image URL")
    recipients: List[str] = Field(..., description="List of recipient pubkeys")


class AcceptBadgeRequest(BaseModel):
    """Request to accept a badge"""
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID (64-char hex)")


class RemoveBadgeRequest(BaseModel):
    """Request to remove an accepted badge"""
    a_tag: str = Field(..., description="Badge definition A-tag")
    award_event_id: str = Field(..., description="Badge award event ID")

