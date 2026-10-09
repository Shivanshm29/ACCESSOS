"""Tests for Phase 8 Safe Interaction API Endpoints."""

import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_interaction_health_endpoint():
    """Verify /api/v1/interaction/health returns 200 OK."""
    resp = client.get("/api/v1/interaction/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["service"] == "safe-interaction-engine"
    assert data["phase"] == 8


def test_interaction_validate_endpoint_success():
    """Verify POST /api/v1/interaction/validate returns valid decision."""
    payload = {
        "intent": {
            "actionId": "act-api-1",
            "actionType": "TYPE",
            "targetElementId": "accessos-field-name",
            "value": "Ananya",
            "valueSource": "USER_EXPLICIT",
            "reason": "Name is mandatory",
            "riskLevel": "LOW",
            "requiresConfirmation": True,
            "source": "USER",
        },
        "isSensitiveField": False,
        "fieldType": "text",
    }
    resp = client.post("/api/v1/interaction/validate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["blocked"] is False
    assert data["riskLevel"] == "LOW"
    assert data["requiresConfirmation"] is True


def test_interaction_validate_endpoint_blocks_sensitive():
    """Verify POST /api/v1/interaction/validate blocks sensitive field typing."""
    payload = {
        "intent": {
            "actionId": "act-api-pwd",
            "actionType": "TYPE",
            "targetElementId": "accessos-field-pwd",
            "value": "SuperSecret",
            "reason": "Password",
            "riskLevel": "LOW",
            "requiresConfirmation": True,
            "source": "GUIDED_MODE",
        },
        "isSensitiveField": True,
        "fieldType": "password",
    }
    resp = client.post("/api/v1/interaction/validate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert data["blocked"] is True
    assert data["riskLevel"] == "BLOCKED"
    assert "sensitive" in data["blockedReason"].lower()


def test_interaction_validate_endpoint_rejects_malformed_target():
    """Verify POST /api/v1/interaction/validate returns 422 for arbitrary CSS/XPath selectors."""
    payload = {
        "intent": {
            "actionId": "act-bad-target",
            "actionType": "TYPE",
            "targetElementId": "input#secret-field > div",
            "value": "Test",
        }
    }
    resp = client.post("/api/v1/interaction/validate", json=payload)
    assert resp.status_code in [400, 422]
