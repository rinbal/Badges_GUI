#!/usr/bin/env python3

import json
import sys
import asyncio
import websockets
from pathlib import Path
from nostr.key import PrivateKey, PublicKey

# Import from common directory
sys.path.insert(0, str(Path(__file__).parent.parent / "common"))
from relay_manager import RelayManager
from recipient_acceptance import BadgeAcceptanceManager


# =====================================================================
# Load config.json (auto fallback)
# =====================================================================
def load_config():
    try:
        config_path = Path(__file__).parent / "config.json"
        with open(config_path, "r") as f:
            return json.load(f)
    except Exception:
        print("⚠️ Could not load config.json, using fallback relays.\n")
        return {
            "relay_urls": [
                "wss://relay.damus.io",
                "wss://nos.lol",
                "wss://nostr.wine",
            ]
        }


# =====================================================================
# Validate nsec
# =====================================================================
def is_valid_nsec(value: str) -> bool:
    return value.startswith("nsec1") and len(value) > 20


# =====================================================================
# Ask user for nsec
# =====================================================================
def get_user_nsec():
    while True:
        nsec = input("Enter your private key (nsec): ").strip()

        if not is_valid_nsec(nsec):
            print("❌ Invalid key. Must start with 'nsec1'.\n")
            continue

        try:
            pk = PrivateKey.from_nsec(nsec)
            return nsec, pk.public_key.hex(), pk.public_key.bech32(), pk
        except Exception:
            print("❌ Invalid nsec. Try again.\n")


# =====================================================================
# Robust relay query helper
# =====================================================================
async def query_relay(relay_url, req_id, flt, timeout=7):
    print(f"\n🔍 Querying relay: {relay_url}")
    results = []

    try:
        async with websockets.connect(relay_url, open_timeout=5) as ws:
            await ws.send(json.dumps(["REQ", req_id, flt]))
            print(f"   📤 Sent REQ {req_id}")

            start = asyncio.get_event_loop().time()

            while True:
                if asyncio.get_event_loop().time() - start > timeout:
                    print("   ⏱️ Total timeout reached")
                    break

                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=2.5)
                except asyncio.TimeoutError:
                    print("   ⏱️ Receive timeout")
                    break

                try:
                    data = json.loads(msg)
                except:
                    print("   ⚠️ Invalid JSON ignored")
                    continue

                if not isinstance(data, list):
                    continue

                # EVENT
                if data[0] == "EVENT" and len(data) >= 3 and data[1] == req_id:
                    results.append(data[2])

                # EOSE
                if data[0] == "EOSE" and len(data) >= 2 and data[1] == req_id:
                    print("   🔚 EOSE received")
                    break

    except Exception as e:
        print(f"   ❌ Relay error: {e}")
        return []

    if results:
        print(f"   ➡️ {len(results)} event(s) found")
    else:
        print(f"   ⚠️ No events found")

    return results


# =====================================================================
# Fetch profile metadata (name)
# =====================================================================
async def fetch_profile_name(recipient_hex, relay_urls):
    flt = {
        "kinds": [0],
        "authors": [recipient_hex],
        "limit": 1
    }

    for relay in relay_urls:
        events = await query_relay(relay, "meta_self", flt)
        if events:
            try:
                meta = json.loads(events[0]["content"])
                return meta.get("name") or meta.get("display_name") or "no name"
            except:
                return "no name"

    return "no name"


# =====================================================================
# Fetch accepted badges (Kind 30008)
# =====================================================================
async def fetch_accepted_badges(recipient_hex, relay_urls):
    flt = {
        "kinds": [30008],
        "authors": [recipient_hex],
        "limit": 1
    }

    accepted = set()

    for relay in relay_urls:
        events = await query_relay(relay, "accepted_" + recipient_hex[:8], flt)
        if events:
            tags = events[0].get("tags", [])
            for t in tags:
                if t[0] == "a":
                    accepted.add(t[1])
            break

    return accepted

