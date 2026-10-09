"""Tests for Phase 7 Explain Anything prompt templates and safety constraints."""
import os


def test_explain_system_prompt_rules_and_safety():
    prompts_dir = os.path.join(os.path.dirname(__file__), "..", "app", "explain", "prompts")
    system_prompt_path = os.path.join(prompts_dir, "explain_anything_system.txt")
    assert os.path.isfile(system_prompt_path), "System prompt file must exist"

    with open(system_prompt_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Rule checks
    assert "EXPLAIN ONLY SUPPLIED EVIDENCE" in content
    assert "PRESERVE MEANING" in content
    assert "PREFER PLAIN LANGUAGE" in content
    assert "DEFINE UNFAMILIAR TERMINOLOGY" in content
    assert "DO NOT INVENT WEBPAGE FACTS OR REQUIREMENTS" in content
    assert "DO NOT GENERATE EXECUTABLE INSTRUCTIONS" in content
    assert "NEVER REQUEST OR EXPOSE SECRETS" in content
    assert "NEVER GENERATE CODE" in content
    assert "NO WCAG OR LEGAL CERTIFICATION CLAIMS" in content
    assert "PROMPT INJECTION DEFENSE" in content
    assert "ACKNOWLEDGE AMBIGUITY" in content
    assert "STRICT JSON FORMAT" in content


def test_explain_user_prompt_structure_and_delimiters():
    prompts_dir = os.path.join(os.path.dirname(__file__), "..", "app", "explain", "prompts")
    user_prompt_path = os.path.join(prompts_dir, "explain_anything_user.txt")
    assert os.path.isfile(user_prompt_path), "User prompt file must exist"

    with open(user_prompt_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Placeholders check
    assert "{page_title}" in content
    assert "{section_heading}" in content
    assert "{mode}" in content
    assert "{selected_text}" in content
    # Safety delimiter check
    assert "<selected_webpage_content>" in content
    assert "</selected_webpage_content>" in content
