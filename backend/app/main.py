"""
Nostr Badges API - Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import (
    auth_router,
    badges_router,
    inbox_router,
    profile_router,
    relays_router,
    requests_router,
    surf_router
)

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    REST API for Nostr Badges (NIP-58)
    
    ## Features
    
    * **Badge Creation** - Create and publish badge definitions
    * **Badge Awarding** - Award badges to recipients
    * **Badge Inbox** - View and manage pending/accepted badges
    * **Profile** - View public profile and badges
    
    ## Authentication
    
    Most endpoints require authentication via the `X-Nsec` header.
    The private key is never stored - it's only used for signing events.
    """,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(badges_router, prefix="/api/v1")
app.include_router(inbox_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(relays_router, prefix="/api/v1")
app.include_router(requests_router, prefix="/api/v1")
app.include_router(surf_router, prefix="/api/v1")


@app.get("/")
async def root():
    """API root - health check"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

