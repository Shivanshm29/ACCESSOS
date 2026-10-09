"""OpenRouter provider implementation using async httpx."""
import json
import time
from typing import Any, Dict, Optional
import httpx
from app.core.config import settings
from app.ai.providers.base import (
    AIProvider,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
    AIProviderError,
)
from app.schemas.ai_analysis import AIPageAnalysisResponse


class OpenRouterProvider(AIProvider):
    """OpenRouter API Provider."""

    def __init__(self, api_key: Optional[str] = None, timeout: float = 25.0):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.timeout = timeout

    @property
    def provider_name(self) -> str:
        return "openrouter"

    @property
    def default_model(self) -> str:
        return settings.AI_MODEL or "meta-llama/llama-3.1-8b-instruct"

    async def health_check(self) -> Dict[str, Any]:
        has_key = bool(self.api_key and len(self.api_key.strip()) > 0)
        return {
            "status": "configured" if has_key else "missing_key",
            "provider": self.provider_name,
            "model": self.default_model,
            "hasApiKey": has_key,
        }

    async def analyze_page(
        self,
        sanitized_input: Dict[str, Any],
        system_prompt: str,
        user_prompt: str,
        model_name: Optional[str] = None,
    ) -> AIPageAnalysisResponse:
        if not self.api_key:
            raise ProviderConfigurationError("OpenRouter API key is missing or not configured.")

        model = model_name or self.default_model
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://accessos.app",
            "X-Title": "ACCESSOS",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        start_time = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException:
            raise ProviderTimeoutError(f"OpenRouter request timed out after {self.timeout}s.")
        except Exception as e:
            raise AIProviderError(f"Network error communicating with OpenRouter: {str(e)}")

        if res.status_code == 429:
            raise ProviderRateLimitError("OpenRouter rate limit exceeded.")
        if res.status_code != 200:
            raise AIProviderError(f"OpenRouter API returned error HTTP {res.status_code}: {res.text}")

        try:
            data = res.json()
            content_str = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(content_str)
        except Exception as e:
            raise MalformedProviderResponseError(f"Failed to parse OpenRouter JSON output: {str(e)}")

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        try:
            parsed_json["provider"] = self.provider_name
            parsed_json["model"] = model
            parsed_json["durationMs"] = duration_ms
            return AIPageAnalysisResponse.model_validate(parsed_json)
        except Exception as e:
            raise MalformedProviderResponseError(f"OpenRouter response failed schema validation: {str(e)}")
