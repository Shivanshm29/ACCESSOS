from typing import List
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings for ACCESSOS backend."""

    PROJECT_NAME: str = "ACCESSOS Backend"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "chrome-extension://*",
    ]
    API_BASE_URL: str = "http://localhost:8000"

    # AI Configuration (Phase 5)
    AI_PROVIDER: str = "mock"
    AI_MODEL: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    AI_TIMEOUT_SECONDS: float = 25.0
    AI_MAX_BARRIER_FINDINGS: int = 10
    AI_MAX_HEADINGS: int = 30
    AI_MAX_SECTIONS: int = 30
    AI_MAX_FIELDS: int = 100
    AI_MAX_INSTRUCTIONS: int = 40
    AI_MAX_INSTRUCTION_LENGTH: int = 300
    AI_MAX_PAYLOAD_BYTES: int = 65536
    AI_SMOKE_TEST: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        valid_envs = {"development", "production", "test", "staging"}
        clean = v.lower().strip()
        if clean not in valid_envs:
            raise ValueError(f"Invalid ENVIRONMENT '{v}'. Must be one of {sorted(valid_envs)}")
        return clean

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        clean = v.upper().strip()
        if clean not in valid_levels:
            raise ValueError(f"Invalid LOG_LEVEL '{v}'. Must be one of {sorted(valid_levels)}")
        return clean

    @field_validator("AI_PROVIDER")
    @classmethod
    def validate_ai_provider(cls, v: str) -> str:
        valid_providers = {"mock", "openai", "gemini", "openrouter", "disabled"}
        clean = v.lower().strip()
        if clean not in valid_providers:
            raise ValueError(f"Invalid AI_PROVIDER '{v}'. Must be one of {sorted(valid_providers)}")
        return clean

    @model_validator(mode="after")
    def validate_production_invariants(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            # Wildcard CORS origin is strictly forbidden in production
            if "*" in self.CORS_ORIGINS:
                raise ValueError("Wildcard '*' CORS origin is not permitted in production environment.")
        return self


settings = Settings()
