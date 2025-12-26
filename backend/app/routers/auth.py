"""
Authentication Router - Key validation endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.requests import ValidateKeyRequest
from ..models.responses import KeyValidationResponse
from ..services.key_service import KeyService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/validate", response_model=KeyValidationResponse)
async def validate_key(request: ValidateKeyRequest):
    """
    Validate a private key (nsec) and return public key info
    
    This does NOT store the key - it only validates and returns the corresponding public key.
    """
    is_valid, key_info, error = KeyService.validate_nsec(request.nsec)
    
    if is_valid:
        return KeyValidationResponse(
            valid=True,
            npub=key_info["npub"],
            hex=key_info["hex"]
        )
    else:
        return KeyValidationResponse(
            valid=False,
            error=error
        )

