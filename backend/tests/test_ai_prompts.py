"""Tests for AI prompt templates, rules, and placeholder integrity."""
from app.ai.orchestrator import load_prompt_templates


def test_system_prompt_rules_and_constraints():
    """Verify system prompt contains mandatory safety, truthfulness, and privacy instructions."""
    system_prompt, user_prompt_template = load_prompt_templates()

    # Rule 1: No inventing elements
    assert "DO NOT INVENT PAGE ELEMENTS" in system_prompt

    # Rule 2: Grounded in supplied evidence
    assert "USE ONLY SUPPLIED EVIDENCE" in system_prompt

    # Rule 3: Strict privacy
    assert "STRICT PRIVACY" in system_prompt

    # Rule 4: Descriptive only, no execution
    assert "DESCRIPTIVE ONLY" in system_prompt

    # Rule 5: No WCAG certification claims
    assert "NO WCAG CERTIFICATION CLAIMS" in system_prompt

    # Rule 6: Severities bounded to LOW, MEDIUM, HIGH (never CRITICAL)
    assert "SEVERITY CONSTRAINTS" in system_prompt
    assert "NEVER use CRITICAL" in system_prompt

    # Rule 7: Max 10 barrier findings
    assert "maximum of 10" in system_prompt

    # Rule 8: JSON output required
    assert "valid JSON object" in system_prompt


def test_user_prompt_placeholders():
    """Verify user prompt template contains required formatting placeholders."""
    _, user_prompt_template = load_prompt_templates()

    assert "{user_goal_section}" in user_prompt_template
    assert "{sanitized_input_json}" in user_prompt_template
    assert "{deterministic_findings_summary}" in user_prompt_template
