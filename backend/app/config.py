"""
Application Configuration
Loads settings from environment and config files
"""

import json
from pathlib import Path
from typing import List
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    app_name: str = "Nostr Badges API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # CORS Settings
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    
    # Paths (relative to project root)
    project_root: Path = Path(__file__).parent.parent.parent
    common_path: Path = project_root / "common"
    badge_tool_path: Path = project_root / "badge_tool"
    badge_inbox_path: Path = project_root / "badge_inbox"
    
    @property
    def relay_urls(self) -> List[str]:
        """Load relay URLs from config.json"""
        config_path = self.badge_tool_path / "config.json"
        try:
            with open(config_path, "r") as f:
                config = json.load(f)
                return config.get("relay_urls", [])
        except Exception:
            return [
                "wss://relay.damus.io",
                "wss://nos.lol",
                "wss://nostr.wine",
            ]
    
    @property
    def badge_definitions_path(self) -> Path:
        """Path to badge definition templates"""
        return self.badge_tool_path / "badges" / "definitions"
    
    class Config:
        env_file = ".env"


# Global settings instance
settings = Settings()

