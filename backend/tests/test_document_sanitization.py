"""Unit tests for Document Intelligence sanitization and privacy controls (Phase 9)."""

import pytest
from app.document.sanitization import (
    redact_sensitive_value,
    sanitize_filename,
    sanitize_for_logging,
    truncate_evidence,
)


def test_sanitize_filename_prevents_path_traversal():
    # DOC-07: Prevent path traversal and arbitrary filesystem references
    assert sanitize_filename("../../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\windows\\system32\\cmd.exe") == "cmd.exe"
    assert sanitize_filename("normal_file.pdf") == "normal_file.pdf"
    assert sanitize_filename("") == "unnamed_document"


def test_truncate_evidence():
    long_text = "Word " * 100
    truncated = truncate_evidence(long_text, max_length=50)
    assert len(truncated) <= 50
    assert truncated.endswith("...")


def test_redact_sensitive_value():
    # Mask account numbers or IDs (DOC-17)
    masked_acc = redact_sensitive_value("123456789012")
    assert masked_acc == "****9012"
    assert "12345678" not in masked_acc

    masked_short = redact_sensitive_value("1234")
    assert masked_short == "****"


def test_sanitize_for_logging():
    # DOC-08: Document content is not written to ordinary logs with raw credentials
    log_line = "Processing account 123456789012 with card 4111 2222 3333 4444 and password: secret_password"
    sanitized = sanitize_for_logging(log_line)
    assert "4111" not in sanitized
    assert "123456789012" not in sanitized
    assert "secret_password" not in sanitized
    assert "[CARD-REDACTED]" in sanitized
    assert "[ACCOUNT-REDACTED]" in sanitized
