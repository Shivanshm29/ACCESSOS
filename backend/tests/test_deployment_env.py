import pytest
from app.core.config import Settings


def test_valid_development_settings():
    """Verify default development configuration settings."""
    cfg = Settings(ENVIRONMENT="development", LOG_LEVEL="INFO", AI_PROVIDER="mock")
    assert cfg.ENVIRONMENT == "development"
    assert cfg.LOG_LEVEL == "INFO"
    assert cfg.AI_PROVIDER == "mock"
    assert cfg.PORT == 8000


def test_valid_production_settings():
    """Verify production settings with explicit non-wildcard CORS origins."""
    cfg = Settings(
        ENVIRONMENT="production",
        DEBUG=False,
        CORS_ORIGINS=["https://accessos.org", "chrome-extension://abcdefghijklmnop"],
    )
    assert cfg.ENVIRONMENT == "production"
    assert cfg.DEBUG is False
    assert len(cfg.CORS_ORIGINS) == 2


def test_production_rejects_wildcard_cors():
    """Verify that wildcard '*' CORS is strictly prohibited in production mode."""
    with pytest.raises(ValueError, match="Wildcard '\\*' CORS origin is not permitted in production"):
        Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS=["*"],
        )


def test_rejects_invalid_environment():
    """Verify that unsupported ENVIRONMENT strings are rejected."""
    with pytest.raises(ValueError, match="Invalid ENVIRONMENT 'unknown_env'"):
        Settings(ENVIRONMENT="unknown_env")


def test_rejects_invalid_log_level():
    """Verify that unsupported LOG_LEVEL values are rejected."""
    with pytest.raises(ValueError, match="Invalid LOG_LEVEL 'VERBOSE'"):
        Settings(LOG_LEVEL="VERBOSE")


def test_rejects_invalid_ai_provider():
    """Verify that unsupported AI_PROVIDER values are rejected."""
    with pytest.raises(ValueError, match="Invalid AI_PROVIDER 'claude'"):
        Settings(AI_PROVIDER="claude")
