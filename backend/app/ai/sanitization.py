"""Sanitization and input transformation layer for Phase 5 AI Page Analysis."""
import re
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings

# Sensitive value scrubbing regexes
SENSITIVE_KEY_PATTERNS = re.compile(
    r"(password|passwd|pwd|otp|token|secret|credit_?card|cvv|cvc|ssn|pin|auth)",
    re.IGNORECASE,
)
SENSITIVE_VALUE_PATTERNS = [
    re.compile(r"\b(?:\d[ -]*?){10,19}\b"),  # Bank account numbers and credit card numbers
    re.compile(r"\b\d{6}\b"),                # 6-digit OTPs
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),   # SSN
    re.compile(r"(?:password|pwd|secret|token|session_token)[\s:=]+[\"']?([^\s\"',]+)[\"']?", re.IGNORECASE),
    re.compile(r"\bSECRET_[A-Z0-9_]+\b", re.IGNORECASE),
]


def scrub_text(text: Optional[str]) -> str:
    """Scrub potential sensitive tokens, passwords, card numbers from freeform text."""
    if not text:
        return ""
    result = text
    # Strip explicit key-value secrets
    result = re.sub(
        r"(password|pwd|secret|token|session_token)(\s*[:=]\s*|\s+)(\S+)",
        r"\1\2[REDACTED_SENSITIVE]",
        result,
        flags=re.IGNORECASE,
    )
    for pattern in SENSITIVE_VALUE_PATTERNS:
        result = pattern.sub("[REDACTED_SENSITIVE]", result)
    return result


def sanitize_url(raw_url: str) -> str:
    """Strip query strings and fragments from URLs to prevent session token leaks."""
    if not raw_url:
        return ""
    # Remove query parameters and hash fragments
    clean_url = raw_url.split("?")[0].split("#")[0]
    return scrub_text(clean_url)


