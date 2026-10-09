"""Orchestrator for Phase 6 Guided Mode step generation and grounding."""
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from app.ai.providers import (
    AIProvider,
    AIProviderError,
    get_ai_provider,
)
from app.ai.sanitization import AIAnalysisInputBuilder
from app.core.config import settings
from app.guided.schemas import (
    ActionType,
    GuidedStep,
    GuidedModeResponse,
    GuidedModeStartRequest,
)
from app.guided.validation import validate_and_ground_steps
from app.guided.fallback import DeterministicGuidedFallbackGenerator

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def load_guided_prompts() -> Tuple[str, str]:
    """Load Guided Mode system and user prompts."""
    sys_path = PROMPTS_DIR / "guided_mode_system.txt"
    user_path = PROMPTS_DIR / "guided_mode_user.txt"
    return sys_path.read_text(encoding="utf-8"), user_path.read_text(encoding="utf-8")


class GuidedModeOrchestrator:
    """Coordinates AI guidance generation, fallback safety, and grounding validation."""

    def __init__(self, provider: Optional[AIProvider] = None):
        self._provider = provider

    def get_provider(self) -> AIProvider:
        if self._provider:
            return self._provider
        return get_ai_provider()

    async def start_guided_mode(
        self,
        request: GuidedModeStartRequest,
        provider_name: Optional[str] = None,
    ) -> GuidedModeResponse:
        """
        Generates step-by-step guidance for the requested page and stage.
        If the AI provider is unavailable, times out, or fails, automatically
        falls back to deterministic grounded guidance.
        """
        # 1. Sanitize input
        sanitized_input, _, _ = AIAnalysisInputBuilder.build_sanitized_input(
            page_meta=request.page,
            representation=request.representation,
            accessibility_report=request.accessibilityReport,
            user_goal=request.userGoal,
        )

        try:
            provider = self.get_provider() if not provider_name else get_ai_provider(provider_name)
            p_name = provider.provider_name.lower()

            if p_name == "mock":
                response = self._generate_mock_guided_mode(request, sanitized_input)
            else:
                response = await self._call_real_provider(provider, request, sanitized_input)

        except Exception as e:
            logger.warning("AI provider failed during Guided Mode generation (%s). Using deterministic fallback.", str(e))
            response = DeterministicGuidedFallbackGenerator.generate_guidance(
                page_meta=request.page,
                representation=request.representation,
                accessibility_report=request.accessibilityReport,
                ai_analysis=request.aiPageAnalysis,
                target_stage_index=request.targetStageIndex,
            )

        # 2. Grounding validation: Verify all targetElementIds exist in representation
        validated_steps, grounding_warnings = validate_and_ground_steps(
            response.steps,
            request.representation,
        )
        response.steps = validated_steps
        if grounding_warnings:
            response.warnings.extend(grounding_warnings)

        return response

    def _generate_mock_guided_mode(
        self,
        request: GuidedModeStartRequest,
        sanitized_input: Dict[str, Any],
    ) -> GuidedModeResponse:
        """High-fidelity mock generator grounded in the demo portal structure."""
        page_title = (request.page.get("title") or "").strip() if request.page else ""
        page_url = str(request.page.get("url") or "") if request.page else ""
        rep = request.representation or {}
        fields = rep.get("fields", [])

        # If invoked on an arbitrary live portal with real extracted form fields,
        # generate guidance dynamically grounded in that portal's actual elements!
        is_demo_portal = (
            "national student scholarship application" in page_title.lower()
            or "3000" in page_url
            or "demo" in page_url.lower()
        )
        if not is_demo_portal and fields:
            return DeterministicGuidedFallbackGenerator.generate_guidance(
                page_meta=request.page,
                representation=request.representation,
                accessibility_report=request.accessibilityReport,
                ai_analysis=request.aiPageAnalysis,
                target_stage_index=request.targetStageIndex,
            )

        title = "National Student Scholarship Application"
        total_stages = 8
        stage_idx = request.targetStageIndex if (request.targetStageIndex is not None and 0 <= request.targetStageIndex < total_stages) else 0

        stage_names = [
            "Applicant Primary Information",
            "Candidate Personal Details",
            "Academic Profile",
            "Household Income & Domicile",
            "Residential & Correspondence Address",
            "Bank Account Details",
            "Required Document Attachments",
            "Candidate Declaration & Final Submission",
        ]

        current_stage = stage_names[stage_idx]
        progress_pct = round(((stage_idx) / total_stages) * 100, 1)

        # Build grounded steps for Stage 1 (Applicant Primary Information)
        if stage_idx == 0:
            steps = [
                GuidedStep(
                    stepId="step-001",
                    order=1,
                    title="Enter First Name",
                    description="Enter your official legal first name as shown on institutional documents.",
                    targetElementId="accessos-field-001",
                    actionType=ActionType.ENTER,
                    whyItMatters="Essential primary identification used for scholarship record matching.",
                    required=True,
                    completed=False,
                ),
                GuidedStep(
                    stepId="step-002",
                    order=2,
                    title="Enter Last Name",
                    description="Enter your official legal surname or family name.",
                    targetElementId="accessos-field-002",
                    actionType=ActionType.ENTER,
                    whyItMatters="Completes applicant identity verification.",
                    required=True,
                    completed=False,
                ),
                GuidedStep(
                    stepId="step-003",
                    order=3,
                    title="Enter Date of Birth",
                    description="Select or enter your date of birth in DD/MM/YYYY format.",
                    targetElementId="accessos-field-003",
                    actionType=ActionType.ENTER,
                    whyItMatters="Used to verify age criteria and eligibility thresholds.",
                    required=True,
                    completed=False,
                ),
                GuidedStep(
                    stepId="step-004",
                    order=4,
                    title="Provide Alternate Contact (Optional)",
                    description="Provide an emergency or alternate phone number or email address.",
                    targetElementId="accessos-field-004",
                    actionType=ActionType.ENTER,
                    whyItMatters="Enables university administrators to contact you if primary details fail.",
                    required=False,
                    completed=False,
                    barrierNote="Accessibility Note: This field lacks an explicit visible label. Input your alternate contact directly.",
                ),
            ]
        elif stage_idx == 6:  # Documents stage
            steps = [
                GuidedStep(
                    stepId="step-001",
                    order=1,
                    title="Upload Academic Transcripts",
                    description="Select and attach certified academic transcripts (PDF, max 2MB).",
                    targetElementId="accessos-field-038",
                    actionType=ActionType.UPLOAD,
                    whyItMatters="Mandatory verification of prior academic performance.",
                    required=True,
                    completed=False,
                ),
                GuidedStep(
                    stepId="step-002",
                    order=2,
                    title="Upload Income Certificate",
                    description="Attach authorized revenue officer income certificate.",
                    targetElementId="accessos-field-039",
                    actionType=ActionType.UPLOAD,
                    whyItMatters="Required for means-tested scholarship allocation.",
                    required=True,
                    completed=False,
                ),
            ]
        else:
            # Generate deterministic steps for other stages
            return DeterministicGuidedFallbackGenerator.generate_guidance(
                page_meta=request.page,
                representation=request.representation,
                accessibility_report=request.accessibilityReport,
                ai_analysis=request.aiPageAnalysis,
                target_stage_index=stage_idx,
            )

        return GuidedModeResponse(
            title=title,
            overview=f"Stage {stage_idx + 1} of {total_stages}: Complete basic applicant identification records.",
            currentStage=current_stage,
            totalStages=total_stages,
            progressPercent=progress_pct,
            steps=steps,
            warnings=[],
            completionMessage=f"Section '{current_stage}' review completed. Proceed to next stage.",
            provider="mock",
            model="mock-deterministic-v1",
            durationMs=4.2,
            fallbackUsed=False,
        )

    async def _call_real_provider(
        self,
        provider: AIProvider,
        request: GuidedModeStartRequest,
        sanitized_input: Dict[str, Any],
    ) -> GuidedModeResponse:
        """Call external LLM provider using structured prompt."""
        system_prompt, user_prompt_template = load_guided_prompts()

        user_goal_section = (
            f"User Goal: '{request.userGoal}'"
            if request.userGoal
            else "Standard digital form process completion."
        )

        stage_instruction = (
            f"Focus on Stage index: {request.targetStageIndex}"
            if request.targetStageIndex is not None
            else "Focus on the initial stage of the process."
        )

        ai_ctx = json.dumps(request.aiPageAnalysis) if request.aiPageAnalysis else "None"

        formatted_user_prompt = (
            user_prompt_template
            .replace("{user_goal_section}", user_goal_section)
            .replace("{stage_instruction}", stage_instruction)
            .replace("{sanitized_page_json}", json.dumps(sanitized_input))
            .replace("{ai_analysis_context}", ai_ctx)
        )

        # Call provider via analyze_page or custom call
        # Providers return AIPageAnalysisResponse on analyze_page; for GuidedMode we can use standard completions
        import httpx
        url = "https://api.openai.com/v1/chat/completions"
        if provider.provider_name == "openrouter":
            url = "https://openrouter.ai/api/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {getattr(provider, 'api_key', '')}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": provider.default_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": formatted_user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code != 200:
                raise AIProviderError(f"Provider returned error HTTP {res.status_code}")
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            parsed["provider"] = provider.provider_name
            parsed["model"] = provider.default_model
            return GuidedModeResponse.model_validate(parsed)
