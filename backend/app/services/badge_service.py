"""
Badge Service - Handles badge creation and awarding
Wraps existing badge_creator.py functionality
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "badge_tool"))

from badge_creator import BadgeCreator, normalize_pubkey
from relay_manager import RelayManager
from ..config import settings


class BadgeService:
    """Service for badge operations (creator side)"""
    
    def __init__(self, issuer_nsec: str):
        """Initialize with issuer's private key"""
        self.badge_creator = BadgeCreator(issuer_nsec)
        # Use only first 5 relays for faster operations
        self.relay_urls = settings.relay_urls[:5]
    
    def get_issuer_info(self) -> Dict[str, str]:
        """Get issuer public key info"""
        return self.badge_creator.get_issuer_info()
    
    @staticmethod
    def get_templates() -> List[Dict[str, Any]]:
        """Load available badge templates from JSON files"""
        templates = []
        definitions_dir = settings.badge_definitions_path
        
        if not definitions_dir.exists():
            return templates
        
        for file in definitions_dir.glob("*.json"):
            try:
                with open(file, "r") as f:
                    data = json.load(f)
                    
                # Extract info from tags
                tags = data.get("tags", [])
                identifier = next((tag[1] for tag in tags if tag[0] == "d"), file.stem)
                name = next((tag[1] for tag in tags if tag[0] == "name"), identifier)
                description = next((tag[1] for tag in tags if tag[0] == "description"), "")
                image = next((tag[1] for tag in tags if tag[0] == "image"), "")
                
                templates.append({
                    "identifier": identifier,
                    "name": name,
                    "description": description,
                    "image": image
                })
            except Exception as e:
                print(f"Error loading template {file}: {e}")
        
        return templates
    
    @staticmethod
    def save_template(template: Dict[str, Any]) -> bool:
        """Save a new badge template to JSON file"""
        try:
            definitions_dir = settings.badge_definitions_path
            definitions_dir.mkdir(parents=True, exist_ok=True)
            
            # Create NIP-58 compliant badge data
            badge_data = {
                "kind": 30009,
                "tags": [
                    ["d", template["identifier"]],
                    ["name", template["name"]],
                    ["description", template.get("description", "")],
                    ["image", template.get("image", "")]
                ],
                "content": f"Badge definition: {template['name']}"
            }
            
            file_path = definitions_dir / f"{template['identifier']}.json"
            with open(file_path, "w") as f:
                json.dump(badge_data, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Error saving template: {e}")
            return False
    
    async def create_definition(self, badge_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create and publish a badge definition (kind 30009)"""
        try:
            result = await self.badge_creator.publish_badge_definition(
                badge_data, self.relay_urls
            )
            
            return {
                "success": result["status"] == "success",
                "a_tag": result.get("a_tag"),
                "event_id": result.get("event", {}).get("id"),
                "verified_relays": result.get("verified_relays", 0)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def award_badge(
        self, 
        a_tag: str, 
        recipients: List[str]
    ) -> Dict[str, Any]:
        """Award a badge to recipients (kind 8)"""
        try:
            # Normalize all recipients to hex
            normalized_recipients = []
            for r in recipients:
                try:
                    normalized_recipients.append(normalize_pubkey(r))
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Invalid recipient pubkey: {r}"
                    }
            
            result = await self.badge_creator.award_badge(
                a_tag, normalized_recipients, self.relay_urls
            )
            
            return {
                "success": result["status"] == "success",
                "award_event_id": result.get("event", {}).get("id"),
                "recipients_count": len(normalized_recipients),
                "verified_relays": result.get("verified_relays", 0)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_and_award(
        self,
        badge_data: Dict[str, Any],
        recipients: List[str]
    ) -> Dict[str, Any]:
        """Create badge definition and award in one call"""
        # First create the definition
        definition_result = await self.create_definition(badge_data)
        
        if not definition_result.get("success"):
            return definition_result
        
        a_tag = definition_result.get("a_tag")
        
        # Then award the badge
        award_result = await self.award_badge(a_tag, recipients)
        
        return {
            "success": award_result.get("success"),
            "a_tag": a_tag,
            "definition_event_id": definition_result.get("event_id"),
            "award_event_id": award_result.get("award_event_id"),
            "recipients_count": award_result.get("recipients_count"),
            "verified_relays": award_result.get("verified_relays"),
            "error": award_result.get("error")
        }

