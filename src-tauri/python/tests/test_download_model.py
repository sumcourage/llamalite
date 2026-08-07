#!/usr/bin/env python3
"""
Tests for download_model.py

Tests the three helper functions (send_progress, send_complete, send_error)
by capturing stdout and verifying the JSON output format and field correctness.

Usage:
    cd src-tauri/python
    python -m pytest tests/test_download_model.py -v
"""

import os
import sys
import json
import pytest

# Add the parent directory so that "import download_model" works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import download_model


# ---------------------------------------------------------------------------
# 1. Module import test
# ---------------------------------------------------------------------------

class TestImport:
    """Verify that the three helper functions can be imported from the module."""

    def test_import_send_progress(self):
        assert hasattr(download_model, "send_progress")
        assert callable(download_model.send_progress)

    def test_import_send_complete(self):
        assert hasattr(download_model, "send_complete")
        assert callable(download_model.send_complete)

    def test_import_send_error(self):
        assert hasattr(download_model, "send_error")
        assert callable(download_model.send_error)


# ---------------------------------------------------------------------------
# 2-4. JSON format tests (valid JSON via capsys)
# ---------------------------------------------------------------------------

class TestJsonFormat:
    """Each helper must print a single valid JSON line to stdout."""

    def test_send_progress_outputs_valid_json(self, capsys):
        download_model.send_progress(50, 100, "downloading", "test/repo")
        captured = capsys.readouterr()
        raw = captured.out.strip()
        parsed = json.loads(raw)
        assert isinstance(parsed, dict)

    def test_send_complete_outputs_valid_json(self, capsys):
        download_model.send_complete("test/repo", "/some/path")
        captured = capsys.readouterr()
        raw = captured.out.strip()
        parsed = json.loads(raw)
        assert isinstance(parsed, dict)

    def test_send_error_outputs_valid_json(self, capsys):
        download_model.send_error("test/repo", "An error occurred")
        captured = capsys.readouterr()
        raw = captured.out.strip()
        parsed = json.loads(raw)
        assert isinstance(parsed, dict)

    def test_send_progress_flushes_stdout(self, capsys):
        """Verify flush=True is used (captured output should not be buffered)."""
        download_model.send_progress(0, 0, "test", "test/repo")
        captured = capsys.readouterr()
        assert captured.out.strip() != ""


# ---------------------------------------------------------------------------
# 5. send_progress field correctness
# ---------------------------------------------------------------------------

class TestProgressFields:
    """send_progress JSON must contain: type, repo_id, current, total, status."""

    PROGRESS_ARGS = (42, 200, "processing chunk", "Qwen/Qwen2.5-7B-Instruct-GGUF")

    @pytest.fixture
    def progress_data(self, capsys):
        download_model.send_progress(*self.PROGRESS_ARGS)
        captured = capsys.readouterr()
        return json.loads(captured.out.strip())

    def test_type_field(self, progress_data):
        assert progress_data["type"] == "progress"

    def test_repo_id_field(self, progress_data):
        assert progress_data["repo_id"] == self.PROGRESS_ARGS[3]

    def test_current_field(self, progress_data):
        assert progress_data["current"] == self.PROGRESS_ARGS[0]
        assert isinstance(progress_data["current"], int)

    def test_total_field(self, progress_data):
        assert progress_data["total"] == self.PROGRESS_ARGS[1]
        assert isinstance(progress_data["total"], int)

    def test_status_field(self, progress_data):
        assert progress_data["status"] == self.PROGRESS_ARGS[2]
        assert isinstance(progress_data["status"], str)

    def test_no_extra_fields(self, progress_data):
        expected_keys = {"type", "repo_id", "current", "total", "status"}
        assert set(progress_data.keys()) == expected_keys


# ---------------------------------------------------------------------------
# 6. send_complete field correctness
# ---------------------------------------------------------------------------