# =====================================================================
# Load accepted badges with readable info (badge name, issuer name)
# =====================================================================
async def load_accepted_badges(recipient_hex, relay_urls):
    # Request the Kind 30008 profile-badges event
    filter_params = {
        "kinds": [30008],
        "authors": [recipient_hex],
        "limit": 1
    }

    profile_event = None

    for relay in relay_urls:
        events = await query_relay(relay, "accepted_badges_" + recipient_hex[:8], filter_params)
        if events:
            profile_event = events[0]
            break

    if not profile_event:
        return []

    tags = profile_event.get("tags", [])

    # Extract badge-definition (a-tag) + award-event-id (e-tag) pairs
    badge_pairs = []
    last_a_tag = None

    for tag_item in tags:
        if tag_item[0] == "a":
            last_a_tag = tag_item[1]
        elif tag_item[0] == "e" and last_a_tag:
            badge_pairs.append((last_a_tag, tag_item[1]))
            last_a_tag = None

    accepted_badges = []

    # For each accepted badge, load definition + issuer metadata
    for a_tag, award_event_id in badge_pairs:
        try:
            _, issuer_hex, identifier = a_tag.split(":")
        except:
            continue

        issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()

        # Load badge definition (Kind 30009)
        definition_filter = {
            "kinds": [30009],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }

        badge_name = "(unknown badge)"

        for relay in relay_urls:
            def_events = await query_relay(relay, "accepted_badge_def_" + identifier, definition_filter)
            if def_events:
                tag_list = def_events[0].get("tags", [])
                for tag_item in tag_list:
                    if tag_item[0] == "name":
                        badge_name = tag_item[1]
                break

        # Load issuer name (Kind 0)
        issuer_filter = {
            "kinds": [0],
            "authors": [issuer_hex],
            "limit": 1
        }

        issuer_name = "(no name)"

        for relay in relay_urls:
            issuer_events = await query_relay(relay, "accepted_badge_issuer_" + issuer_hex[:8], issuer_filter)
            if issuer_events:
                try:
                    meta = json.loads(issuer_events[0]["content"])
                    issuer_name = meta.get("name") or meta.get("display_name") or issuer_name
                except:
                    pass
                break

        accepted_badges.append({
            "a_tag": a_tag,
            "award_event_id": award_event_id,
            "badge_name": badge_name,
            "issuer_name": issuer_name,
            "issuer_npub": issuer_npub,
            "issuer_hex": issuer_hex,
            "identifier": identifier
        })

    return accepted_badges

# =====================================================================
# Fetch pending badges (Kind 8)
# =====================================================================
async def fetch_pending_badges(recipient_hex, relay_urls):
    print("\n📡 Fetching Kind 8 awards (pending badges)…")

    # 1) Check accepted badges
    accepted_a_tags = await fetch_accepted_badges(recipient_hex, relay_urls)

    # 2) Fetch awards
    flt = {
        "kinds": [8],
        "#p": [recipient_hex],
        "limit": 50
    }

    award_events = []
    for relay in relay_urls:
        events = await query_relay(relay, "awards_" + recipient_hex[:8], flt)
        if events:
            award_events.extend(events)

    # Deduplicate
    seen = set()
    awards = []
    for ev in award_events:
        if ev["id"] not in seen:
            seen.add(ev["id"])
            awards.append(ev)

    pending = []

    # 3) Enrich with badge info & issuer metadata
    for ev in awards:
        # find A-tag
        a_tag = next((x[1] for x in ev.get("tags", []) if x[0] == "a"), None)
        if not a_tag:
            continue

        # skip accepted ones
        if a_tag in accepted_a_tags:
            continue

        try:
            _, issuer_hex, identifier = a_tag.split(":")
        except:
            continue

        issuer_npub = PublicKey(bytes.fromhex(issuer_hex)).bech32()

        # Fetch badge definition
        flt_def = {
            "kinds": [30009],
            "authors": [issuer_hex],
            "#d": [identifier],
            "limit": 1
        }

        badge_name = "(unknown badge)"
        badge_desc = ""

        for relay in relay_urls:
            ev_def = await query_relay(relay, "def_" + identifier, flt_def)
            if ev_def:
                tags = ev_def[0].get("tags", [])
                badge_name = next((t[1] for t in tags if t[0] == "name"), badge_name)
                badge_desc = next((t[1] for t in tags if t[0] == "description"), "")
                break

        # Fetch issuer metadata
        flt_meta = {
            "kinds": [0],
            "authors": [issuer_hex],
            "limit": 1
        }

        issuer_name = "(no name)"

        for relay in relay_urls:
            ev_meta = await query_relay(relay, "meta_" + issuer_hex[:8], flt_meta)
            if ev_meta:
                try:
                    meta = json.loads(ev_meta[0]["content"])
                    issuer_name = meta.get("name") or meta.get("display_name") or issuer_name
                except:
                    pass
                break

        pending.append({
            "award_event_id": ev["id"],
            "issuer_hex": issuer_hex,
            "issuer_npub": issuer_npub,
            "issuer_name": issuer_name,
            "badge_identifier": identifier,
            "badge_name": badge_name,
            "badge_description": badge_desc,
            "a_tag": a_tag,
            "raw_award_event": ev
        })

    return pending


