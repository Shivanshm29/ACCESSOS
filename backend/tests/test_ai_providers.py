"""Unit tests for AI providers, error handling, and mock adapters."""
import json
import pytest
from unittest.mock import patch, AsyncMock
import httpx

from app.ai.providers import (
    get_ai_provider,
    MockAIProvider,
    OpenAIProvider,
    GeminiProvider,
    OpenRouterProvider,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
    AIProviderError,
)
from app.schemas.ai_analysis import PageType, AISeverity


def test_provider_factory_resolution():
    """Verify provider factory correctly resolves supported providers."""
    mock_p = get_ai_provider("mock")
    assert isinstance(mock_p, MockAIProvider)
    assert mock_p.provider_name == "mock"

    openai_p = get_ai_provider("openai")
    assert isinstance(openai_p, OpenAIProvider)

    gemini_p = get_ai_provider("gemini")
    assert isinstance(gemini_p, GeminiProvider)

    openrouter_p = get_ai_provider("openrouter")
    assert isinstance(openrouter_p, OpenRouterProvider)


def test_unsupported_provider_raises_config_error():
    """Unsupported provider names must raise ProviderConfigurationError."""
    with pytest.raises(ProviderConfigurationError):
        get_ai_provider("unsupported_ai_vendor")


@pytest.mark.asyncio
async def test_mock_provider_success():
    """Verify Mock provider returns valid, structured, grounded response."""
    provider = MockAIProvider()
    sanitized_input = {
        "page": {"title": "National Student Scholarship Portal", "url": "https://scholarships.gov/apply"},
        "headings": [{"id": "h-1", "level": 1, "text": "Scholarship Application"}],
        "sections": [{"id": "s-1", "title": "Applicant Primary Details", "fieldIds": ["f-1"]}],
        "fields": [{"id": "f-1", "type": "text", "label": "Full Name"}],
        "instructions": [{"id": "inst-1", "text": "Pursuant to Statutory Quota Gazette 2024"}],
    }

    res = await provider.analyze_page(sanitized_input, "system prompt", "user prompt")
    assert res.pageUnderstanding.pageType == PageType.APPLICATION
    assert len(res.barriers) >= 1
    assert res.barriers[0].severity in [AISeverity.LOW, AISeverity.MEDIUM, AISeverity.HIGH]
    assert res.nextAction is not None


@pytest.mark.asyncio
async def test_mock_provider_failure_modes():
    """Verify mock provider simulates expected error conditions for testing."""
    timeout_p = MockAIProvider(fail_mode="timeout")
    with pytest.raises(ProviderTimeoutError):
        await timeout_p.analyze_page({}, "sys", "usr")

    rate_limit_p = MockAIProvider(fail_mode="rate_limit")
    with pytest.raises(ProviderRateLimitError):
        await rate_limit_p.analyze_page({}, "sys", "usr")

    malformed_p = MockAIProvider(fail_mode="malformed")
    with pytest.raises(MalformedProviderResponseError):
        await malformed_p.analyze_page({}, "sys", "usr")

    error_p = MockAIProvider(fail_mode="error")
    with pytest.raises(AIProviderError):
        await error_p.analyze_page({}, "sys", "usr")


@pytest.mark.asyncio
async def test_openai_missing_api_key_raises_config_error():
    """OpenAIProvider without an API key raises ProviderConfigurationError."""
    provider = OpenAIProvider(api_key="")
    with pytest.raises(ProviderConfigurationError):
        await provider.analyze_page({}, "sys", "usr")


