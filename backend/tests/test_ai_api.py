"""Integration and API tests for /api/v1/analyze endpoints."""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_ai_health_endpoint():
    """Verify GET /api/v1/analyze/health returns configuration readiness."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analyze/health")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "activeProvider" in data
        assert "availableProviders" in data
        assert "mock" in data["availableProviders"]
        assert "openai" in data["availableProviders"]
        assert "gemini" in data["availableProviders"]
        assert "openrouter" in data["availableProviders"]
        # Never leak secret keys
        assert "api_key" not in data
        assert "apiKey" not in data


@pytest.mark.asyncio
async def test_analyze_page_endpoint_success():
    """Verify POST /api/v1/analyze/page performs end-to-end analysis using Mock provider."""
    payload = {
        "page": {
            "title": "National Student Scholarship Application Portal",
            "url": "http://localhost:3000/index.html",
            "hostname": "localhost:3000",
            "pathname": "/index.html",
        },
        "representation": {
            "headings": [
                {"id": "h-1", "level": 1, "text": "Scholarship Application"},
                {"id": "h-2", "level": 2, "text": "Applicant Identity"},
            ],
            "sections": [
                {"id": "s-1", "title": "Primary Details", "fieldIds": ["f-1", "f-2"]},
                {"id": "s-2", "title": "Academic Record", "fieldIds": ["f-3"]},
            ],
            "fields": [
                {"id": "f-1", "accessosId": "accessos-field-001", "name": "full_name", "type": "text", "label": "Full Name"},
                {"id": "f-2", "accessosId": "accessos-field-002", "name": "dob", "type": "date", "label": "Date of Birth"},
                {"id": "f-3", "accessosId": "accessos-field-003", "name": "gpa", "type": "number", "label": "GPA"},
            ],
            "instructions": [
                {"id": "inst-1", "text": "Mandatory compliance with Statutory Domicile Circular 2024-B."},
            ],
        },
        "accessibilityReport": {
            "score": {"finalScore": 55, "band": "Significant barriers"},
            "findings": [
                {"ruleId": "FORM_MISSING_LABEL", "severity": "HIGH", "title": "Missing label"}
            ],
        },
        "userGoal": "Apply for student grant",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/analyze/page", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert data["pageUnderstanding"]["pageType"] == "APPLICATION"
        assert "processUnderstanding" in data
        assert data["processUnderstanding"]["totalStages"] >= 2
        assert len(data["barriers"]) >= 1
        assert "nextAction" in data
        assert data["provider"] == "mock"
        assert data["truncated"] is False


@pytest.mark.asyncio
async def test_analyze_page_sanitizes_errors():
    """Verify that failure states return clean, controlled error messages without stack traces."""
    # Temporarily force an unsupported provider to simulate failure
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(settings, "AI_PROVIDER", "invalid_provider_name")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/analyze/page", json={"page": {"title": "Test"}})
            assert res.status_code == 503
            data = res.json()
            assert "AI analysis is temporarily unavailable" in data["detail"]
            # Must NOT leak traceback or internal path details
            assert "Traceback" not in res.text


@pytest.mark.asyncio
async def test_optional_real_provider_smoke_test():
    """
    Optional smoke test (Section 23).
    Only runs if AI_SMOKE_TEST environment variable is set to true.
    """
    if not settings.AI_SMOKE_TEST:
        pytest.skip("AI_SMOKE_TEST is not enabled. Skipping external provider network call.")

    # Only executes if real credentials are intentionally provided
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/analyze/page",
            json={
                "page": {"title": "Smoke Test Page", "url": "https://example.com"},
                "representation": {"headings": [{"id": "h1", "level": 1, "text": "Hello"}]},
            },
        )
        assert res.status_code == 200
