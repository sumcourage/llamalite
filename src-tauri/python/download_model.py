#!/usr/bin/env python3
"""
Llamalite ModelScope Model Downloader

Downloads models from ModelScope. Progress and status are communicated
via log messages (JSON lines on stdout). No progress bar or pause support —
ModelScope does not expose a pause/resume API or reliable progress callback.

Usage:
    python download_model.py <repo_id> <local_dir> [--filename NAME] [--token TOKEN]
                             [--companion NAME]

Protocol:
    - stdout: JSON lines with log/complete/error messages
    - stderr: ModelScope internal logs (forwarded to UI by Rust backend)
    - Exit code: 0 for success, non-zero for failure

Companion files:
    Vision models (OCR, image understanding) require a separate multimodal
    projector (mmproj) file. When --companion is given, it is downloaded
    after the main file and its local path is reported via companionPath.
"""

import sys
import json
import os
import time
import argparse
import logging

# Force stderr to be line-buffered so tqdm and log messages appear
# immediately in the pipe (without this, C runtime fully buffers stderr
# when it's not connected to a TTY, causing output to only appear on flush/exit).
try:
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

# Retry configuration
MAX_RETRIES = 5
INITIAL_BACKOFF = 3  # seconds
BACKOFF_MULTIPLIER = 2


def send_message(msg_type: str, repo_id: str, **kwargs):
    """Send a message to stdout as JSON."""
    msg = {"type": msg_type, "repo_id": repo_id}
    msg.update(kwargs)
    print(json.dumps(msg), flush=True)


def send_log(message: str, repo_id: str, level: str = "info", local_path: str = ""):
    """Send a log message."""
    send_message("log", repo_id, message=message, level=level, localPath=local_path)


def send_complete(repo_id: str, path: str, local_path: str = "", companion_path: str = ""):
    """Send a completion message."""
    send_message(
        "complete",
        repo_id,
        path=path,
        localPath=local_path or path,
        companionPath=companion_path,
    )


def send_error(repo_id: str, error: str, local_path: str = ""):
    """Send an error message."""
    send_message("error", repo_id, error=error, localPath=local_path)


# ── Utilities ──────────────────────────────────────────────────────────────

def get_modelscope_cache_dir(repo_id: str) -> str:
    """Get the ModelScope cache directory for a repo."""
    cache_dir = os.environ.get(
        "MODELSCOPE_CACHE",
        os.path.join(os.path.expanduser("~"), ".cache", "modelscope"),
    )
    repo_dir_name = "models--" + repo_id.replace("/", "--")
    return os.path.join(cache_dir, "hub", repo_dir_name)


# ── ModelScope logging ─────────────────────────────────────────────────────

