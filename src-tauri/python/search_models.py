#!/usr/bin/env python3
"""
Search ModelScope models.

Outputs a JSON array of model info objects to stdout.

Usage:
    python search_models.py <query> [--limit N] [--sort SORT]
"""

import sys
import json
import os
import argparse


def main():
    parser = argparse.ArgumentParser(description="Search ModelScope models")
    parser.add_argument("query", help="Search query string")
    parser.add_argument("--limit", type=int, default=20, help="Max number of results")
    parser.add_argument("--sort", default="downloads", help="Sort field (downloads, likes, lastModified)")

    args = parser.parse_args()

    try:
        from modelscope.hub.api import HubApi
    except ImportError as e:
        print(json.dumps({"error": f"modelscope is not installed: {e}"}))
        sys.exit(1)

    try:
        api = HubApi()

        # Append "GGUF" to search query to prioritize GGUF models
        search_query = args.query
        if "gguf" not in search_query.lower():
            search_query = f"{search_query} GGUF"

        # Use list_repos with search for free-text model search
        page = api.list_repos(
            "model",
            search=search_query,
            sort=args.sort if args.sort else None,
            page_number=1,
            page_size=min(args.limit, 50),
        )

        result = []
        for r in page.items:
            repo_id = getattr(r, "repo_id", "") or getattr(r, "id", "") or ""
            if not repo_id:
                continue

            # Extract owner from repo_id (e.g. "Qwen/Qwen2.5-7B" -> "Qwen")
            parts = repo_id.split("/")
            owner = parts[0] if len(parts) > 1 else ""

            # Get tags
            tags = getattr(r, "tags", []) or []
            if isinstance(tags, list):
                tags = [str(t) for t in tags]
            else:
                tags = []

            # Get tasks
            tasks = getattr(r, "tasks", []) or []

            # Build description from tasks + description field
            description = getattr(r, "description", "") or ""
            display_name = getattr(r, "display_name", "") or ""

            # File size (total repo size)
            file_size = getattr(r, "file_size", None)

            # Last modified
            last_modified = getattr(r, "last_modified", None)
            last_modified_str = ""
            if last_modified:
                last_modified_str = str(last_modified)
                # Try to convert to ISO format
                try:
                    if hasattr(last_modified, "isoformat"):
                        last_modified_str = last_modified.isoformat()
                except Exception:
                    pass

            entry = {
                "model_id": repo_id,
                "author": owner,
                "description": description or display_name,
                "downloads": getattr(r, "downloads", 0) or 0,
                "likes": getattr(r, "likes", 0) or 0,
                "tags": tags,
                "pipeline_tag": tasks[0] if tasks else None,
                "last_modified": last_modified_str,
                "total_size_bytes": int(file_size) if file_size else None,
            }
            result.append(entry)

        print(f"[INFO] Found {len(result)} models for '{args.query}'", file=sys.stderr)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