@pytest.mark.asyncio
async def test_openai_mocked_success():
    """Verify OpenAIProvider correctly processes and validates structured output."""
    provider = OpenAIProvider(api_key="sk-test-fake-key")

    mock_llm_json = {
        "pageUnderstanding": {
            "pageType": "APPLICATION",
            "pagePurpose": "Online scholarship registration",
            "confidence": 0.95,
        },
        "processUnderstanding": {
            "processName": "Scholarship Registration",
            "goal": "Submit financial aid form",
            "currentStage": "Step 1",
            "totalStages": 4,
            "majorStages": ["Personal", "Academic"],
            "requiredInformationCategories": ["Contact"],
            "requiredDocumentCategories": ["Transcripts"],
            "likelyNextAction": "Complete personal details",
        },
        "barriers": [
            {
                "id": "ai-1",
                "type": "UNFAMILIAR_TERM",
                "severity": "HIGH",
                "title": "Jargon in eligibility",
                "explanation": "Reference to domicile circular",
                "evidence": [{"kind": "text", "text": "Domicile"}],
                "affectedElementIds": ["accessos-inst-1"],
                "suggestedSimplification": "Clarify domicile",
                "confidence": 0.9,
            }
        ],
        "nextAction": {
            "description": "Click Next",
            "targetElementId": "btn-next",
            "stage": "Step 1",
        },
        "summary": "Application page with moderate barrier density.",
    }

    mock_response = httpx.Response(
        200,
        json={"choices": [{"message": {"content": json.dumps(mock_llm_json)}}]},
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await provider.analyze_page({}, "sys", "usr")
        assert res.pageUnderstanding.pageType == PageType.APPLICATION
        assert res.provider == "openai"
        assert len(res.barriers) == 1


@pytest.mark.asyncio
async def test_gemini_missing_api_key_raises_config_error():
    """GeminiProvider without an API key raises ProviderConfigurationError."""
    provider = GeminiProvider(api_key="")
    with pytest.raises(ProviderConfigurationError):
        await provider.analyze_page({}, "sys", "usr")


@pytest.mark.asyncio
async def test_gemini_mocked_success():
    """Verify GeminiProvider parses candidate parts correctly."""
    provider = GeminiProvider(api_key="fake-gemini-key")
    mock_llm_json = {
        "pageUnderstanding": {
            "pageType": "APPLICATION",
            "pagePurpose": "Grant application",
            "confidence": 0.9,
        },
        "processUnderstanding": {
            "processName": "Grant Application",
            "goal": "Submit grant application",
            "currentStage": "Stage 1",
            "totalStages": 3,
            "majorStages": ["Identity", "Budget"],
            "requiredInformationCategories": ["Contact"],
            "requiredDocumentCategories": ["Proof"],
            "likelyNextAction": "Fill Identity",
        },
        "barriers": [],
        "nextAction": {"description": "Enter Identity", "targetElementId": "btn-id", "stage": "Stage 1"},
        "summary": "Clear form.",
    }
    mock_response = httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": json.dumps(mock_llm_json)}]}}]},
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await provider.analyze_page({}, "sys", "usr")
        assert res.pageUnderstanding.pageType == PageType.APPLICATION
        assert res.provider == "gemini"


@pytest.mark.asyncio
async def test_openrouter_missing_api_key_raises_config_error():
    """OpenRouterProvider without an API key raises ProviderConfigurationError."""
    provider = OpenRouterProvider(api_key="")
    with pytest.raises(ProviderConfigurationError):
        await provider.analyze_page({}, "sys", "usr")


@pytest.mark.asyncio
async def test_openrouter_mocked_success():
    """Verify OpenRouterProvider parses chat completions correctly."""
    provider = OpenRouterProvider(api_key="fake-openrouter-key")
    mock_llm_json = {
        "pageUnderstanding": {
            "pageType": "REGISTRATION",
            "pagePurpose": "Account registration",
            "confidence": 0.88,
        },
        "processUnderstanding": {
            "processName": "Registration",
            "goal": "Register account",
            "currentStage": "Account Setup",
            "totalStages": 2,
            "majorStages": ["Account", "Confirmation"],
            "requiredInformationCategories": ["Email"],
            "requiredDocumentCategories": [],
            "likelyNextAction": "Enter email",
        },
        "barriers": [],
        "nextAction": {"description": "Click Register", "targetElementId": "btn-reg"},
        "summary": "Registration page.",
    }
    mock_response = httpx.Response(
        200,
        json={"choices": [{"message": {"content": json.dumps(mock_llm_json)}}]},
        request=httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        res = await provider.analyze_page({}, "sys", "usr")
        assert res.pageUnderstanding.pageType == PageType.REGISTRATION
        assert res.provider == "openrouter"

