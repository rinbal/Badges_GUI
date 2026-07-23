"""
Badges Router - Badge creation and awarding endpoints

Supports two authentication flows:
- NIP-07: Frontend signs events, sends signed_event in request body
- nsec: Backend signs events using X-Nsec header
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Header
from ..models.requests import (
    SyncTemplatesRequest,
    CreateBadgeDefinitionRequest,
    AwardBadgeRequest,
    CreateAndAwardRequest,
    DeleteBadgeRequest
)
from ..models.responses import (
    BadgeTemplateResponse,
    CreateDefinitionResponse,
    AwardBadgeResponse,
    DeleteBadgeResponse,
    ErrorResponse
)
from ..services.badge_service import BadgeService
from ..services.template_service import TemplateService
from ..services.key_service import KeyService
from ..services.profile_service import ProfileService
from ..config import settings

router = APIRouter(prefix="/badges", tags=["Badges"])


def get_nsec_from_header(x_nsec: Optional[str], required: bool = True) -> Optional[str]:
    """Validate and return nsec from header

    Args:
        x_nsec: The X-Nsec header value
        required: If True, raises 401 if missing. If False, returns None if missing.
    """
    if not x_nsec:
        if required:
            raise HTTPException(status_code=401, detail="Missing X-Nsec header")
        return None

    is_valid, _, error = KeyService.validate_nsec(x_nsec)
    if not is_valid:
        raise HTTPException(status_code=401, detail=f"Invalid key: {error}")

    return x_nsec


def get_auth_context(x_nsec: Optional[str], x_pubkey: Optional[str]) -> tuple:
    """
    Get authentication context from headers.
    Returns (nsec, pubkey_hex, is_nip07)

    For NIP-07: X-Pubkey header provides the user's pubkey
    For nsec: X-Nsec header provides the private key (pubkey derived)
    """
    if x_pubkey:
        # NIP-07 flow: pubkey provided directly
        if len(x_pubkey) != 64 or not all(c in '0123456789abcdef' for c in x_pubkey.lower()):
            raise HTTPException(status_code=400, detail="Invalid X-Pubkey format (must be 64-char hex)")
        return None, x_pubkey, True

    if x_nsec:
        # nsec flow: derive pubkey from nsec
        is_valid, key_info, error = KeyService.validate_nsec(x_nsec)
        if not is_valid:
            raise HTTPException(status_code=401, detail=f"Invalid key: {error}")
        return x_nsec, key_info["hex"], False

    raise HTTPException(status_code=401, detail="Missing authentication (X-Nsec or X-Pubkey header)")


def get_badge_service_for_publish() -> BadgeService:
    """Get a BadgeService instance for publish-only operations (NIP-07 flow)"""
    # Use a dummy nsec since we won't be signing - just publishing
    # The BadgeService only needs nsec for signing; publish_signed_event doesn't use it
    return BadgeService.__new__(BadgeService)


class PublishOnlyBadgeService:
    """Minimal service for publishing pre-signed events (NIP-07 flow)"""

    def __init__(self):
        from relay_manager import RelayManager
        self.relay_urls = settings.relay_urls

    async def publish_signed_event(self, signed_event: dict) -> dict:
        """Publish a pre-signed event to relays"""
        from relay_manager import RelayManager
        try:
            print(f"  → Publishing pre-signed event (kind {signed_event.get('kind')}) to {len(self.relay_urls)} relays")

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)
            relay_manager.print_summary()

            published_count = sum(1 for r in results if r.published or r.verified)
            verified_count = sum(1 for r in results if r.verified)

            if published_count > 0:
                return {
                    "success": True,
                    "event_id": signed_event.get("id"),
                    "published_relays": published_count,
                    "verified_relays": verified_count
                }
            else:
                return {
                    "success": False,
                    "event_id": signed_event.get("id"),
                    "error": "No relay accepted the event"
                }
        except Exception as e:
            print(f"  ❌ Exception publishing signed event: {e}")
            return {"success": False, "error": str(e)}


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
async def get_user_templates(
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get user's badge templates from Nostr relays (NIP-78 kind 30078).
    Requires authentication (X-Nsec or X-Pubkey header).
    """
    _, pubkey_hex, _ = get_auth_context(x_nsec, x_pubkey)
    service = TemplateService()
    templates = await service.fetch_templates(pubkey_hex)
    return [BadgeTemplateResponse(**t) for t in templates]