def setup_modelscope_logging():
    """Enable verbose logging for ModelScope so its internal messages
    are written to stderr and captured by the Rust backend.

    Uses DEBUG level because ModelScope logs download operations at DEBUG.
    Also fixes child loggers that may have propagate=False, ensuring all
    ModelScope sub-logger messages reach our stderr handler.
    """
    formatter = logging.Formatter("[%(name)s] %(levelname)s: %(message)s")

    # ── Top-level modelscope logger → DEBUG ──
    ms_logger = logging.getLogger("modelscope")
    ms_logger.setLevel(logging.DEBUG)
    ms_logger.propagate = True

    has_stderr_handler = any(
        isinstance(h, logging.StreamHandler) and h.stream is sys.stderr
        for h in ms_logger.handlers
    )
    if not has_stderr_handler:
        handler = logging.StreamHandler(sys.stderr)
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(formatter)
        ms_logger.addHandler(handler)

    # ── Fix ALL child loggers (modelscope.hub.*, etc.) ──
    # Some ModelScope sub-loggers set propagate=False, which blocks their
    # messages from reaching the parent logger's handler. We force propagate=True
    # and set DEBUG level so all internal messages are captured.
    for name in list(ms_logger.manager.loggerDict.keys()):
        if name.startswith("modelscope."):
            child = ms_logger.manager.loggerDict[name]
            if isinstance(child, logging.Logger):
                child.propagate = True
                if child.level == logging.NOTSET or child.level > logging.DEBUG:
                    child.setLevel(logging.DEBUG)

    # ── Suppress noisy third-party loggers ──
    for noisy in ("urllib3", "requests", "filelock", "charset_normalizer", "certifi"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ── Retry logic ────────────────────────────────────────────────────────────

def is_retryable_error(exc: Exception) -> bool:
    """Check if an exception is retryable (network-related)."""
    error_str = str(exc).lower()
    retryable_keywords = [
        "connection", "remotehost", "remote host",
        "10054", "10053", "10060", "10061",
        "timeout", "timed out", "temporarily unavailable",
        "connectionreseterror", "connectionabortederror",
        "connectionrefusederror", "remotedisconnected",
        "chunkedencoding", "protocolerror",
        "incomplete",
        "servererror", "500", "502", "503", "504",
        "snapshot_download", "model_file_download",
    ]
    return any(kw in error_str for kw in retryable_keywords)


def download_with_retry(func, repo_id: str, local_path: str, max_retries: int = MAX_RETRIES):
    """Execute a download function with retry and exponential backoff."""
    last_exception = None
    backoff = INITIAL_BACKOFF

    for attempt in range(1, max_retries + 1):
        try:
            return func()
        except KeyboardInterrupt:
            raise
        except Exception as e:
            last_exception = e
            if not is_retryable_error(e) or attempt >= max_retries:
                raise
            send_log(
                f"下载出错 (尝试 {attempt}/{max_retries}): {e}",
                repo_id, "warning", local_path=local_path,
            )
            send_log(
                f"等待 {backoff} 秒后重试...",
                repo_id, "info", local_path=local_path,
            )
            time.sleep(backoff)
            backoff = min(backoff * BACKOFF_MULTIPLIER, 60)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Download model from ModelScope")
    parser.add_argument("repo_id", help="ModelScope repository ID")
    parser.add_argument("local_dir", help="Local directory to save the model")
    parser.add_argument("--token", default=None, help="ModelScope access token")
    parser.add_argument("--filename", default=None, help="Specific filename to download")
    parser.add_argument(
        "--companion",
        default=None,
        help="Companion file (e.g. mmproj-*.gguf) to download after the main file",
    )

    args = parser.parse_args()

    repo_id = args.repo_id
    local_dir = args.local_dir

    send_log(f"目标目录: {local_dir}", repo_id, local_path=local_dir)

    # ── Import ModelScope ──
    try:
        from modelscope import snapshot_download
        from modelscope.hub.file_download import model_file_download
        import modelscope
        ms_version = getattr(modelscope, "__version__", "unknown")
        send_log(f"ModelScope 版本: {ms_version}", repo_id)
    except ImportError as e:
        send_error(repo_id, f"modelscope 未安装: {e}", local_path=local_dir)
        sys.exit(1)

    # ── Enable verbose ModelScope logging → stderr ──
    setup_modelscope_logging()

    # Verify stderr channel works (this line should always appear in UI)
    print(f"[download] ModelScope {ms_version} ready, logging enabled", file=sys.stderr, flush=True)

    try:
        os.makedirs(local_dir, exist_ok=True)

        if args.filename:
            # ── Single file download ──
            send_log(f"开始下载: {args.filename}", repo_id, local_path=local_dir)
            print(f"[download] Downloading {args.filename} from {repo_id}", file=sys.stderr, flush=True)
            print(f"[download] Target: {local_dir}", file=sys.stderr, flush=True)

            def do_download():
                return model_file_download(
                    model_id=repo_id,
                    file_path=args.filename,
                    local_dir=local_dir,
                    token=args.token,
                )

            result = download_with_retry(do_download, repo_id, local_dir)

            print(f"[download] File saved: {result}", file=sys.stderr, flush=True)
            send_log(f"文件已保存: {result}", repo_id, "success", local_path=local_dir)

            # ── Companion file (e.g. mmproj for vision models) ──
            companion_result = ""
            if args.companion and args.companion != args.filename:
                send_log(
                    f"开始下载配套文件: {args.companion}",
                    repo_id, "info", local_path=local_dir,
                )
                print(
                    f"[download] Companion: {args.companion}",
                    file=sys.stderr, flush=True,
                )

                def do_companion():
                    return model_file_download(
                        model_id=repo_id,
                        file_path=args.companion,
                        local_dir=local_dir,
                        token=args.token,
                    )

                try:
                    companion_result = download_with_retry(
                        do_companion, repo_id, local_dir
                    )
                    print(
                        f"[download] Companion saved: {companion_result}",
                        file=sys.stderr, flush=True,
                    )
                    send_log(
                        f"配套文件已保存: {companion_result}",
                        repo_id, "success", local_path=local_dir,
                    )
                except Exception as e:
                    # Main model is already downloaded — report the companion
                    # failure as a warning and still complete, so the user keeps
                    # a usable (text-only) model instead of losing everything.
                    print(
                        f"[download] Companion failed: {e}",
                        file=sys.stderr, flush=True,
                    )
                    send_log(
                        f"配套文件下载失败: {e}",
                        repo_id, "warning", local_path=local_dir,
                    )
                    companion_result = ""

            send_complete(
                repo_id, result,
                local_path=local_dir,
                companion_path=companion_result or "",
            )
        else:
            # ── Repository (snapshot) download ──
            send_log(f"开始下载仓库: {repo_id}", repo_id, local_path=local_dir)
            print(f"[download] Snapshot download: {repo_id}", file=sys.stderr, flush=True)
            print(f"[download] Target: {local_dir}", file=sys.stderr, flush=True)
            cache_dir = get_modelscope_cache_dir(repo_id)
            print(f"[download] Cache:  {cache_dir}", file=sys.stderr, flush=True)

            def do_snapshot():
                return snapshot_download(
                    repo_id,
                    local_dir=local_dir,
                    token=args.token,
                    ignore_patterns=["*.pt", "*.pth", "*.bin"],
                )

            result = download_with_retry(do_snapshot, repo_id, local_dir)

            print(f"[download] Snapshot saved: {result}", file=sys.stderr, flush=True)
            send_log(f"仓库已保存: {result}", repo_id, "success", local_path=local_dir)
            send_complete(repo_id, result, local_path=local_dir)

    except KeyboardInterrupt:
        send_log("下载被用户中断", repo_id, "warning", local_path=local_dir)
        send_error(repo_id, "下载已中断", local_path=local_dir)
        sys.exit(130)
    except Exception as e:
        send_log(f"下载失败: {e}", repo_id, "error", local_path=local_dir)
        send_error(repo_id, str(e), local_path=local_dir)
        sys.exit(1)


if __name__ == "__main__":
    main()
