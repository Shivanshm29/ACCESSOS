"""Orchestrator for Phase 7 Explain Anything."""
import json
import logging
import os
import time
from typing import Optional
from app.core.config import settings
from app.ai.providers import get_ai_provider, AIProviderError
from app.explain.schemas import (
    ExplainAnythingRequest,
    ExplainAnythingResponse,
    ExplanationMode,
    TermDefinition,
)
from app.explain.sanitization import ExplainSanitizer
from app.explain.fallback import DeterministicExplainFallback

logger = logging.getLogger("accessos.explain")


class ExplainOrchestrator:
    """Coordinates input sanitization, prompt construction, AI generation, and fallback."""

    def __init__(self):
        self.prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
        self.system_prompt_template = self._load_prompt("explain_anything_system.txt")
        self.user_prompt_template = self._load_prompt("explain_anything_user.txt")

    def _load_prompt(self, filename: str) -> str:
        filepath = os.path.join(self.prompts_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception as e:
            logger.error(f"Failed to read prompt file {filename}: {e}")
            return ""

    async def explain(self, request: ExplainAnythingRequest) -> ExplainAnythingResponse:
        """
        Executes the end-to-end Explain Anything flow:
        1. Sanitize selected text & context (redact passwords, cards, OTPs).
        2. Detect prompt injection attempts.
        3. Dispatch to AI provider or deterministic fallback.
        4. Validate strictly against ExplainAnythingResponse schema.
        """
        start_time = time.perf_counter()

        # 1. Sanitize inbound text and context
        safe_selected, safe_context, safe_goal, sanitization_warnings = ExplainSanitizer.sanitize_request(
            selected_text=request.selectedText,
            context=request.context,
            user_goal=request.userGoal,
        )

        sanitized_request = ExplainAnythingRequest(
            selectedText=safe_selected,
            context=safe_context,
            mode=request.mode,
            userGoal=safe_goal,
        )

        provider_name = settings.AI_PROVIDER.lower().strip()
        model_name = settings.AI_MODEL.strip() or f"{provider_name}-default"

        # 2. Check if Mock provider is configured
        if provider_name == "mock" and not settings.AI_SMOKE_TEST:
            resp = DeterministicExplainFallback.generate(
                request=sanitized_request,
                provider="mock",
                model=model_name or "mock-explain-v1",
                is_fallback=False,
            )
            resp.warnings.extend(sanitization_warnings)
            resp.durationMs = round((time.perf_counter() - start_time) * 1000, 2)
            return resp

        # 3. Real AI provider invocation
        try:
            # Build prompts
            system_prompt = self.system_prompt_template
            user_prompt = self.user_prompt_template.format(
                page_title=safe_context.pageTitle if safe_context and safe_context.pageTitle else "Web Page",
                section_heading=safe_context.sectionHeading if safe_context and safe_context.sectionHeading else "Not Specified",
                element_role=safe_context.elementRole if safe_context and safe_context.elementRole else "Text Content",
                context_before=safe_context.contextBefore if safe_context and safe_context.contextBefore else "",
                context_after=safe_context.contextAfter if safe_context and safe_context.contextAfter else "",
                user_goal=safe_goal if safe_goal else "Understand selected content",
                mode=request.mode.value,
                selected_text=safe_selected,
            )

            provider = get_ai_provider(provider_name)
            raw_output = await provider.generate_chat_completion(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_format="json_object",
            )

            # Parse structured JSON
            data = json.loads(raw_output)

            # Parse terminology
            terms_data = data.get("terminology", [])
            terms: list[TermDefinition] = []
            if isinstance(terms_data, list):
                for item in terms_data:
                    if isinstance(item, dict) and "term" in item and "definition" in item:
                        terms.append(TermDefinition(term=str(item["term"])[:150], definition=str(item["definition"])[:500]))

            confidence_val = float(data.get("confidence", 0.95))
            confidence_val = max(0.0, min(1.0, confidence_val))

            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            all_warnings = list(sanitization_warnings)
            if isinstance(data.get("warnings"), list):
                for w in data["warnings"]:
                    if isinstance(w, str) and w not in all_warnings:
                        all_warnings.append(w)

            return ExplainAnythingResponse(
                explanation=str(data.get("explanation", safe_selected)),
                whyItMatters=str(data.get("whyItMatters")) if data.get("whyItMatters") else None,
                keyPoints=[str(k) for k in data.get("keyPoints", []) if isinstance(k, str)],
                terminology=terms,
                example=str(data.get("example")) if data.get("example") else None,
                confidence=confidence_val,
                sourceSummary=str(data.get("sourceSummary", "Direct model explanation")),
                warnings=all_warnings,
                mode=request.mode,
                provider=provider_name,
                model=model_name,
                durationMs=duration_ms,
                fallbackUsed=False,
            )

        except (AIProviderError, json.JSONDecodeError, Exception) as err:
            logger.warning(f"AI provider {provider_name} failed for explain; using deterministic fallback: {err}")
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            fallback_resp = DeterministicExplainFallback.generate(
                request=sanitized_request,
                provider=provider_name,
                model=model_name,
                is_fallback=True,
            )
            fallback_resp.warnings.extend(sanitization_warnings)
            fallback_resp.warnings.append(f"AI provider unavailable ({type(err).__name__}); generated via deterministic fallback.")
            fallback_resp.durationMs = duration_ms
            return fallback_resp
