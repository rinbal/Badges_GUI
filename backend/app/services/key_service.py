"""
Key Service - Handles key validation and conversion
"""

import sys
from pathlib import Path
from typing import Dict, Optional, Tuple

# Add common directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "common"))

from nostr.key import PrivateKey, PublicKey


class KeyService:
    """Service for key operations"""
    
    @staticmethod
    def validate_nsec(nsec: str) -> Tuple[bool, Optional[Dict[str, str]], Optional[str]]:
        """
        Validate an nsec private key
        
        Returns:
            (is_valid, key_info, error_message)
        """
        try:
            if not nsec.startswith("nsec1"):
                return False, None, "Key must start with 'nsec1'"
            
            pk = PrivateKey.from_nsec(nsec)
            
            return True, {
                "npub": pk.public_key.bech32(),
                "hex": pk.public_key.hex()
            }, None
            
        except Exception as e:
            return False, None, f"Invalid key: {str(e)}"
    
    @staticmethod
    def npub_to_hex(npub: str) -> str:
        """Convert npub to hex format"""
        if npub.startswith("npub1"):
            pub = PublicKey.from_npub(npub)
            return pub.hex()
        elif len(npub) == 64 and all(c in "0123456789abcdef" for c in npub.lower()):
            return npub.lower()
        else:
            raise ValueError("Invalid pubkey format")
    
    @staticmethod
    def hex_to_npub(hex_key: str) -> str:
        """Convert hex to npub format"""
        if hex_key.startswith("npub1"):
            return hex_key
        elif len(hex_key) == 64 and all(c in "0123456789abcdef" for c in hex_key.lower()):
            pub = PublicKey(bytes.fromhex(hex_key))
            return pub.bech32()
        else:
            raise ValueError("Invalid hex key format")
    
    @staticmethod
    def normalize_pubkey(pubkey: str) -> str:
        """Normalize pubkey to hex format"""
        return KeyService.npub_to_hex(pubkey)