@router.post("/templates/sync")
async def sync_templates(
    request: SyncTemplatesRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Sync user templates to Nostr relays (NIP-78 kind 30078).

    NIP-07: provide signed_event (backend publishes pre-signed kind 30078 event)
    nsec: provide action + data (backend fetches current list, applies change, signs, publishes)
    """
    service = TemplateService()

    if request.signed_event:
        # NIP-07 flow: publish pre-signed event
        if request.signed_event.kind != 30078:
            raise HTTPException(status_code=400, detail="signed_event must be kind 30078")
        result = await service.publish_signed_event(request.signed_event.model_dump())
    else:
        # nsec flow: apply change and publish
        nsec = get_nsec_from_header(x_nsec)
        if not request.action:
            raise HTTPException(status_code=400, detail="action required for nsec flow")
        result = await service.sync_templates(
            nsec=nsec,
            action=request.action,
            template=request.template,
            identifier=request.identifier
        )

    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Failed to publish"))

    return result


@router.post("/create-definition", response_model=CreateDefinitionResponse)
async def create_definition(
    request: CreateBadgeDefinitionRequest,
    x_nsec: Optional[str] = Header(None)
):
    """
    Create and publish a badge definition (kind 30009)

    Supports two flows:
    - NIP-07: Include signed_event in request body (no X-Nsec header needed)
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"📝 NIP-07 flow: Publishing pre-signed badge definition")
        service = PublishOnlyBadgeService()
        result = await service.publish_signed_event(request.signed_event.model_dump())

        # Extract a_tag from the signed event tags
        a_tag = None
        for tag in request.signed_event.tags:
            if tag[0] == "d" and len(tag) > 1:
                a_tag = f"30009:{request.signed_event.pubkey}:{tag[1]}"
                break

        return CreateDefinitionResponse(
            success=result.get("success", False),
            a_tag=a_tag,
            event_id=result.get("event_id"),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"📝 nsec flow: Creating and signing badge definition")

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

    Supports two flows:
    - NIP-07: Include signed_event in request body (no X-Nsec header needed)
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    # NIP-07 flow: signed event provided
    if request.signed_event:
        print(f"🏅 NIP-07 flow: Publishing pre-signed badge award")
        service = PublishOnlyBadgeService()
        result = await service.publish_signed_event(request.signed_event.model_dump())

        # Count recipients from tags
        recipients_count = sum(1 for tag in request.signed_event.tags if tag[0] == "p")

        return AwardBadgeResponse(
            success=result.get("success", False),
            award_event_id=result.get("event_id"),
            recipients_count=recipients_count,
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"🏅 nsec flow: Creating and signing badge award")

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

    Supports two flows:
    - NIP-07: Include signed_definition_event and signed_award_event (no X-Nsec needed)
    - nsec: Omit signed events, include X-Nsec header (backend signs both)
    """
    # NIP-07 flow: both signed events provided
    if request.signed_definition_event and request.signed_award_event:
        print(f"🎯 NIP-07 flow: Publishing pre-signed definition and award")
        service = PublishOnlyBadgeService()

        # Publish definition
        def_result = await service.publish_signed_event(request.signed_definition_event.model_dump())
        if not def_result.get("success"):
            return {
                "success": False,
                "error": def_result.get("error", "Failed to publish badge definition")
            }

        # Extract a_tag
        a_tag = None
        for tag in request.signed_definition_event.tags:
            if tag[0] == "d" and len(tag) > 1:
                a_tag = f"30009:{request.signed_definition_event.pubkey}:{tag[1]}"
                break

        # Publish award
        award_result = await service.publish_signed_event(request.signed_award_event.model_dump())
        recipients_count = sum(1 for tag in request.signed_award_event.tags if tag[0] == "p")

        return {
            "success": award_result.get("success", False),
            "a_tag": a_tag,
            "definition_event_id": def_result.get("event_id"),
            "award_event_id": award_result.get("event_id"),
            "recipients_count": recipients_count,
            "published_relays": award_result.get("published_relays", 0),
            "verified_relays": award_result.get("verified_relays", 0),
            "error": award_result.get("error")
        }

    # nsec flow: backend signs
    nsec = get_nsec_from_header(x_nsec)
    print(f"🎯 nsec flow: Creating and signing definition and award")

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


@router.get("/delete/events")
async def get_badge_events_for_deletion(
    a_tag: str,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Get event IDs for a badge (definition + awards) needed to build a deletion event.
    Used by NIP-07 flow: frontend needs the event IDs to sign the kind 5 event.

    Args:
        a_tag: Badge definition a-tag (e.g. "30009:pubkey:identifier")
    """
    _, pubkey_hex, _ = get_auth_context(x_nsec, x_pubkey)

    parts = a_tag.split(":")
    if len(parts) != 3 or parts[0] != "30009":
        raise HTTPException(status_code=400, detail="Invalid a_tag format")

    issuer_hex = parts[1]
    if issuer_hex != pubkey_hex:
        raise HTTPException(status_code=403, detail="Only the badge issuer can delete this badge")

    from ..services.badge_service import BadgeQueryService
    query_service = BadgeQueryService()
    result = await query_service.get_badge_event_ids(a_tag)
    return result