# =====================================================================
# Accept Badge Workflow
# =====================================================================
async def accept_selected_badge(pending, recipient_nsec, relay_urls):
    print("\n🎯 Select a badge to accept:\n")

    for i, b in enumerate(pending, start=1):
        print(f"{i}) {b['badge_name']} — from {b['issuer_name']}")
        print(f"    Award ID: {b['award_event_id']}")
        print(f"    A-tag: {b['a_tag']}\n")

    try:
        sel = int(input("Select number: ").strip())
        if sel < 1 or sel > len(pending):
            print("❌ Invalid selection.\n")
            return False
    except:
        print("❌ Invalid number.\n")
        return False

    badge = pending[sel - 1]

    print("\n📦 Preparing acceptance…")

    manager = BadgeAcceptanceManager(recipient_nsec)

    result = await manager.accept_badge(
        badge["a_tag"],
        badge["award_event_id"],
        relay_urls
    )

    print("\n=====================================")

    if result["status"] == "success":
        print("🎉 SUCCESS: Badge accepted!")
        print(f"📨 Event ID: {result['event']['id']}")
        print(f"🔗 Verified on {result['verified_relays']} relay(s)")
        print(f"🏅 Total badges: {result['total_badges']}")
        print("=====================================\n")
        return True

    print("⚠️ Acceptance finished with status:", result["status"])
    print("=====================================\n")
    return True

# =====================================================================
# Show pending badges
# =====================================================================
def print_pending_list(pending):
    print(f"\n📬 Pending badges: {len(pending)}")
    print()

    for i, b in enumerate(pending, start=1):
        print(f"{i}) {b['badge_name']} — from {b['issuer_name']} ({b['issuer_npub']})")
        print(f"    A-tag:    {b['a_tag']}")
        print(f"    Award ID: {b['award_event_id']}\n")

# =====================================================================
# Display accepted badges
# =====================================================================
def print_accepted_badges(accepted_badges):
    print(f"\n📘 Accepted badges: {len(accepted_badges)}\n")
    for index, badge in enumerate(accepted_badges, start=1):
        print(f"{index}) {badge['badge_name']} — from {badge['issuer_name']}")