class AIAnalysisInputBuilder:
    """Transforms raw PageRepresentation into a sanitized, bounded AI input payload."""

    @classmethod
    def build_sanitized_input(
        cls,
        page_meta: Dict[str, Any],
        representation: Optional[Dict[str, Any]] = None,
        accessibility_report: Optional[Dict[str, Any]] = None,
        user_goal: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], bool, List[str]]:
        """
        Builds a privacy-scrubbed, truncated JSON structure for the LLM.
        Returns: (sanitized_dict, is_truncated, truncation_notes)
        """
        truncation_notes: List[str] = []
        is_truncated = False

        # 1. Page Metadata
        raw_url = str(page_meta.get("url", ""))
        sanitized_page = {
            "title": scrub_text(str(page_meta.get("title", ""))),
            "hostname": page_meta.get("hostname", ""),
            "pathname": page_meta.get("pathname", "/"),
            "url": sanitize_url(raw_url),
        }

        # 2. Extract and Sanitize Headings
        raw_headings = []
        if representation and "headings" in representation:
            raw_headings = representation.get("headings", [])
        
        sanitized_headings = []
        for h in raw_headings[:settings.AI_MAX_HEADINGS]:
            sanitized_headings.append({
                "id": h.get("id"),
                "level": h.get("level"),
                "text": scrub_text(h.get("text", "")),
            })
        if len(raw_headings) > settings.AI_MAX_HEADINGS:
            is_truncated = True
            truncation_notes.append(
                f"Headings truncated from {len(raw_headings)} to {settings.AI_MAX_HEADINGS}"
            )

        # 3. Extract and Sanitize Sections
        raw_sections = []
        if representation and "sections" in representation:
            raw_sections = representation.get("sections", [])
        
        sanitized_sections = []
        for s in raw_sections[:settings.AI_MAX_SECTIONS]:
            sanitized_sections.append({
                "id": s.get("id"),
                "title": scrub_text(s.get("title", "")),
                "isInteractive": s.get("isInteractive", True),
                "fieldCount": len(s.get("fieldIds", [])),
                "instructionCount": len(s.get("instructionIds", [])),
            })
        if len(raw_sections) > settings.AI_MAX_SECTIONS:
            is_truncated = True
            truncation_notes.append(
                f"Sections truncated from {len(raw_sections)} to {settings.AI_MAX_SECTIONS}"
            )

        # 4. Extract and Sanitize Fields (CRITICAL PRIVACY BOUNDARY)
        raw_fields = []
        if representation and "fields" in representation:
            raw_fields = representation.get("fields", [])
        
        sanitized_fields = []
        for f in raw_fields[:settings.AI_MAX_FIELDS]:
            # Field names or types indicating sensitive fields
            f_name = str(f.get("name", "")).lower()
            f_type = str(f.get("type", "")).lower()
            f_id = str(f.get("id", ""))
            
            is_sensitive = (
                f.get("sensitive", False)
                or f_type == "password"
                or bool(SENSITIVE_KEY_PATTERNS.search(f_name))
            )

            # Never include raw values or sensitive tokens
            sanitized_field = {
                "id": f.get("accessosId") or f_id,
                "label": "[SENSITIVE_FIELD]" if is_sensitive else scrub_text(f.get("label", "")),
                "type": f_type,
                "required": bool(f.get("required", False)),
                "disabled": bool(f.get("disabled", False)),
                "hasValue": bool(f.get("hasValue", False)),
                "optionCount": len(f.get("options", [])) if "options" in f else 0,
                "sensitive": is_sensitive,
            }
            sanitized_fields.append(sanitized_field)

        if len(raw_fields) > settings.AI_MAX_FIELDS:
            is_truncated = True
            truncation_notes.append(
                f"Fields truncated from {len(raw_fields)} to {settings.AI_MAX_FIELDS}"
            )

        # 5. Extract and Sanitize Buttons
        raw_buttons = []
        if representation and "buttons" in representation:
            raw_buttons = representation.get("buttons", [])
        sanitized_buttons = [
            {
                "id": b.get("accessosId") or b.get("id"),
                "text": scrub_text(b.get("text", "")),
                "type": b.get("type", "button"),
                "hasAccessibleName": b.get("hasAccessibleName", True),
            }
            for b in raw_buttons[:20]
        ]

        # 6. Extract and Sanitize Instructions
        raw_instructions = []
        if representation and "instructions" in representation:
            raw_instructions = representation.get("instructions", [])
        
        sanitized_instructions = []
        for inst in raw_instructions[:settings.AI_MAX_INSTRUCTIONS]:
            text = scrub_text(inst.get("text", ""))
            if len(text) > settings.AI_MAX_INSTRUCTION_LENGTH:
                text = text[:settings.AI_MAX_INSTRUCTION_LENGTH] + "... [TRUNCATED]"
            sanitized_instructions.append({
                "id": inst.get("id"),
                "text": text,
                "sectionId": inst.get("sectionId"),
            })
        if len(raw_instructions) > settings.AI_MAX_INSTRUCTIONS:
            is_truncated = True
            truncation_notes.append(
                f"Instructions truncated from {len(raw_instructions)} to {settings.AI_MAX_INSTRUCTIONS}"
            )

        # 7. Extract and Sanitize Deterministic Accessibility Report
        sanitized_report = None
        if accessibility_report:
            findings = accessibility_report.get("findings", [])
            sanitized_findings = [
                {
                    "ruleId": f.get("ruleId"),
                    "category": f.get("category"),
                    "severity": f.get("severity"),
                    "title": f.get("title"),
                    "affectedElementId": f.get("affectedElementId"),
                }
                for f in findings[:15]
            ]
            sanitized_report = {
                "score": accessibility_report.get("score", {}).get("finalScore"),
                "band": accessibility_report.get("score", {}).get("band"),
                "findingsCount": len(findings),
                "findings": sanitized_findings,
            }

        sanitized_payload = {
            "page": sanitized_page,
            "headings": sanitized_headings,
            "sections": sanitized_sections,
            "fields": sanitized_fields,
            "buttons": sanitized_buttons,
            "instructions": sanitized_instructions,
            "accessibilityReport": sanitized_report,
            "userGoal": scrub_text(user_goal) if user_goal else None,
        }

        return sanitized_payload, is_truncated, truncation_notes