@router.post("/delete", response_model=DeleteBadgeResponse)
async def delete_badge(
    request: DeleteBadgeRequest,
    x_nsec: Optional[str] = Header(None),
    x_pubkey: Optional[str] = Header(None)
):
    """
    Delete an issued badge and all its awards (NIP-09 kind 5)

    Publishes a kind 5 deletion event targeting the badge definition (kind 30009)
    and all award events (kind 8). Only the original issuer can delete.

    Supports two flows:
    - NIP-07: Include signed_event in request body (no X-Nsec header needed)
    - nsec: Omit signed_event, include X-Nsec header (backend signs)
    """
    # NIP-07 flow: pre-signed deletion event
    if request.signed_event:
        print(f"🗑️  NIP-07 flow: Publishing pre-signed deletion event")
        service = PublishOnlyBadgeService()
        result = await service.publish_signed_event(request.signed_event.model_dump())

        return DeleteBadgeResponse(
            success=result.get("success", False),
            deletion_event_id=result.get("event_id"),
            deleted_events=len([t for t in request.signed_event.tags if t[0] in ("e", "a")]),
            published_relays=result.get("published_relays", 0),
            verified_relays=result.get("verified_relays", 0),
            error=result.get("error")
        )

    # nsec flow: backend queries for events and signs deletion
    nsec = get_nsec_from_header(x_nsec)
    print(f"🗑️  nsec flow: Deleting badge {request.a_tag}")

    badge_service = BadgeService(nsec)
    result = await badge_service.delete_badge(request.a_tag)

    return DeleteBadgeResponse(
        success=result.get("success", False),
        deletion_event_id=result.get("deletion_event_id"),
        deleted_events=result.get("deleted_events", 0),
        published_relays=result.get("published_relays", 0),
        verified_relays=result.get("verified_relays", 0),
        error=result.get("error")
    )


@router.get("/owners")
async def get_badge_owners(
    a_tag: str,
    limit: int = 50,
    include_profiles: bool = True
):
    """
    Discover all users who have accepted a specific badge.

    Queries Nostr relays for Profile Badges events (current kind 10008 and
    legacy kind 30008) that contain the specified badge a_tag.

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

