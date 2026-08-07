#!/usr/bin/env python3
"""
List files in a ModelScope repository.

Outputs a JSON array of file info objects to stdout.
Each object contains: filename, size (bytes).

Usage:
    python list_repo_files.py <repo_id> [--token TOKEN]
"""

import sys
import json
import argparse


def main():
    parser = argparse.ArgumentParser(description="List files in a ModelScope repo")
    parser.add_argument("repo_id", help="ModelScope repository ID (e.g. Qwen/Qwen2.5-7B-Instruct-GGUF)")
    parser.add_argument("--token", default=None, help="ModelScope access token")

    args = parser.parse_args()

    try:
        from modelscope.hub.api import HubApi
    except ImportError as e:
        print(json.dumps({"error": f"modelscope is not installed: {e}"}))
        sys.exit(1)

    try:
        api = HubApi()
        files = api.get_model_files(args.repo_id, recursive=True)

        result = []
        for f in files:
            path = f.get("Path", "") or f.get("path", "")
            size = f.get("Size") or f.get("size")
            if not path:
                continue
            # Skip directories (Size is 0 for directories)
            # We include all entries; the Rust side will filter for .gguf
            entry = {"filename": path}
            if size is not None and size > 0:
                entry["size"] = int(size)
            else:
                entry["size"] = None
            result.append(entry)

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