class TestCompleteFields:
    """send_complete JSON must contain: type, repo_id, path."""

    COMPLETE_REPO = "Qwen/Qwen2.5-7B-Instruct-GGUF"
    COMPLETE_PATH = "/models/Qwen2.5-7B-Instruct-GGUF"

    @pytest.fixture
    def complete_data(self, capsys):
        download_model.send_complete(self.COMPLETE_REPO, self.COMPLETE_PATH)
        captured = capsys.readouterr()
        return json.loads(captured.out.strip())

    def test_type_field(self, complete_data):
        assert complete_data["type"] == "complete"

    def test_repo_id_field(self, complete_data):
        assert complete_data["repo_id"] == self.COMPLETE_REPO

    def test_path_field(self, complete_data):
        assert complete_data["path"] == self.COMPLETE_PATH
        assert isinstance(complete_data["path"], str)

    def test_no_extra_fields(self, complete_data):
        expected_keys = {"type", "repo_id", "path"}
        assert set(complete_data.keys()) == expected_keys


# ---------------------------------------------------------------------------
# 7. send_error field correctness
# ---------------------------------------------------------------------------

class TestErrorFields:
    """send_error JSON must contain: type, repo_id, error."""

    ERROR_REPO = "Qwen/Qwen2.5-7B-Instruct-GGUF"
    ERROR_MSG = "Network timeout after 30 seconds"

    @pytest.fixture
    def error_data(self, capsys):
        download_model.send_error(self.ERROR_REPO, self.ERROR_MSG)
        captured = capsys.readouterr()
        return json.loads(captured.out.strip())

    def test_type_field(self, error_data):
        assert error_data["type"] == "error"

    def test_repo_id_field(self, error_data):
        assert error_data["repo_id"] == self.ERROR_REPO

    def test_error_field(self, error_data):
        assert error_data["error"] == self.ERROR_MSG
        assert isinstance(error_data["error"], str)

    def test_no_extra_fields(self, error_data):
        expected_keys = {"type", "repo_id", "error"}
        assert set(error_data.keys()) == expected_keys


# ---------------------------------------------------------------------------
# Edge-case tests
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Boundary-value and edge-case scenarios."""

    def test_progress_zero_values(self, capsys):
        """current=0, total=0 should still produce valid JSON."""
        download_model.send_progress(0, 0, "idle", "test/repo")
        captured = capsys.readouterr()
        data = json.loads(captured.out.strip())
        assert data["current"] == 0
        assert data["total"] == 0

    def test_progress_large_values(self, capsys):
        """Large integer values should be serialized correctly."""
        download_model.send_progress(2**31 - 1, 2**31, "large", "test/repo")
        captured = capsys.readouterr()
        data = json.loads(captured.out.strip())
        assert data["current"] == 2**31 - 1
        assert data["total"] == 2**31

    def test_error_empty_string(self, capsys):
        """Empty error string should be acceptable."""
        download_model.send_error("test/repo", "")
        captured = capsys.readouterr()
        data = json.loads(captured.out.strip())
        assert data["error"] == ""

    def test_complete_path_with_spaces(self, capsys):
        """Path with spaces should be preserved correctly."""
        download_model.send_complete("test/repo", "/my models/test model")
        captured = capsys.readouterr()
        data = json.loads(captured.out.strip())
        assert data["path"] == "/my models/test model"

    def test_stderr_not_used(self, capsys):
        """Helper functions should write to stdout, not stderr."""
        download_model.send_progress(1, 10, "test", "test/repo")
        captured = capsys.readouterr()
        assert captured.err == ""

    def test_output_is_single_line(self, capsys):
        """Each call should produce exactly one line of output."""
        download_model.send_progress(1, 10, "test", "test/repo")
        download_model.send_complete("test/repo", "/path")
        download_model.send_error("test/repo", "err")
        captured = capsys.readouterr()
        lines = [l for l in captured.out.strip().split("\n") if l]
        assert len(lines) == 3