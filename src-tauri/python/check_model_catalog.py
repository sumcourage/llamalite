#!/usr/bin/env python3
"""
Check model catalog: validate ModelScope repos for GGUF availability and get file sizes.

Input: JSON array of repo IDs via stdin or --repos argument.
Output: JSON object mapping repo_id -> { valid, ggufFiles: [{filename, size}] }

Usage:
    python check_model_catalog.py --repos '["Qwen/Qwen2.5-7B-Instruct-GGUF", ...]'
    echo '["Qwen/..."]' | python check_model_catalog.py
"""

import sys
import json
import argparse


def check_repo(api, repo_id):
    """Check a single repo for GGUF files. Returns dict with valid flag and file list."""
    try:
        files = api.get_model_files(repo_id, recursive=True)

        gguf_files = []
        for f in files:
            path = f.get("Path", "") or f.get("path", "")
            size = f.get("Size") or f.get("size")
            if not path:
                continue
            if path.lower().endswith(".gguf"):
                entry = {"filename": path}
                if size is not None and size > 0:
                    entry["size"] = int(size)
                else:
                    entry["size"] = None
                gguf_files.append(entry)

        if gguf_files:
            return {"valid": True, "ggufFiles": gguf_files}
        else:
            # Try -GGUF variant
            gguf_variant = f"{repo_id}-GGUF"
            try:
                files2 = api.get_model_files(gguf_variant, recursive=True)
                gguf_files2 = []
                for f in files2:
                    path = f.get("Path", "") or f.get("path", "")
                    size = f.get("Size") or f.get("size")
                    if not path:
                        continue
                    if path.lower().endswith(".gguf"):
                        entry = {"filename": path}
                        if size is not None and size > 0:
                            entry["size"] = int(size)
                        else:
                            entry["size"] = None
                        gguf_files2.append(entry)

                if gguf_files2:
                    return {
                        "valid": True,
                        "ggufFiles": gguf_files2,
                        "actualRepoId": gguf_variant,
                    }
            except Exception:
                pass

            return {"valid": False, "ggufFiles": [], "error": "No GGUF files found"}

    except Exception as e:
        return {"valid": False, "ggufFiles": [], "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Check model catalog GGUF availability")
    parser.add_argument(
        "--repos",
        default=None,
        help="JSON array of repo IDs to check",
    )
    args = parser.parse_args()

    # Read repo list
    if args.repos:
        try:
            repo_ids = json.loads(args.repos)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid JSON: {e}"}))
            sys.exit(1)
    else:
        # Read from stdin
        try:
            raw = sys.stdin.read()
            repo_ids = json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            print(json.dumps({"error": f"Failed to read repos: {e}"}))
            sys.exit(1)

    if not isinstance(repo_ids, list):
        print(json.dumps({"error": "Expected a JSON array of repo IDs"}))
        sys.exit(1)

    try:
        from modelscope.hub.api import HubApi
    except ImportError as e:
        print(json.dumps({"error": f"modelscope is not installed: {e}"}))
        sys.exit(1)

    api = HubApi()
    results = {}

    for repo_id in repo_ids:
        repo_id = str(repo_id).strip()
        if not repo_id:
            continue
        print(f"Checking {repo_id}...", file=sys.stderr)
        results[repo_id] = check_repo(api, repo_id)

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
