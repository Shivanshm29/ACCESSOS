"""Abstract base interface and exceptions for AI providers."""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from app.schemas.ai_analysis import AIPageAnalysisResponse


class AIProviderError(Exception):
    """Base exception for all AI provider failures."""
    def __init__(self, message: str, code: str = "PROVIDER_ERROR"):
        super().__init__(message)
        self.code = code
        self.message = message


class ProviderConfigurationError(AIProviderError):
    """Raised when provider configuration or API key is missing."""
    def __init__(self, message: str):
        super().__init__(message, code="CONFIG_ERROR")


class ProviderTimeoutError(AIProviderError):
    """Raised when an AI provider call times out."""
    def __init__(self, message: str = "AI provider request timed out."):
        super().__init__(message, code="TIMEOUT_ERROR")


class ProviderRateLimitError(AIProviderError):
    """Raised when an AI provider rate limit is exceeded."""
    def __init__(self, message: str = "AI provider rate limit reached."):
        super().__init__(message, code="RATE_LIMIT_ERROR")


class MalformedProviderResponseError(AIProviderError):
    """Raised when an AI provider returns invalid or unparseable structured data."""
    def __init__(self, message: str = "Malformed or unparseable AI provider response."):
        super().__init__(message, code="MALFORMED_RESPONSE")


class AIProvider(ABC):
    """Abstract interface implemented by all model providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. 'openai', 'gemini', 'openrouter', 'mock')."""
        pass

    @property
    @abstractmethod
    def default_model(self) -> str:
        """Default model name if none is explicitly configured."""
        pass

    @abstractmethod
    async def analyze_page(
        self,
        sanitized_input: Dict[str, Any],
        system_prompt: str,
        user_prompt: str,
        model_name: Optional[str] = None,
    ) -> AIPageAnalysisResponse:
        """Analyze a sanitized page representation and return structured response."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Perform a basic configuration and connectivity check."""
        pass
