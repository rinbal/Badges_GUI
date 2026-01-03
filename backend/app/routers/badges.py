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
from ..services.profile_service import ProfileService

router = APIRouter(prefix="/badges", tags=["Badges"])


def get_nsec_from_header(x_nsec: Optional[str]) -> str:
    """Validate and return nsec from header"""
    if not x_nsec:
        raise HTTPException(status_code=401, detail="Missing X-Nsec header")
    
    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")
    
    return x_nsec


@router.get("/templates/app", response_model=List[BadgeTemplateResponse])
async def get_app_templates():
    """
    Get app-provided badge templates (read-only)

    Returns official badge templates provided by the application.
    These templates cannot be modified or deleted.
    No authentication required.
    """
    templates = BadgeService.get_app_templates()
    return [BadgeTemplateResponse(**t) for t in templates]


@router.get("/templates/user", response_model=List[BadgeTemplateResponse])
async def get_user_templates():
    """
    Get user-created badge templates

    Returns custom badge templates created by users.
    These can be modified and deleted.
    No authentication required.
    """
    templates = BadgeService.get_user_templates()
    return [BadgeTemplateResponse(**t) for t in templates]


@router.get("/templates", response_model=List[BadgeTemplateResponse])
async def get_templates():
    """
    Get user badge templates (backward compatibility)

    Deprecated: Use /templates/user or /templates/app instead.
    Returns user templates only.
    """
    templates = BadgeService.get_user_templates()
    return [BadgeTemplateResponse(**t) for t in templates]


@router.post("/templates", response_model=BadgeTemplateResponse)
async def create_template(
    request: CreateBadgeTemplateRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Create a new user badge template

    Saves the template to a JSON file for later use.
    Cannot use identifiers reserved by app templates.
    Requires authentication.
    """
    get_nsec_from_header(x_nsec)  # Validate auth

    success, error = BadgeService.save_template(request.model_dump())

    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to save template")

    return BadgeTemplateResponse(**request.model_dump())


@router.delete("/templates/{identifier}")
async def delete_template(
    identifier: str,
    x_nsec: Optional[str] = Header(None)
):
    """
    Delete a user badge template

    Removes the template JSON file.
    App templates cannot be deleted.
    Requires authentication.
    """
    get_nsec_from_header(x_nsec)  # Validate auth

    success, error = BadgeService.delete_template(identifier)

    if not success:
        status_code = 404 if error == "Template not found" else 400
        if "App templates" in (error or ""):
            status_code = 403
        raise HTTPException(status_code=status_code, detail=error)

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
        "published_relays": result.get("published_relays", 0),
        "verified_relays": result.get("verified_relays", 0),
        "error": result.get("error")
    }


@router.get("/owners")
async def get_badge_owners(
    a_tag: str,
    limit: int = 50,
    include_profiles: bool = True
):
    """
    Discover all users who have accepted a specific badge.

    Queries Nostr relays for kind 30008 (Profile Badges) events
    that contain the specified badge a_tag.

    Args:
        a_tag: Badge identifier in format "30009:pubkey:identifier"
        limit: Maximum number of owners to return (default 50)
        include_profiles: Whether to fetch profile metadata (default True)

    Returns:
        owners: List of owner info (pubkey, npub, name, picture)
        total: Total count of owners found
        badge_info: Basic badge information (name, description, image)
    """
    # Validate a_tag format
    parts = a_tag.split(":")
    if len(parts) != 3 or parts[0] != "30009":
        raise HTTPException(
            status_code=400,
            detail="Invalid a_tag format. Expected '30009:pubkey:identifier'"
        )

    profile_service = ProfileService()
    result = await profile_service.get_badge_owners(a_tag, limit, include_profiles)

    return result

