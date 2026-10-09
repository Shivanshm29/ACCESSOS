from starlette.testclient import TestClient


def test_health_check_returns_200(client: TestClient):
    """Verify that GET /health returns HTTP 200 with healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ACCESSOS Backend"
    assert "version" in data
    assert "environment" in data


def test_api_v1_health_returns_200(client: TestClient):
    """Verify that GET /api/v1/health also returns HTTP 200 with healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
