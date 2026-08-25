"""
Configure Auto-Send — Enable/disable auto-send patterns in app_config.

Reads auto_send_patterns.json (from analyze_patterns.py) and updates Supabase.
"""

import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Supabase credentials not set")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def main(action: str, patterns_file: str = "models/auto_send_patterns.json"):
    supabase = get_supabase()

    if action == "enable":
        if not os.path.exists(patterns_file):
            print(f"[ERROR] Patterns file not found: {patterns_file}")
            print("Run scripts/analyze_patterns.py first.")
            sys.exit(1)

        with open(patterns_file) as f:
            patterns = json.load(f)

        supabase.table("app_config").upsert({
            "key": "auto_send_patterns",
            "value": json.dumps(patterns),
            "description": f"Auto-send eligible patterns ({len(patterns)} patterns)",
        }).execute()

        supabase.table("app_config").upsert({
            "key": "auto_send_enabled",
            "value": "true",
            "description": "Auto-send enabled via pattern analysis",
        }).execute()

        print(f"[OK] Auto-send ENABLED with {len(patterns)} patterns")
        print(f"[ACTION] Restart the application for changes to take effect")

    elif action == "disable":
        supabase.table("app_config").upsert({
            "key": "auto_send_enabled",
            "value": "false",
            "description": "Auto-send disabled",
        }).execute()
        print("[OK] Auto-send DISABLED")

    elif action == "status":
        result = supabase.table("app_config").select("key, value, description").eq("key", "auto_send_enabled").execute()
        enabled = result.data[0]["value"] if result.data else "unknown"
        result2 = supabase.table("app_config").select("key, value, description").eq("key", "auto_send_patterns").execute()
        patterns = json.loads(result2.data[0]["value"]) if result2.data else []
        print(f"Auto-send enabled: {enabled}")
        print(f"Active patterns: {len(patterns)}")
        for p in patterns:
            print(f"  - {p}")

    else:
        print(f"Usage: python {sys.argv[0]} [enable|disable|status]")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Configure auto-send patterns")
    parser.add_argument("action", choices=["enable", "disable", "status"],
                        help="Action to perform")
    parser.add_argument("--patterns-file", default="models/auto_send_patterns.json",
                        help="Path to patterns JSON (default: models/auto_send_patterns.json)")
    args = parser.parse_args()
    main(args.action, args.patterns_file)
