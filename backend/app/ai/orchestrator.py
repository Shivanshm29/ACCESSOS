"""Orchestrator coordinating sanitization, prompt construction, and provider calls."""
import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from app.ai.providers import (
    AIProvider,
    AIProviderError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
    get_ai_provider,
)
from app.ai.sanitization import AIAnalysisInputBuilder
from app.core.config import settings
from app.schemas.ai_analysis import (
    AIPageAnalysisRequest,
    AIPageAnalysisResponse,
)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def load_prompt_templates() -> Tuple[str, str]:
    """Read system and user prompt templates from disk."""
    sys_path = PROMPTS_DIR / "page_analysis_system.txt"
    user_path = PROMPTS_DIR / "page_analysis_user.txt"
    system_prompt = sys_path.read_text(encoding="utf-8")
    user_prompt_template = user_path.read_text(encoding="utf-8")
    return system_prompt, user_prompt_template


class AIOrchestrator:
    """Central orchestrator for Phase 5 AI Page Analysis."""

    def __init__(self, provider: Optional[AIProvider] = None):
        self._provider = provider

    def get_provider(self) -> AIProvider:
        if self._provider:
            return self._provider
        return get_ai_provider()

    async def analyze_page(
        self,
        request: AIPageAnalysisRequest,
        provider_name: Optional[str] = None,
    ) -> AIPageAnalysisResponse:
        """
        Coordinates the full pipeline:
        Sanitize -> Limit -> Prompt -> Model -> Validate -> Return
        """
        provider = self.get_provider() if not provider_name else get_ai_provider(provider_name)

        # 1. Sanitize & Enforce Privacy Boundaries
        sanitized_input, is_truncated, truncation_notes = AIAnalysisInputBuilder.build_sanitized_input(
            page_meta=request.page,
            representation=request.representation,
            accessibility_report=request.accessibilityReport,
            user_goal=request.userGoal,
        )

        # 2. Check total payload size limit
        serialized_input = json.dumps(sanitized_input)
        if len(serialized_input.encode("utf-8")) > settings.AI_MAX_PAYLOAD_BYTES:
            is_truncated = True
            truncation_notes.append(
                f"Payload size exceeded {settings.AI_MAX_PAYLOAD_BYTES} bytes and was limited."
            )

        # 3. Build prompts
        system_prompt, user_prompt_template = load_prompt_templates()

        user_goal_section = (
            f"Stated Goal: '{request.userGoal}'"
            if request.userGoal
            else "No explicit user goal provided. Infer the goal from the page purpose."
        )

        acc_summary = "No deterministic findings provided."
        if sanitized_input.get("accessibilityReport"):
            rep = sanitized_input["accessibilityReport"]
            acc_summary = (
                f"Baseline Score: {rep.get('score', 100)}/100 ({rep.get('band', 'N/A')}). "
                f"Total Deterministic Findings: {rep.get('findingsCount', 0)}. "
                f"Findings: {json.dumps(rep.get('findings', []))}"
            )

        formatted_user_prompt = (
            user_prompt_template
            .replace("{user_goal_section}", user_goal_section)
            .replace("{sanitized_input_json}", serialized_input)
            .replace("{deterministic_findings_summary}", acc_summary)
        )

        # 4. Invoke Provider
        response = await provider.analyze_page(
            sanitized_input=sanitized_input,
            system_prompt=system_prompt,
            user_prompt=formatted_user_prompt,
        )

        # 5. Cap barrier findings to maximum limit (per Phase 5 Section 26)
        if len(response.barriers) > settings.AI_MAX_BARRIER_FINDINGS:
            response.barriers = response.barriers[:settings.AI_MAX_BARRIER_FINDINGS]

        # 6. Set truncation flags
        response.truncated = is_truncated
        response.truncationNotes = truncation_notes if truncation_notes else []

        return response
