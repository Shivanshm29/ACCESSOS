"""Tests for AI input sanitization, privacy filter, and payload bounds."""
import json
from app.ai.sanitization import AIAnalysisInputBuilder, scrub_text
from app.core.config import settings


def test_explicit_privacy_filter_scrubs_sensitive_values():
    """
    MANDATORY PHASE 5 TEST (Section 24):
    Verifies that fake sensitive values (passwords, OTPs, account numbers, CVVs, SSNs)
    are strictly scrubbed and never appear in the serialized AI input.
    """
    fake_sensitive_data = {
        "page": {
            "title": "Portal with OTP 123456 and token abcdef",
            "url": "https://portal.example.com?session_token=SECRET_SESSION_TOKEN",
            "hostname": "portal.example.com",
            "pathname": "/apply",
        },
        "representation": {
            "headings": [
                {"id": "h-1", "level": 1, "text": "Enter your OTP 123456"},
            ],
            "sections": [
                {"id": "s-1", "title": "Security Section", "fieldIds": ["f-pwd", "f-otp"]},
            ],
            "fields": [
                {
                    "id": "f-pwd",
                    "accessosId": "accessos-field-pwd",
                    "name": "password",
                    "type": "password",
                    "label": "Account Password",
                    "value": "SECRET_TEST_PASSWORD",  # Sensitive value
                    "sensitive": True,
                    "hasValue": True,
                },
                {
                    "id": "f-otp",
                    "accessosId": "accessos-field-otp",
                    "name": "one_time_code",
                    "type": "text",
                    "label": "OTP Verification Code",
                    "value": "123456",  # Sensitive OTP
                    "hasValue": True,
                },
                {
                    "id": "f-acc",
                    "accessosId": "accessos-field-acc",
                    "name": "bank_account_number",
                    "type": "text",
                    "label": "Bank Account",
                    "value": "123456789012",  # Sensitive account number
                    "hasValue": True,
                },
            ],
            "instructions": [
                {
                    "id": "inst-1",
                    "text": "Your SSN 123-45-6789 or account 123456789012 must match your bank record.",
                }
            ],
        },
        "accessibilityReport": {"findings": []},
        "userGoal": "I want to submit my password SECRET_TEST_PASSWORD and OTP 123456",
    }

    sanitized, is_truncated, notes = AIAnalysisInputBuilder.build_sanitized_input(
        page_meta=fake_sensitive_data["page"],
        representation=fake_sensitive_data["representation"],
        accessibility_report=fake_sensitive_data["accessibilityReport"],
        user_goal=fake_sensitive_data["userGoal"],
    )

    # Inspect the actual serialized payload string
    serialized_payload = json.dumps(sanitized)

    # Must NOT contain the fake sensitive values
    assert "SECRET_TEST_PASSWORD" not in serialized_payload
    assert "SECRET_SESSION_TOKEN" not in serialized_payload
    assert "123456" not in serialized_payload
    assert "123456789012" not in serialized_payload
    assert "123-45-6789" not in serialized_payload

    # Verify structural presence remains preserved without actual secret values
    assert any(f["id"] == "accessos-field-pwd" for f in sanitized["fields"])
    assert any(f["id"] == "accessos-field-otp" for f in sanitized["fields"])
    pwd_field = next(f for f in sanitized["fields"] if f["id"] == "accessos-field-pwd")
    assert pwd_field["sensitive"] is True
    assert pwd_field["hasValue"] is True
    assert "value" not in pwd_field  # field values must NEVER be exposed


def test_payload_limits_and_truncation():
    """Verify that oversized inputs trigger bounded truncation with notes."""
    # Create 50 headings (limit is settings.AI_MAX_HEADINGS = 30)
    oversized_headings = [{"id": f"h-{i}", "level": 2, "text": f"Heading {i}"} for i in range(50)]
    # Create 150 fields (limit is settings.AI_MAX_FIELDS = 100)
    oversized_fields = [
        {"id": f"f-{i}", "name": f"field_{i}", "type": "text", "label": f"Field {i}"}
        for i in range(150)
    ]
    # Create very long instruction (limit is settings.AI_MAX_INSTRUCTION_LENGTH = 300)
    long_instruction = "Important legal terms and statutory requirements. " * 30

    rep = {
        "headings": oversized_headings,
        "sections": [{"id": "s-1", "title": "Main"}],
        "fields": oversized_fields,
        "instructions": [{"id": "inst-long", "text": long_instruction}],
    }

    sanitized, is_truncated, notes = AIAnalysisInputBuilder.build_sanitized_input(
        page_meta={"title": "Large Form", "url": "https://example.com"},
        representation=rep,
    )

    assert is_truncated is True
    assert len(sanitized["headings"]) == settings.AI_MAX_HEADINGS
    assert len(sanitized["fields"]) == settings.AI_MAX_FIELDS
    assert len(notes) >= 2
    assert "[TRUNCATED]" in sanitized["instructions"][0]["text"]
