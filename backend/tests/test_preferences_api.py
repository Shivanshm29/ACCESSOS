"""
API integration tests for ACCESSOS User Preferences (Phase 10)
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_preferences_health_endpoint():
    response = client.get("/api/v1/preferences/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "en" in data["supportedLanguages"]
    assert "hi" in data["supportedLanguages"]


def test_preferences_defaults_endpoint():
    response = client.get("/api/v1/preferences/defaults")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    prefs = data["preferences"]
    assert prefs["language"] == "en"
    assert prefs["explanationMode"] == "STANDARD"
    assert prefs["highContrast"] is False
    assert prefs["guidedShowWhy"] is True


def test_preferences_validate_endpoint_valid_payload():
    payload = {
        "language": "hi",
        "explanationMode": "SIMPLE",
        "largerText": True,
    }
    response = client.post("/api/v1/preferences/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    prefs = data["preferences"]
    assert prefs["language"] == "hi"
    assert prefs["explanationMode"] == "SIMPLE"
    assert prefs["largerText"] is True
    assert prefs["highContrast"] is False  # Default preserved


def test_preferences_validate_endpoint_rejects_sensitive_keys():
    payload = {
        "language": "en",
        "password": "secret_password",
    }
    # Sensitive or unknown fields must be rejected (422 Unprocessable Entity by Pydantic extra="forbid")
    response = client.post("/api/v1/preferences/validate", json=payload)
    assert response.status_code == 422


def test_preferences_validate_endpoint_rejects_unknown_fields():
    payload = {
        "unknownSetting": "test",
    }
    response = client.post("/api/v1/preferences/validate", json=payload)
    assert response.status_code == 422
