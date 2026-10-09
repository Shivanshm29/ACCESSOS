from starlette.testclient import TestClient


def test_cors_headers_for_allowed_origin(client: TestClient):
    """Verify that allowed origin receives CORS access-control headers."""
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_headers_rejected_for_unallowed_origin(client: TestClient):
    """Verify that unallowed origin does NOT receive access-control-allow-origin header."""
    response = client.get(
        "/health",
        headers={"Origin": "https://malicious-site.example.com"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") is None


def test_security_headers_present_on_all_responses(client: TestClient):
    """Verify presence of security headers on all responses."""
    response = client.get("/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("content-security-policy") == "default-src 'self'"


def test_options_preflight_request(client: TestClient):
    """Verify that OPTIONS preflight request returns allowed methods and credentials."""
    response = client.options(
        "/api/v1/analyze/page",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "POST" in response.headers.get("access-control-allow-methods", "")
