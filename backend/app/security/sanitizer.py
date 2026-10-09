"""
ACCESSOS Central Sanitizer (Phase 11)
Reusable sanitization primitives, credential redaction, path sanitization,
HTML stripping, and structured object bounding.
"""

from typing import Any, Dict, List, Union
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from app.security.constants import (
    DataClassification,
    MAX_STRING_LENGTH,
    MAX_ARRAY_ITEMS,
    MAX_OBJECT_DEPTH,
    REDACTION_PASSWORD,
    REDACTION_TOKEN,
    REDACTION_OTP,
    REDACTION_CVV,
    REDACTION_CARD,
    REDACTION_BANK,
    REDACTION_GOV_ID,
    REDACTION_PATH,
    REGEX_PASSWORD_FIELD,
    REGEX_OTP,
    REGEX_BEARER_TOKEN,
    REGEX_CREDIT_CARD,
    REGEX_CVV,
    REGEX_SSN,
    REGEX_AADHAAR,
    REGEX_BANK_ACCOUNT,
    REGEX_WINDOWS_PATH,
    REGEX_UNIX_PATH,
    REGEX_HTML_TAGS,
)


def strip_html(text: str) -> str:
    """Removes HTML and script tags from untrusted text."""
    if not text or not isinstance(text, str):
        return ""
    # Strip script/style blocks and dangerous HTML tags
    cleaned = REGEX_HTML_TAGS.sub("", text)
    # Also strip general HTML tags if any remain
    cleaned = re.sub(r'<[^>]+>', ' ', cleaned)
    return " ".join(cleaned.split())


def redact_sensitive_credentials(text: str) -> str:
    """
    Redacts passwords, tokens, OTPs, CVVs, card numbers,
    bank accounts, and government IDs from plain text.
    """
    if not text or not isinstance(text, str):
        return ""

    result = text

    # 1. Bearer / API Tokens
    result = REGEX_BEARER_TOKEN.sub(REDACTION_TOKEN, result)

    # 2. Credit Card numbers (13-19 digits matching major issuers)
    result = REGEX_CREDIT_CARD.sub(REDACTION_CARD, result)

    # 3. CVVs
    result = REGEX_CVV.sub(r'\g<1>' + REDACTION_CVV, result)

    # 4. OTPs and PINs
    result = REGEX_OTP.sub(r'\g<1>' + REDACTION_OTP, result)

    # 5. Government IDs (SSN / Aadhaar)
    result = REGEX_SSN.sub(REDACTION_GOV_ID, result)
    result = REGEX_AADHAAR.sub(REDACTION_GOV_ID, result)

    # 6. Bank account numbers
    result = REGEX_BANK_ACCOUNT.sub(r'\g<1>' + REDACTION_BANK, result)

    # 7. Local filesystem paths (Windows & Unix)
    result = REGEX_WINDOWS_PATH.sub(REDACTION_PATH, result)
    result = REGEX_UNIX_PATH.sub(r' ' + REDACTION_PATH, result)

    return result


def sanitize_url(url: str) -> str:
    """Removes sensitive credentials or tokens from URL query parameters."""
    if not url or not isinstance(url, str):
        return ""

    try:
        parsed = urlparse(url)
        if not parsed.query:
            return url

        query_params = parse_qs(parsed.query, keep_blank_values=True)
        sanitized_params = {}

        sensitive_param_keywords = {"token", "auth", "key", "secret", "password", "pwd", "api_key", "session"}

        for param_key, param_values in query_params.items():
            param_lower = param_key.lower()
            if any(kw in param_lower for kw in sensitive_param_keywords):
                sanitized_params[param_key] = [REDACTION_TOKEN]
            else:
                sanitized_params[param_key] = param_values

        new_query = urlencode(sanitized_params, doseq=True, safe="[]")
        return urlunparse(parsed._replace(query=new_query))
    except Exception:
        # If URL parsing fails, return a safe bounded representation
        return url[:256]


def sanitize_text(text: str, max_length: int = MAX_STRING_LENGTH) -> str:
    """
    Complete text sanitization:
    HTML removal, credential redaction, and length bounding.
    """
    if not text or not isinstance(text, str):
        return ""

    cleaned = strip_html(text)
    redacted = redact_sensitive_credentials(cleaned)

    if len(redacted) > max_length:
        return redacted[:max_length] + " [TRUNCATED]"
    return redacted


def classify_data(key: str, value: Any) -> DataClassification:
    """
    Classifies a data item based on key semantics and content.
    """
    key_lower = str(key).lower()

    # Highly sensitive keywords
    highly_sensitive_kw = {
        "password", "passwd", "pwd", "token", "auth", "secret", "otp",
        "pin", "cvv", "cvc", "card_number", "cardnumber", "account_number",
        "bank_account", "ssn", "aadhaar", "private_key"
    }
    if any(kw in key_lower for kw in highly_sensitive_kw):
        return DataClassification.HIGHLY_SENSITIVE

    # Sensitive keywords
    sensitive_kw = {"income", "salary", "address", "domicile", "tax", "dob", "birth", "document_content"}
    if any(kw in key_lower for kw in sensitive_kw):
        return DataClassification.SENSITIVE

    # Personal keywords
    personal_kw = {"name", "first_name", "last_name", "email", "phone", "student", "degree", "education"}
    if any(kw in key_lower for kw in personal_kw):
        return DataClassification.PERSONAL

    # Internal metadata
    internal_kw = {"status", "metrics", "duration", "timestamp", "version", "config", "flags"}
    if any(kw in key_lower for kw in internal_kw):
        return DataClassification.INTERNAL

    return DataClassification.PUBLIC


def sanitize_data_structure(data: Any, depth: int = 0) -> Any:
    """
    Recursively bounds and sanitizes arbitrary objects, dicts, and lists.
    Prevents cyclic reference issues, limits depth, and sanitizes keys/values.
    """
    if depth > MAX_OBJECT_DEPTH:
        return "[DEPTH_LIMIT_REACHED]"

    if isinstance(data, str):
        return sanitize_text(data)

    if isinstance(data, (int, float, bool)) or data is None:
        return data

    if isinstance(data, list):
        bounded_list = data[:MAX_ARRAY_ITEMS]
        return [sanitize_data_structure(item, depth + 1) for item in bounded_list]

    if isinstance(data, dict):
        sanitized_dict: Dict[str, Any] = {}
        for k, v in list(data.items())[:MAX_ARRAY_ITEMS]:
            k_str = str(k)
            classification = classify_data(k_str, v)
            if classification == DataClassification.HIGHLY_SENSITIVE:
                sanitized_dict[k_str] = REDACTION_PASSWORD
            else:
                sanitized_dict[k_str] = sanitize_data_structure(v, depth + 1)
        return sanitized_dict

    return str(data)[:100]
