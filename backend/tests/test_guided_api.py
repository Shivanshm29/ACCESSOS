"""Integration tests for /api/v1/guided endpoints."""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_guided_health_endpoint():
    """Verify GET /api/v1/guided/health returns readiness."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/guided/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ready"
        assert data["groundingEnforced"] is True


@pytest.mark.asyncio
async def test_guided_start_endpoint_success():
    """Verify POST /api/v1/guided/start returns structured guidance."""
    payload = {
        "page": {
            "title": "Scholarship Application Portal",
            "url": "http://localhost:3000/index.html",
            "hostname": "localhost:3000",
            "pathname": "/index.html",
        },
        "representation": {
            "fields": [
                {"accessosId": "accessos-field-001", "type": "text", "label": "First Name"},
                {"accessosId": "accessos-field-002", "type": "text", "label": "Last Name"},
            ],
            "sections": [
                {"id": "accessos-section-001", "title": "Applicant Primary Information"},
            ],
        },
        "userGoal": "Complete first section",
        "targetStageIndex": 0,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/guided/start", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "steps" in data
        assert len(data["steps"]) >= 2
        assert data["currentStage"] == "Applicant Primary Information"
        assert data["steps"][0]["targetElementId"] == "accessos-field-001"
