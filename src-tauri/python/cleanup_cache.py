#!/usr/bin/env python3
"""
Llamalite ModelScope Cache Cleanup

Cleans up cached files for a specific ModelScope repository.
Used when cancelling or deleting a paused download.

Usage:
    python cleanup_cache.py <repo_id>
"""

import sys
import os


def main():
    if len(sys.argv) < 2:
        print("Usage: python cleanup_cache.py <repo_id>")
        sys.exit(1)

    repo_id = sys.argv[1]

    try:
        # ModelScope cache directory — platform-aware
        if os.name == "nt":
            default_cache = os.path.join(
                os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
                "modelscope", "cache"
            )
        else:
            default_cache = os.path.expanduser("~/.cache/modelscope")
        cache_dir = os.environ.get("MODELSCOPE_CACHE", default_cache)
        hub_dir = os.path.join(cache_dir, "hub")

        # Convert repo_id to directory name (e.g., "Qwen/Qwen2.5" -> "Qwen--Qwen2.5")
        repo_dir_name = "models--" + repo_id.replace("/", "--")
        repo_path = os.path.join(hub_dir, repo_dir_name)

        if os.path.exists(repo_path):
            import shutil
            shutil.rmtree(repo_path, ignore_errors=True)
            print(f"Cleaned cache for: {repo_id}")
        else:
            # Also check the download directory for partial downloads
            print(f"No cache found for: {repo_id}")

    except Exception as e:
        print(f"Error cleaning cache: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
