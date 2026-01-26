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

    # Characters allowed in badge identifiers (lowercase alphanumeric and hyphens)
    IDENTIFIER_PATTERN = r'^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'

    def __init__(self, issuer_nsec: str):
        """Initialize with issuer's private key"""
        self.badge_creator = BadgeCreator(issuer_nsec)
        # Use all relays from config.json
        self.relay_urls = settings.relay_urls

    @staticmethod
    def validate_identifier(identifier: str) -> Tuple[bool, Optional[str]]:
        """
        Validate badge identifier for safety and format.
        Returns (is_valid, error_message).
        """
        import re

        if not identifier:
            return False, "Identifier is required"

        if len(identifier) > 64:
            return False, "Identifier must be 64 characters or less"

        # Block path traversal attempts
        if '..' in identifier or '/' in identifier or '\\' in identifier:
            return False, "Identifier contains invalid characters"

        # Must match pattern: lowercase alphanumeric and hyphens
        if not re.match(BadgeService.IDENTIFIER_PATTERN, identifier):
            return False, "Identifier must be lowercase letters, numbers, and hyphens only"

        return True, None

    def get_issuer_info(self) -> Dict[str, str]:
        """Get issuer public key info"""
        return self.badge_creator.get_issuer_info()
    
    @staticmethod
    def _load_templates_from_dir(directory: Path) -> List[Dict[str, Any]]:
        """Load badge templates from a directory of JSON files"""
        templates = []

        if not directory.exists():
            return templates

        for file in directory.glob("*.json"):
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
    def get_app_templates() -> List[Dict[str, Any]]:
        """
        Load app-provided badge templates (read-only).
        These come from badge_tool/badges/definitions/
        """
        return BadgeService._load_templates_from_dir(settings.app_templates_path)

    @staticmethod
    def get_user_templates() -> List[Dict[str, Any]]:
        """
        Load user-created badge templates.
        These are stored in backend/data/user_templates/
        """
        return BadgeService._load_templates_from_dir(settings.user_templates_path)

    @staticmethod
    def get_templates() -> List[Dict[str, Any]]:
        """Deprecated: Returns user templates only for backward compatibility"""
        return BadgeService.get_user_templates()

    @staticmethod
    def save_template(template: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Save a new user badge template to JSON file.
        Returns (success, error_message).

        Note: Only saves to user templates directory, not app templates.
        """
        identifier = template.get("identifier", "")

        # Validate identifier for safety
        is_valid, error = BadgeService.validate_identifier(identifier)
        if not is_valid:
            return False, error

        # Check if identifier conflicts with app templates
        app_templates = BadgeService.get_app_templates()
        if any(t["identifier"] == identifier for t in app_templates):
            return False, "Cannot use an identifier reserved by app templates"

        try:
            user_dir = settings.user_templates_path
            user_dir.mkdir(parents=True, exist_ok=True)

            # Create NIP-58 compliant badge data
            badge_data = {
                "kind": 30009,
                "tags": [
                    ["d", identifier],
                    ["name", template["name"]],
                    ["description", template.get("description", "")],
                    ["image", template.get("image", "")]
                ],
                "content": f"Badge definition: {template['name']}"
            }

            file_path = user_dir / f"{identifier}.json"
            with open(file_path, "w") as f:
                json.dump(badge_data, f, indent=2)

            return True, None
        except Exception as e:
            print(f"Error saving template: {e}")
            return False, "Failed to save template"

    @staticmethod
    def delete_template(identifier: str) -> Tuple[bool, Optional[str]]:
        """
        Delete a user badge template JSON file.
        Returns (success, error_message).

        Note: Only deletes from user templates directory. App templates cannot be deleted.
        """
        # Validate identifier for safety
        is_valid, error = BadgeService.validate_identifier(identifier)
        if not is_valid:
            return False, error

        # Check if trying to delete an app template
        app_templates = BadgeService.get_app_templates()
        if any(t["identifier"] == identifier for t in app_templates):
            return False, "App templates cannot be deleted"

        try:
            user_dir = settings.user_templates_path
            file_path = user_dir / f"{identifier}.json"

            if not file_path.exists():
                return False, "Template not found"

            file_path.unlink()
            return True, None
        except Exception as e:
            print(f"Error deleting template: {e}")
            return False, "Failed to delete template"

    @staticmethod
    def update_template(identifier: str, template: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Update an existing user badge template.
        Returns (success, error_message).

        Note: Only updates user templates. App templates cannot be modified.
        The identifier cannot be changed - only name, description, and image.
        """
        # Validate identifier for safety
        is_valid, error = BadgeService.validate_identifier(identifier)
        if not is_valid:
            return False, error

        # Check if trying to update an app template
        app_templates = BadgeService.get_app_templates()
        if any(t["identifier"] == identifier for t in app_templates):
            return False, "App templates cannot be modified"

        try:
            user_dir = settings.user_templates_path
            file_path = user_dir / f"{identifier}.json"

            if not file_path.exists():
                return False, "Template not found"

            # Create NIP-58 compliant badge data with updated values
            badge_data = {
                "kind": 30009,
                "tags": [
                    ["d", identifier],
                    ["name", template["name"]],
                    ["description", template.get("description", "")],
                    ["image", template.get("image", "")]
                ],
                "content": f"Badge definition: {template['name']}"
            }

            with open(file_path, "w") as f:
                json.dump(badge_data, f, indent=2)

            return True, None
        except Exception as e:
            print(f"Error updating template: {e}")
            return False, "Failed to update template"

    async def publish_signed_event(self, signed_event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Publish a pre-signed event (from NIP-07) to relays.
        No signing needed - just validate and publish.
        """
        try:
            print(f"  → Publishing pre-signed event (kind {signed_event.get('kind')}) to {len(self.relay_urls)} relays")

            relay_manager = RelayManager()
            results = await relay_manager.publish_event(signed_event, self.relay_urls)
            relay_manager.print_summary()

            published_count = sum(1 for r in results if r.published or r.verified)
            verified_count = sum(1 for r in results if r.verified)

            if published_count > 0:
                print(f"  ✅ Pre-signed event delivered to {published_count} relay(s)")
                return {
                    "success": True,
                    "event_id": signed_event.get("id"),
                    "published_relays": published_count,
                    "verified_relays": verified_count
                }
            else:
                print("  ❌ Pre-signed event could not be delivered to any relay")
                return {
                    "success": False,
                    "event_id": signed_event.get("id"),
                    "published_relays": 0,
                    "verified_relays": 0,
                    "error": "No relay accepted the event"
                }
        except Exception as e:
            print(f"  ❌ Exception publishing signed event: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    async def create_definition(self, badge_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create and publish a badge definition (kind 30009)"""
        try:
            print(f"  → Publishing to {len(self.relay_urls)} relays: {self.relay_urls}")
            result = await self.badge_creator.publish_badge_definition(
                badge_data, self.relay_urls
            )

            print(f"  → Result status: {result.get('status')}")
            print(f"  → Published: {result.get('published_relays', 0)}, Verified: {result.get('verified_relays', 0)}")

            return {
                "success": result["status"] == "success",
                "a_tag": result.get("a_tag"),
                "event_id": result.get("event", {}).get("id"),
                "published_relays": result.get("published_relays", 0),
                "verified_relays": result.get("verified_relays", 0),
                "error": result.get("error")
            }
        except Exception as e:
            print(f"  ❌ Exception in create_definition: {e}")
            import traceback
            traceback.print_exc()
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
            # Normalize all recipients to hex format (required by Nostr protocol)
            normalized_recipients = []
            for r in recipients:
                try:
                    hex_pubkey = normalize_pubkey(r)
                    print(f"✓ Normalized {r[:20]}... -> {hex_pubkey[:16]}...")
                    normalized_recipients.append(hex_pubkey)
                except Exception as e:
                    print(f"✗ Failed to normalize pubkey: {r} - {e}")
                    return {
                        "success": False,
                        "error": f"Invalid recipient pubkey: {r}"
                    }

            print(f"📋 Awarding badge to {len(normalized_recipients)} recipients (hex format)")

            result = await self.badge_creator.award_badge(
                a_tag, normalized_recipients, self.relay_urls
            )

            return {
                "success": result["status"] == "success",
                "award_event_id": result.get("event", {}).get("id"),
                "recipients_count": len(normalized_recipients),
                "published_relays": result.get("published_relays", 0),
                "verified_relays": result.get("verified_relays", 0),
                "error": result.get("error")
            }
        except Exception as e:
            print(f"❌ Award badge error: {e}")
            import traceback
            traceback.print_exc()
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
        print(f"\n{'='*50}")
        print(f"🎯 CREATE AND AWARD")
        print(f"Badge: {badge_data.get('name')} ({badge_data.get('identifier')})")
        print(f"Recipients: {len(recipients)}")
        print(f"{'='*50}")

        # First create the definition
        print("\n📝 Step 1: Creating badge definition...")
        definition_result = await self.create_definition(badge_data)

        if not definition_result.get("success"):
            print(f"❌ Definition failed: {definition_result.get('error')}")
            return definition_result

        a_tag = definition_result.get("a_tag")
        print(f"✅ Definition created: {a_tag}")

        # Then award the badge
        print("\n🏅 Step 2: Awarding badge...")
        award_result = await self.award_badge(a_tag, recipients)

        if award_result.get("success"):
            print(f"✅ Badge awarded successfully!")
        else:
            print(f"❌ Award failed: {award_result.get('error')}")

        return {
            "success": award_result.get("success"),
            "a_tag": a_tag,
            "definition_event_id": definition_result.get("event_id"),
            "award_event_id": award_result.get("award_event_id"),
            "recipients_count": award_result.get("recipients_count"),
            "published_relays": award_result.get("published_relays"),
            "verified_relays": award_result.get("verified_relays"),
            "error": award_result.get("error")
        }

