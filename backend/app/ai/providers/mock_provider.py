"""Deterministic mock AI provider for testing and offline local development."""
import time
from typing import Any, Dict, List, Optional
from app.ai.providers.base import (
    AIProvider,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
    AIProviderError,
)
from app.schemas.ai_analysis import (
    PageType,
    AIBarrierType,
    AISeverity,
    PageUnderstanding,
    ProcessUnderstanding,
    AIBarrierFinding,
    NextAction,
    AIPageAnalysisResponse,
)


class MockAIProvider(AIProvider):
    """
    Mock AI Provider. Produces realistic, grounded semantic analysis
    without network calls, API keys, or external dependencies.
    """

    def __init__(self, fail_mode: Optional[str] = None):
        self.fail_mode = fail_mode

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def default_model(self) -> str:
        return "mock-deterministic-v1"

    async def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "provider": self.provider_name,
            "model": self.default_model,
            "hasApiKey": True,
        }

    async def analyze_page(
        self,
        sanitized_input: Dict[str, Any],
        system_prompt: str,
        user_prompt: str,
        model_name: Optional[str] = None,
    ) -> AIPageAnalysisResponse:
        start_time = time.perf_counter()

        # Handle test failure modes if configured
        if self.fail_mode == "timeout":
            raise ProviderTimeoutError("Mock provider simulated timeout.")
        if self.fail_mode == "rate_limit":
            raise ProviderRateLimitError("Mock provider simulated rate limit.")
        if self.fail_mode == "malformed":
            raise MalformedProviderResponseError("Mock provider returned unparseable payload.")
        if self.fail_mode == "error":
            raise AIProviderError("Mock provider encountered internal simulated failure.")

        page = sanitized_input.get("page", {})
        title = page.get("title", "")
        headings = sanitized_input.get("headings", [])
        sections = sanitized_input.get("sections", [])
        fields = sanitized_input.get("fields", [])
        instructions = sanitized_input.get("instructions", [])
        buttons = sanitized_input.get("buttons", [])

        # 1. Infer Page Type
        title_lower = title.lower()
        if any(w in title_lower for w in ["scholarship", "application", "portal", "apply"]):
            page_type = PageType.APPLICATION
            page_purpose = (
                "This page is used to submit a formal student scholarship application, "
                "verify candidate eligibility, and upload supporting institutional documentation."
            )
        elif len(fields) > 5:
            page_type = PageType.APPLICATION
            page_purpose = "Multi-field digital process requiring structured user input."
        else:
            page_type = PageType.INFORMATION
            page_purpose = "Informational reference or landing page."

        # 2. Extract Major Stages from Sections
        major_stages: List[str] = []
        for s in sections:
            s_title = s.get("title")
            if s_title and len(s_title.strip()) > 0:
                major_stages.append(s_title.strip())
        if not major_stages:
            major_stages = ["Application Initiation", "Information Entry", "Document Submission", "Declaration"]

        # 3. Grounded Semantic Barrier Findings
        barriers: List[AIBarrierFinding] = []

        # Barrier A: Unfamiliar institutional terminology
        # Look for complex instructions or legal terms
        jargon_inst = next(
            (i for i in instructions if any(k in i.get("text", "").lower() for k in ["statutory", "domicile", "cadre", "circular", "annexure", "gazette"])),
            None,
        )
        if jargon_inst:
            barriers.append(
                AIBarrierFinding(
                    id="ai-barrier-001",
                    type=AIBarrierType.UNFAMILIAR_TERM,
                    severity=AISeverity.HIGH,
                    title="Unfamiliar statutory or administrative terminology",
                    explanation=(
                        f"Instructions contain institutional phrasing that may confuse applicants: "
                        f"'{jargon_inst.get('text')[:80]}...'"
                    ),
                    evidence=[{
                        "kind": "instruction",
                        "id": jargon_inst.get("id"),
                        "text": jargon_inst.get("text")[:120],
                    }],
                    affectedElementIds=[jargon_inst.get("id")] if jargon_inst.get("id") else [],
                    suggestedSimplification=(
                        "Replace legal citations with plain-language definitions and concise examples."
                    ),
                    confidence=0.95,
                )
            )

        # Barrier B: Cognitive Load from form density
        if len(fields) >= 20:
            barriers.append(
                AIBarrierFinding(
                    id="ai-barrier-002",
                    type=AIBarrierType.COGNITIVE_LOAD,
                    severity=AISeverity.MEDIUM,
                    title="High cognitive density across extensive form fields",
                    explanation=(
                        f"The page presents {len(fields)} fields across {len(sections)} sections simultaneously, "
                        "which can overwhelm users with cognitive or attention difficulties."
                    ),
                    evidence=[{
                        "kind": "metrics",
                        "fieldCount": len(fields),
                        "sectionCount": len(sections),
                    }],
                    affectedElementIds=[s.get("id") for s in sections[:3] if s.get("id")],
                    suggestedSimplification="Break the process into clear progressive steps with visible progress tracking.",
                    confidence=0.92,
                )
            )

        # Barrier C: Requirement clarity on file uploads
        file_fields = [f for f in fields if f.get("type") == "file"]
        if file_fields:
            barriers.append(
                AIBarrierFinding(
                    id="ai-barrier-003",
                    type=AIBarrierType.REQUIREMENT_CLARITY,
                    severity=AISeverity.MEDIUM,
                    title="Complex file upload specifications and formatting constraints",
                    explanation=(
                        f"The form requires {len(file_fields)} document uploads with strict format and size thresholds "
                        "that are separated from the individual input buttons."
                    ),
                    evidence=[{
                        "kind": "fileFields",
                        "count": len(file_fields),
                        "sampleId": file_fields[0].get("id"),
                    }],
                    affectedElementIds=[f.get("id") for f in file_fields if f.get("id")],
                    suggestedSimplification="Display accepted formats and maximum size directly adjacent to each upload button.",
                    confidence=0.88,
                )
            )

        # If few barriers were generated, add generic guidance
        if not barriers:
            barriers.append(
                AIBarrierFinding(
                    id="ai-barrier-001",
                    type=AIBarrierType.PROCESS_COMPLEXITY,
                    severity=AISeverity.LOW,
                    title="Standard digital form workflow",
                    explanation="Form requires sequential completion of labeled inputs before submission.",
                    evidence=[{"kind": "fieldCount", "count": len(fields)}],
                    affectedElementIds=[fields[0].get("id")] if fields and fields[0].get("id") else [],
                    suggestedSimplification="Review all inputs before submitting.",
                    confidence=0.80,
                )
            )

        # 4. Next Action Recommendation
        target_id = None
        if fields:
            target_id = fields[0].get("id")
        elif buttons:
            target_id = buttons[0].get("id")

        next_action_desc = "Begin by reviewing and completing the Applicant Primary Information section."
        if major_stages:
            next_action_desc = f"Complete Section 1: {major_stages[0]} and verify required entries."

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return AIPageAnalysisResponse(
            pageUnderstanding=PageUnderstanding(
                pageType=page_type,
                pagePurpose=page_purpose,
                confidence=0.95,
            ),
            processUnderstanding=ProcessUnderstanding(
                processName="National Student Scholarship Application" if page_type == PageType.APPLICATION else (title or "Digital Form Process"),
                goal="Complete and submit scholarship application with required verifications.",
                currentStage=major_stages[0] if major_stages else "Initiation",
                totalStages=len(major_stages),
                majorStages=major_stages,
                requiredInformationCategories=["Applicant Details", "Academic Credentials", "Household Income", "Banking Details"],
                requiredDocumentCategories=["Academic Transcripts", "Income Certificate", "Identity Proof"],
                likelyNextAction=next_action_desc,
            ),
            barriers=barriers[:10],
            nextAction=NextAction(
                description=next_action_desc,
                targetElementId=target_id,
                stage=major_stages[0] if major_stages else "Stage 1",
            ),
            summary=(
                f"Classified as {page_type.value}. Contains {len(fields)} fields across {len(sections)} sections. "
                f"Detected {len(barriers)} semantic and cognitive barriers that may hinder digital completion."
            ),
            provider=self.provider_name,
            model=model_name or self.default_model,
            durationMs=duration_ms,
            truncated=False,
            truncationNotes=[],
        )
