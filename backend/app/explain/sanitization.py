"""Sanitization and input protection layer for Phase 7 Explain Anything."""
import re
from typing import List, Optional, Tuple
from app.explain.schemas import ExplainSelectionContext

# Regex patterns for sensitive data redaction
SENSITIVE_PATTERNS = [
    # Passwords and secret assignments
    (re.compile(r"(?:password|passwd|pwd|secret|token|bearer|session_token)[\s:=]+[\"']?([^\s\"',;]+)[\"']?", re.IGNORECASE), "[REDACTED_PASSWORD]"),
    # Credit card numbers (13-19 digits, possibly space or hyphen delimited)
    (re.compile(r"\b(?:\d[ -]*?){13,19}\b"), "[REDACTED_CARD_NUMBER]"),
    # CVV / CVC (3-4 digits preceded by cvv/cvc)
    (re.compile(r"\b(?:cvv|cvc|security\s*code)[\s:=]+(\d{3,4})\b", re.IGNORECASE), "[REDACTED_CVV]"),
    # 6-digit OTPs / verification codes
    (re.compile(r"\b(?:otp|one[- ]time\s*password|verification\s*code)[\s:=]+(\d{4,8})\b", re.IGNORECASE), "[REDACTED_OTP]"),
    (re.compile(r"\b\d{6}\b"), "[REDACTED_CODE]"),
    # US SSN (XXX-XX-XXXX)
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
    # Generic API Keys / Tokens (e.g. sk-..., key-..., bearer ...)
    (re.compile(r"\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_\-\.]{20,})\b", re.IGNORECASE), "[REDACTED_API_KEY]"),
    # Bank Account numbers with labels
    (re.compile(r"\b(?:account|acct|iban)[\s#:=]+([a-zA-Z0-9]{8,24})\b", re.IGNORECASE), "[REDACTED_ACCOUNT]"),
]

# Prompt injection patterns
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules|guidelines)", re.IGNORECASE),
    re.compile(r"(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:an?\s+unfiltered|DAN|jailbroken|system\s+administrator)", re.IGNORECASE),
    re.compile(r"(?:print|output|reveal|show|display|leak)\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions|secret\s+key|api\s+key)", re.IGNORECASE),
    re.compile(r"<\s*script\b[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL),
]


class ExplainSanitizer:
    """Sanitizes inbound Explain Anything requests to ensure privacy and safety."""

    MAX_SELECTED_TEXT_LENGTH: int = 1000
    MAX_CONTEXT_LENGTH: int = 500

    @classmethod
    def redact_sensitive_values(cls, text: str) -> Tuple[str, List[str]]:
        """
        Redacts obvious sensitive identifiers (passwords, cards, OTPs, API keys) from text.
        Returns: (sanitized_text, list_of_redaction_notes)
        """
        if not text:
            return "", []

        sanitized = text
        redaction_notes: List[str] = []

        for pattern, placeholder in SENSITIVE_PATTERNS:
            matches = pattern.findall(sanitized)
            if matches:
                sanitized = pattern.sub(placeholder, sanitized)
                note = f"Sensitive pattern detected and redacted with {placeholder}"
                if note not in redaction_notes:
                    redaction_notes.append(note)

        return sanitized, redaction_notes

    @classmethod
    def detect_prompt_injection(cls, text: str) -> Tuple[bool, Optional[str]]:
        """
        Detects adversarial prompt injection attempts in selected webpage text.
        Returns: (is_injection, advisory_note)
        """
        if not text:
            return False, None

        for pattern in PROMPT_INJECTION_PATTERNS:
            if pattern.search(text):
                return True, "Potential prompt injection or command pattern detected in selected webpage text. Enforcing passive explanation mode."

        return False, None

    @classmethod
    def sanitize_request(
        cls,
        selected_text: str,
        context: Optional[ExplainSelectionContext] = None,
        user_goal: Optional[str] = None,
    ) -> Tuple[str, Optional[ExplainSelectionContext], Optional[str], List[str]]:
        """
        Sanitizes and bounds an inbound Explain Anything request.
        Returns: (safe_selected_text, safe_context, safe_user_goal, warnings)
        """
        warnings: List[str] = []

        # 1. Bounds check and truncate selected text
        trimmed_selected = (selected_text or "").strip()
        if len(trimmed_selected) > cls.MAX_SELECTED_TEXT_LENGTH:
            trimmed_selected = trimmed_selected[: cls.MAX_SELECTED_TEXT_LENGTH]
            warnings.append(f"Selected text was truncated to maximum {cls.MAX_SELECTED_TEXT_LENGTH} characters.")

        # 2. Redact sensitive values from selected text
        safe_selected, redact_notes = cls.redact_sensitive_values(trimmed_selected)
        warnings.extend(redact_notes)

        # 3. Check for prompt injection patterns
        is_injection, injection_note = cls.detect_prompt_injection(safe_selected)
        if is_injection and injection_note:
            warnings.append(injection_note)

        # 4. Sanitize context if provided
        safe_context: Optional[ExplainSelectionContext] = None
        if context:
            ctx_before = context.contextBefore or ""
            if len(ctx_before) > cls.MAX_CONTEXT_LENGTH:
                ctx_before = ctx_before[-cls.MAX_CONTEXT_LENGTH :]
            ctx_before, _ = cls.redact_sensitive_values(ctx_before)

            ctx_after = context.contextAfter or ""
            if len(ctx_after) > cls.MAX_CONTEXT_LENGTH:
                ctx_after = ctx_after[: cls.MAX_CONTEXT_LENGTH]
            ctx_after, _ = cls.redact_sensitive_values(ctx_after)

            page_title = (context.pageTitle or "").strip()[:200]
            section_heading = (context.sectionHeading or "").strip()[:200]
            target_el_id = (context.targetElementId or "").strip()[:100]
            role = (context.elementRole or "").strip()[:50]

            safe_context = ExplainSelectionContext(
                pageTitle=page_title or None,
                sectionHeading=section_heading or None,
                targetElementId=target_el_id or None,
                contextBefore=ctx_before or None,
                contextAfter=ctx_after or None,
                elementRole=role or None,
            )

        # 5. Sanitize user goal
        safe_goal: Optional[str] = None
        if user_goal:
            safe_goal, goal_redacts = cls.redact_sensitive_values(user_goal.strip()[:300])
            warnings.extend(goal_redacts)

        return safe_selected, safe_context, safe_goal, warnings
