"""Provider registry and factory."""
from typing import Dict, Type
from app.ai.providers.base import (
    AIProvider,
    AIProviderError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
)
from app.ai.providers.mock_provider import MockAIProvider
from app.ai.providers.openai_provider import OpenAIProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.openrouter_provider import OpenRouterProvider
from app.core.config import settings

PROVIDERS: Dict[str, Type[AIProvider]] = {
    "mock": MockAIProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
}


def get_ai_provider(provider_name: Optional[str] = None) -> AIProvider:
    """Instantiate and return the configured AIProvider."""
    name = (provider_name or settings.AI_PROVIDER or "mock").lower().strip()
    if name not in PROVIDERS:
        raise ProviderConfigurationError(
            f"Unsupported AI provider: '{name}'. Supported providers: {list(PROVIDERS.keys())}"
        )
    return PROVIDERS[name]()


__all__ = [
    "AIProvider",
    "AIProviderError",
    "ProviderConfigurationError",
    "ProviderTimeoutError",
    "ProviderRateLimitError",
    "MalformedProviderResponseError",
    "MockAIProvider",
    "OpenAIProvider",
    "GeminiProvider",
    "OpenRouterProvider",
    "get_ai_provider",
    "PROVIDERS",
]
