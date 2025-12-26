"""
Badges Router - Badge creation and awarding endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header
from ..models.requests import (
    CreateBadgeTemplateRequest,
    CreateBadgeDefinitionRequest,
    AwardBadgeRequest,
    CreateAndAwardRequest
)
from ..models.responses import (
    BadgeTemplateResponse,
    CreateDefinitionResponse,
    AwardBadgeResponse,
    ErrorResponse
)
from ..services.badge_service import BadgeService
from ..services.key_service import KeyService

router = APIRouter(prefix="/badges", tags=["Badges"])


def get_nsec_from_header(x_nsec: Optional[str]) -> str:
    """Validate and return nsec from header"""
    if not x_nsec:
        raise HTTPException(status_code=401, detail="Missing X-Nsec header")
    
    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")
    
    return x_nsec


@router.get("/templates", response_model=List[BadgeTemplateResponse])
async def get_templates():
    """
    Get available badge templates
    
    Returns list of badge templates loaded from JSON files.
    No authentication required.
    """
    templates = BadgeService.get_templates()
    return [BadgeTemplateResponse(**t) for t in templates]


@router.post("/templates", response_model=BadgeTemplateResponse)
async def create_template(
    request: CreateBadgeTemplateRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Create a new badge template
    
    Saves the template to a JSON file for later use.
    Requires authentication.
    """
    get_nsec_from_header(x_nsec)  # Validate auth
    
    success = BadgeService.save_template(request.model_dump())
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save template")
    
    return BadgeTemplateResponse(**request.model_dump())


@router.delete("/templates/{identifier}")
async def delete_template(
    identifier: str,
    x_nsec: Optional[str] = Header(None)
):
    """
    Delete a badge template
    
    Removes the template JSON file.
    Requires authentication.
    """
    get_nsec_from_header(x_nsec)  # Validate auth
    
    success = BadgeService.delete_template(identifier)
    
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True, "message": f"Template '{identifier}' deleted"}


@router.post("/create-definition", response_model=CreateDefinitionResponse)
async def create_definition(
    request: CreateBadgeDefinitionRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Create and publish a badge definition (kind 30009)
    
    This publishes the badge definition to Nostr relays.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    badge_service = BadgeService(nsec)
    
    badge_data = {
        "identifier": request.identifier,
        "name": request.name,
        "description": request.description,
        "image": request.image
    }
    
    result = await badge_service.create_definition(badge_data)
    
    return CreateDefinitionResponse(
        success=result.get("success", False),
        a_tag=result.get("a_tag"),
        event_id=result.get("event_id"),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/award", response_model=AwardBadgeResponse)
async def award_badge(
    request: AwardBadgeRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Award a badge to recipients (kind 8)
    
    Awards an existing badge definition to one or more recipients.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    badge_service = BadgeService(nsec)
    
    result = await badge_service.award_badge(request.a_tag, request.recipients)
    
    return AwardBadgeResponse(
        success=result.get("success", False),
        award_event_id=result.get("award_event_id"),
        recipients_count=result.get("recipients_count", 0),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.post("/create-and-award")
async def create_and_award(
    request: CreateAndAwardRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Create badge definition and award in one call
    
    Convenience endpoint that creates the definition and immediately awards it.
    Requires authentication.
    """
    nsec = get_nsec_from_header(x_nsec)
    
    badge_service = BadgeService(nsec)
    
    badge_data = {
        "identifier": request.identifier,
        "name": request.name,
        "description": request.description,
        "image": request.image
    }
    
    result = await badge_service.create_and_award(badge_data, request.recipients)
    
    return {
        "success": result.get("success", False),
        "a_tag": result.get("a_tag"),
        "definition_event_id": result.get("definition_event_id"),
        "award_event_id": result.get("award_event_id"),
        "recipients_count": result.get("recipients_count", 0),
        "verified_relays": result.get("verified_relays", 0),
        "error": result.get("error")
    }

