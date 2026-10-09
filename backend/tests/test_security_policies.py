"""
Backend Security Policies Tests (Phase 11)
Tests data flow policies, egress network boundaries, and CORS verification.
"""

from app.security import (
    can_send_to_ai,
    can_persist,
    can_log,
    is_allowed_network_destination,
    get_network_destinations,
    is_secure_cors_origin,
    DataClassification,
)


def test_can_send_to_ai_policy():
    assert can_send_to_ai(DataClassification.PUBLIC) is True
    assert can_send_to_ai(DataClassification.INTERNAL) is True
    assert can_send_to_ai(DataClassification.PERSONAL) is True
    assert can_send_to_ai(DataClassification.SENSITIVE) is True
    assert can_send_to_ai(DataClassification.HIGHLY_SENSITIVE) is False


def test_can_persist_policy():
    assert can_persist(DataClassification.PUBLIC) is True
    assert can_persist(DataClassification.INTERNAL) is True
    assert can_persist(DataClassification.PERSONAL) is True
    assert can_persist(DataClassification.SENSITIVE) is True
    assert can_persist(DataClassification.HIGHLY_SENSITIVE) is False


def test_can_log_policy():
    assert can_log(DataClassification.PUBLIC) is True
    assert can_log(DataClassification.INTERNAL) is True
    assert can_log(DataClassification.PERSONAL) is True
    assert can_log(DataClassification.SENSITIVE) is False
    assert can_log(DataClassification.HIGHLY_SENSITIVE) is False


def test_is_allowed_network_destination():
    # Allowlisted endpoints
    assert is_allowed_network_destination("localhost") is True
    assert is_allowed_network_destination("localhost:8000") is True
    assert is_allowed_network_destination("api.openai.com") is True
    assert is_allowed_network_destination("generativelanguage.googleapis.com") is True
    assert is_allowed_network_destination("openrouter.ai") is True

    # Unauthorized endpoints
    assert is_allowed_network_destination("evil-analytics.com") is False
    assert is_allowed_network_destination("tracker.ads.net") is False
    assert is_allowed_network_destination("192.168.1.100") is False
    assert is_allowed_network_destination("") is False


def test_get_network_destinations_inventory():
    destinations = get_network_destinations()
    assert len(destinations) >= 4
    names = [d.name for d in destinations]
    assert "local-backend" in names
    assert "openai" in names
    assert "gemini" in names
    assert "openrouter" in names


def test_is_secure_cors_origin():
    allowed = ["http://localhost:3000", "http://127.0.0.1:3000", "chrome-extension://*"]
    
    assert is_secure_cors_origin("http://localhost:3000", allowed) is True
    assert is_secure_cors_origin("http://127.0.0.1:3000", allowed) is True
    assert is_secure_cors_origin("chrome-extension://abcdefghijklmnop", allowed) is True
    
    # Insecure / unauthorized origins
    assert is_secure_cors_origin("*", allowed) is False
    assert is_secure_cors_origin("http://evil.com", allowed) is False
    assert is_secure_cors_origin("https://attacker.org", allowed) is False
