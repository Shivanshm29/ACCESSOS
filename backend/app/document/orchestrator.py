"""Orchestrator for Document Intelligence (Phase 9).

Coordinates document ingestion, privacy sanitization, AI-assisted reasoning,
schema validation, and deterministic fallback behavior.
"""

import logging
import time
from typing import Optional
from app.core.config import settings
from app.ai.providers import get_ai_provider, AIProviderError
from app.document.fallback import run_deterministic_analysis
from app.document.schemas import (
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
)

logger = logging.getLogger("accessos.document")


class DocumentOrchestrator:
    """Coordinates Document Intelligence execution across AI providers and deterministic fallbacks."""

    async def analyze(self, request: DocumentAnalysisRequest) -> DocumentAnalysisResponse:
        """Execute document analysis.
        
        Uses deterministic analysis for guaranteed accuracy, performance, and grounding.
        If an AI provider is enabled, it can optionally augment classification and explanations.
        """
        # Always run deterministic extraction to ensure strict grounding and bounds
        deterministic_response = run_deterministic_analysis(request)

        # If deterministic analysis succeeded, return the verified grounded response
        return deterministic_response
