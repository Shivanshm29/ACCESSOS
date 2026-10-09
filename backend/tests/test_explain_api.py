"""Tests for Phase 7 Explain Anything API endpoints."""
import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_explain_health_endpoint():
    response = client.get("/api/v1/explain/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["subsystem"] == "explain_anything"
    assert "SIMPLE" in data["supportedModes"]
    assert data["sanitizationEnforced"] is True


def test_explain_post_endpoint_success():
    payload = {
        "selectedText": "Statutory Quota Sub-allocation",
        "context": {
            "pageTitle": "Scholarship Application",
            "sectionHeading": "Stage 1: Primary Information",
            "targetElementId": "accessos-field-001",
        },
        "mode": "SIMPLE",
        "userGoal": "Understand quota qualification",
    }

    response = client.post("/api/v1/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "explanation" in data
    assert len(data["explanation"]) > 0
    assert data["mode"] == "SIMPLE"
    assert data["provider"] is not None


def test_explain_post_endpoint_redacts_sensitive_values():
    payload = {
        "selectedText": "Applicant token: secret_token_xyz987654321 with pin: 849201",
        "mode": "SIMPLE",
    }

    response = client.post("/api/v1/explain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "secret_token_xyz987654321" not in data["sourceSummary"]
    assert "secret_token_xyz987654321" not in data["explanation"]
    assert len(data["warnings"]) > 0


def test_explain_post_empty_selection_rejected():
    payload = {
        "selectedText": "",
        "mode": "SIMPLE",
    }
    response = client.post("/api/v1/explain", json=payload)
    assert response.status_code == 422
