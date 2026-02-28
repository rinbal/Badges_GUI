"""
Blossom Media Proxy - CORS proxy for blossom server list requests
"""

import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/blossom", tags=["Blossom Media"])


class BlossomListRequest(BaseModel):
    server: str
    pubkey: str
    auth: str | None = None


@router.post("/list")
async def blossom_list(request: BlossomListRequest):
    """
    Proxy GET {server}/list/{pubkey} to bypass CORS restrictions.
    On 401/403, retries without auth header (some servers don't need it).
    Returns an empty array if the server responds with non-JSON content.
    """
    url = f"{request.server.rstrip('/')}/list/{request.pubkey}"
    headers = {}
    if request.auth:
        headers["Authorization"] = f"Nostr {request.auth}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, headers=headers)

            # If auth failed, retry without auth header
            if resp.status_code in (401, 403) and request.auth:
                resp = await client.get(url)

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Blossom server returned {resp.status_code}"
                )

            try:
                data = resp.json()
            except (json.JSONDecodeError, ValueError):
                # Server returned non-JSON (HTML error page, empty body, etc.)
                return []

            # Ensure we always return a list
            if isinstance(data, list):
                return data
            return []

        except HTTPException:
            raise
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Blossom server timeout")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach blossom server: {str(e)}")