# =====================================================================
# Main menu
# =====================================================================
async def main_menu(recipient_nsec, recipient_hex, recipient_npub, relay_urls, pending):
    needs_refresh = False

    while True:
        print("\n*********************")
        print("Menu:")
        print("  1) Refresh badge status")
        print("  2) Accept a badge")
        print("  3) Reject a badge")
        print("  4) Remove accepted badge")
        print("  5) Exit")

        choice = input("Select option: ").strip()

        # ---------------------------------------------------------
        # 1) Always perform full refresh
        # ---------------------------------------------------------
        if choice == "1":
            pending = await fetch_pending_badges(recipient_hex, relay_urls)
            accepted_badges = await load_accepted_badges(recipient_hex, relay_urls)

            print_pending_list(pending)
            print_accepted_badges(accepted_badges)

            needs_refresh = False

        # ---------------------------------------------------------
        # 2) Accept a badge
        # ---------------------------------------------------------
        elif choice == "2":
            if needs_refresh:
                pending = await fetch_pending_badges(recipient_hex, relay_urls)
                needs_refresh = False

            if not pending:
                print("\n❌ No pending badges.\n")
            else:
                changed = await accept_selected_badge(pending, recipient_nsec, relay_urls)
                if changed:
                    needs_refresh = True

        # ---------------------------------------------------------
        # 3) Reject a badge (coming soon)
        # ---------------------------------------------------------
        elif choice == "3":
            print("\nReject workflow coming soon.")

        # ---------------------------------------------------------
        # 4) Remove accepted badge
        # ---------------------------------------------------------
       
        elif choice == "4":
            print("\n📘 Loading accepted badges...\n")

            # Load accepted badges
            accepted_badges = await load_accepted_badges(recipient_hex, relay_urls)

            if not accepted_badges:
                print("\n❌ You have no accepted badges.\n")
                continue

            # Add important notice before selection
            print("\n*********************")
            print("Important:")
            print("Removing a badge will move it back to your pending list")
            print("*********************\n")

            # Show accepted badges
            print_accepted_badges(accepted_badges)

            # User selects one
            try:
                user_choice = int(input("\nSelect a badge to remove: ").strip())
                if user_choice < 1 or user_choice > len(accepted_badges):
                    print("❌ Invalid selection.\n")
                    continue
            except:
                print("❌ Invalid number.\n")
                continue

            badge_to_remove = accepted_badges[user_choice - 1]

            print(f"\n🧹 Removing: {badge_to_remove['badge_name']} — from {badge_to_remove['issuer_name']}")

            # Prepare updated badge list
            remaining_badges = [b for b in accepted_badges if b != badge_to_remove]

            # Convert to pairs
            badge_pairs = [(b["a_tag"], b["award_event_id"]) for b in remaining_badges]

            # Manager
            manager = BadgeAcceptanceManager(recipient_nsec)

            # Build new event
            profile_event = manager.create_merged_profile_badges_event(
                badge_pairs,
                relay_urls
            )

            # Publish updated profile event
            print("\n📡 Publishing updated profile...")
            relay_manager = RelayManager()
            publish_result = await relay_manager.publish_event(profile_event, relay_urls)
            relay_manager.print_summary()

            # --- Improved classification ---
            successful = []
            unsuccessful = []

            for r in publish_result:
                ok_msg = (r.ok_message or "").lower()

                # success if OK True OR message contains "duplicate"
                if r.published is True or "duplicate" in ok_msg:
                    successful.append(r)
                else:
                    unsuccessful.append(r)

            # Final output
            if len(successful) > 0:
                total = len(badge_pairs)
                print("\n=====================================")
                print("🎉 SUCCESS: Badge removed!")
                print(f"🔗 Verified on {len(successful)} relay(s)")
                print(f"🏅 Total badges: {total}")
                print("=====================================\n")

            else:
                print("\n❌ Badge removal failed — no relay accepted the update.")
                print("   Your previous badge list is still active.\n")
        # ---------------------------------------------------------
        # 5) Exit
        # ---------------------------------------------------------
        elif choice == "5":
            confirm = input("\nAre you sure you want to exit? (y/n): ").strip().lower()

            if confirm != "y":
                print("\nReturning to menu...\n")
                continue

            print("\n👋 Goodbye!\n")
            raise SystemExit

# =====================================================================
# Entry point
# =====================================================================
async def main():
    print("==============================")
    print("       Badge Inbox Tool")
    print("==============================\n")

    config = load_config()
    relay_urls = config.get("relay_urls", [])

    # LOGIN
    recipient_nsec, recipient_hex, recipient_npub, pk = get_user_nsec()

    # Load profile name
    profile_name = await fetch_profile_name(recipient_hex, relay_urls)

    # FIRST SCAN
    pending = await fetch_pending_badges(recipient_hex, relay_urls)
    accepted_a_tags = await fetch_accepted_badges(recipient_hex, relay_urls)

    #LOGIN DISPLAY
    print("\n*********************")
    print("You are logged in as:")
    print(recipient_npub)
    print(f"name: {profile_name}\n")

    print(f"\n📬 Pending badges: {len(pending)}\n")
    print(f"📘 Accepted badges: {len(accepted_a_tags)}")

    # Enter main menu
    await main_menu(recipient_nsec, recipient_hex, recipient_npub, relay_urls, pending)

if __name__ == "__main__":
    asyncio.run(main())
