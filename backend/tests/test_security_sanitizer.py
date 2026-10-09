"""
Backend Security Sanitizer Tests (Phase 11)
Tests password, token, OTP, CVV, card, government ID, path, and HTML redaction.
"""

from app.security import (
    sanitize_text,
    strip_html,
    redact_sensitive_credentials,
    sanitize_url,
    classify_data,
    sanitize_data_structure,
    DataClassification,
    REDACTION_PASSWORD,
    REDACTION_TOKEN,
    REDACTION_OTP,
    REDACTION_CARD,
    REDACTION_CVV,
    REDACTION_BANK,
    REDACTION_GOV_ID,
    REDACTION_PATH,
)


def test_strip_html_removes_scripts_and_tags():
    raw = "<script>alert('xss')</script><p>Normal text</p><iframe src='evil.com'></iframe>"
    cleaned = strip_html(raw)
    assert "<script>" not in cleaned
    assert "<iframe>" not in cleaned
    assert "Normal text" in cleaned


def test_redact_sensitive_credentials_tokens_and_passwords():
    raw = "Here is my secret token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and key sk_live_1234567890abcdef12345"
    redacted = redact_sensitive_credentials(raw)
    assert REDACTION_TOKEN in redacted
    assert "eyJhbGciOi" not in redacted
    assert "sk_live_" not in redacted


def test_redact_sensitive_credentials_cards_and_cvv():
    raw = "My Visa card is 4111111111111111 and CVV: 123"
    redacted = redact_sensitive_credentials(raw)
    assert REDACTION_CARD in redacted
    assert "4111111111111111" not in redacted
    assert REDACTION_CVV in redacted


def test_redact_sensitive_credentials_otp_and_pins():
    raw = "Your one-time password is OTP: 849201 for login verification"
    redacted = redact_sensitive_credentials(raw)
    assert REDACTION_OTP in redacted
    assert "849201" not in redacted


def test_redact_sensitive_credentials_government_ids():
    raw = "Aadhaar number: 3829 4819 5012 and SSN: 123-45-6789"
    redacted = redact_sensitive_credentials(raw)
    assert REDACTION_GOV_ID in redacted
    assert "123-45-6789" not in redacted
    assert "3829 4819 5012" not in redacted


def test_redact_sensitive_credentials_filesystem_paths():
    raw_win = "Error reading file C:\\Users\\Administrator\\secrets.json"
    redacted_win = redact_sensitive_credentials(raw_win)
    assert REDACTION_PATH in redacted_win
    assert "C:\\Users" not in redacted_win

    raw_unix = "Checked configuration at /etc/shadow and /home/user/key.pem"
    redacted_unix = redact_sensitive_credentials(raw_unix)
    assert REDACTION_PATH in redacted_unix
    assert "/etc/shadow" not in redacted_unix


def test_sanitize_url_removes_auth_query_params():
    url = "https://example.com/api/v1?token=secret123&page=1&auth=bearer_token"
    sanitized = sanitize_url(url)
    assert REDACTION_TOKEN in sanitized
    assert "secret123" not in sanitized
    assert "bearer_token" not in sanitized
    assert "page=1" in sanitized


def test_classify_data_semantics():
    assert classify_data("password", "value") == DataClassification.HIGHLY_SENSITIVE
    assert classify_data("authToken", "value") == DataClassification.HIGHLY_SENSITIVE
    assert classify_data("cvv", "value") == DataClassification.HIGHLY_SENSITIVE
    assert classify_data("applicant_income", 10000) == DataClassification.SENSITIVE
    assert classify_data("first_name", "Aarav") == DataClassification.PERSONAL
    assert classify_data("system_status", "ACTIVE") == DataClassification.INTERNAL
    assert classify_data("button_label", "Click here") == DataClassification.PUBLIC


def test_sanitize_data_structure_recursive_and_depth_limits():
    nested = {
        "user": {
            "name": "Dev",
            "password": "SecretPassword123",
            "metadata": {
                "l1": {
                    "l2": {
                        "l3": {
                            "l4": "Too deep"
                        }
                    }
                }
            }
        },
        "items": ["<script>evil()</script>", "safe item"],
    }

    sanitized = sanitize_data_structure(nested)
    assert sanitized["user"]["password"] == REDACTION_PASSWORD
    assert sanitized["user"]["name"] == "Dev"
    assert "<script>" not in sanitized["items"][0]
    # Check depth cutoff
    assert sanitized["user"]["metadata"]["l1"]["l2"]["l3"]["l4"] == "[DEPTH_LIMIT_REACHED]"
