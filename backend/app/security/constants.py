"""
ACCESSOS Security Constants & Limits (Phase 11)
Consolidated security definitions, boundaries, regexes, and data classifications.
"""

from enum import Enum
from typing import Set, Dict, List
import re

# Schema Version
SECURITY_VERSION: int = 1

# Data Classification Model
class DataClassification(str, Enum):
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    PERSONAL = "PERSONAL"
    SENSITIVE = "SENSITIVE"
    HIGHLY_SENSITIVE = "HIGHLY_SENSITIVE"


# Security Error Codes
class SecurityErrorCode(str, Enum):
    INVALID_INPUT = "INVALID_INPUT"
    POLICY_BLOCKED = "POLICY_BLOCKED"
    SENSITIVE_DATA_BLOCKED = "SENSITIVE_DATA_BLOCKED"
    UNSUPPORTED_CONTENT = "UNSUPPORTED_CONTENT"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    PROMPT_INJECTION_DETECTED = "PROMPT_INJECTION_DETECTED"
    UNAUTHORIZED_DESTINATION = "UNAUTHORIZED_DESTINATION"
    SCHEMA_VIOLATION = "SCHEMA_VIOLATION"


# Bounded Size & Depth Limits
MAX_STRING_LENGTH: int = 10000
MAX_INSTRUCTION_LENGTH: int = 500
MAX_PAYLOAD_BYTES: int = 524288  # 512 KB
MAX_DOCUMENT_BYTES: int = 10485760  # 10 MB
MAX_DOCUMENT_PAGES: int = 20
MAX_ARRAY_ITEMS: int = 100
MAX_OBJECT_DEPTH: int = 5
MAX_PROMPT_CHARS: int = 12000
MAX_AI_RESPONSE_CHARS: int = 16000

# Redaction Tokens
REDACTION_PASSWORD = "[REDACTED_PASSWORD]"
REDACTION_TOKEN = "[REDACTED_TOKEN]"
REDACTION_OTP = "[REDACTED_OTP]"
REDACTION_CVV = "[REDACTED_CVV]"
REDACTION_CARD = "[REDACTED_CARD]"
REDACTION_BANK = "[REDACTED_BANK_ACCOUNT]"
REDACTION_GOV_ID = "[REDACTED_GOV_ID]"
REDACTION_PATH = "[LOCAL_PATH]"

# Sensitive Pattern Regexes
REGEX_PASSWORD_FIELD = re.compile(
    r'(?:password|passwd|pwd|secret|auth_key|private_key|token)',
    re.IGNORECASE
)

REGEX_OTP = re.compile(
    r'\b((?:otp|code|one[ -]?time[ -]?password|pin|verification[ -]?code)[=:\s]{1,4})[0-9]{4,8}\b',
    re.IGNORECASE
)

REGEX_BEARER_TOKEN = re.compile(
    r'\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:ghp|gho|ghu|glpat|xoxb|xoxp|sk_live|sk_test)_[a-zA-Z0-9]{16,})\b',
    re.IGNORECASE
)

REGEX_CREDIT_CARD = re.compile(
    r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11})\b'
)

REGEX_CVV = re.compile(
    r'\b((?:cvv|cvc|cid|security[ -]?code)[=:\s]{1,3})[0-9]{3,4}\b',
    re.IGNORECASE
)

REGEX_SSN = re.compile(
    r'\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b'
)

REGEX_AADHAAR = re.compile(
    r'\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b'
)

REGEX_BANK_ACCOUNT = re.compile(
    r'\b((?:acct|account|acc)[_#\s-]*[no\.]*[:\s]{1,3})[0-9]{9,18}\b',
    re.IGNORECASE
)

REGEX_WINDOWS_PATH = re.compile(
    r'\b[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+\b'
)

REGEX_UNIX_PATH = re.compile(
    r'(?:^|[\s"\'=])(/(?:etc|var|usr|home|tmp|opt|root|bin)/[a-zA-Z0-9_\-\./]+)'
)

REGEX_HTML_TAGS = re.compile(
    r'<\/?(?:script|style|iframe|object|embed|applet|form|input|button|link|meta)[^>]*>',
    re.IGNORECASE
)

# Prompt Injection Delimiters & Signatures
PROMPT_INJECTION_PATTERNS: List[re.Pattern] = [
    re.compile(r'ignore\s+(?:all\s+)?previous\s+instructions', re.IGNORECASE),
    re.compile(r'disregard\s+(?:all\s+)?prior\s+guidelines', re.IGNORECASE),
    re.compile(r'system\s+prompt\s*:', re.IGNORECASE),
    re.compile(r'you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|admin|god|jailbreak)', re.IGNORECASE),
    re.compile(r'bypass\s+all\s+(?:safety|security|rules)', re.IGNORECASE),
    re.compile(r'execute\s+(?:the\s+following\s+)?(?:script|command|action)\s*:', re.IGNORECASE),
    re.compile(r'execute_script\s*\(', re.IGNORECASE),
    re.compile(r'new\s+Function\s*\(', re.IGNORECASE),
]

# Allowlisted Network Destinations (Egress Inventory)
ALLOWLISTED_AI_HOSTS: Set[str] = {
    "api.openai.com",
    "generativelanguage.googleapis.com",
    "openrouter.ai",
}

ALLOWLISTED_LOCAL_HOSTS: Set[str] = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
}
