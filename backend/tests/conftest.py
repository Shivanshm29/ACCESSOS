import pytest
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Fixture providing a test client for FastAPI."""
    return TestClient(app)
