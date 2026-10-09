from starlette.testclient import TestClient
from app.core.config import Settings
from app.api.v1.endpoints.health import get_ready
from fastapi import Response


def test_ready_check_returns_200(client: TestClient):
    """Verify that root GET /ready returns HTTP 200 with readiness details."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "degraded")
    assert data["service"] == "ACCESSOS Backend"
    assert data["version"] == "0.1.0"
    assert data["ready"] is True
    assert "checks" in data
    assert "configuration" in data["checks"]
    assert "cors" in data["checks"]
    assert "ai_provider" in data["checks"]
    assert "security_headers" in data["checks"]


def test_api_v1_ready_returns_200(client: TestClient):
    """Verify that versioned GET /api/v1/ready returns HTTP 200 with readiness details."""
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "degraded")
    assert data["ready"] is True


def test_root_index_contains_ready_link(client: TestClient):
    """Verify that root GET / includes ready endpoint link."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["ready"] == "/ready"
    assert data["health"] == "/health"


def test_ready_check_with_missing_ai_key_remains_ready(monkeypatch):
    """Verify that missing optional AI provider key does not prevent backend readiness."""
    from app.core import config
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", "")

    resp = Response()
    result = get_ready(resp)
    assert result.ready is True
    assert result.checks["ai_provider"]["status"] == "unconfigured_key"
    assert result.checks["ai_provider"]["has_key"] is False
    assert resp.status_code == 200
