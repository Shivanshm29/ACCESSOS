"""Google Gemini provider implementation using async httpx."""
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


class GeminiProvider(AIProvider):
    """Google Gemini API Provider."""

    def __init__(self, api_key: Optional[str] = None, timeout: float = 25.0):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.timeout = timeout

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def default_model(self) -> str:
        return settings.AI_MODEL or "gemini-1.5-flash"

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
            raise ProviderConfigurationError("Gemini API key is missing or not configured.")

        model = model_name or self.default_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }

        start_time = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException:
            raise ProviderTimeoutError(f"Gemini request timed out after {self.timeout}s.")
        except Exception as e:
            raise AIProviderError(f"Network error communicating with Gemini: {str(e)}")

        if res.status_code == 429:
            raise ProviderRateLimitError("Gemini rate limit exceeded.")
        if res.status_code != 200:
            raise AIProviderError(f"Gemini API returned error HTTP {res.status_code}: {res.text}")

        try:
            data = res.json()
            content_str = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(content_str)
        except Exception as e:
            raise MalformedProviderResponseError(f"Failed to parse Gemini JSON output: {str(e)}")

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        try:
            parsed_json["provider"] = self.provider_name
            parsed_json["model"] = model
            parsed_json["durationMs"] = duration_ms
            return AIPageAnalysisResponse.model_validate(parsed_json)
        except Exception as e:
            raise MalformedProviderResponseError(f"Gemini response failed schema validation: {str(e)}")
