from typing import Any, Dict
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for health status response (liveness)."""

    status: str = Field(default="healthy", description="Service operational status")
    service: str = Field(default="ACCESSOS Backend", description="Name of the service")
    version: str = Field(description="Current version of the service")
    environment: str = Field(description="Deployment environment")


class ReadyResponse(BaseModel):
    """Schema for readiness status response."""

    status: str = Field(default="ready", description="Readiness status: ready, degraded, or not_ready")
    service: str = Field(default="ACCESSOS Backend", description="Name of the service")
    version: str = Field(description="Current version of the service")
    environment: str = Field(description="Deployment environment")
    ready: bool = Field(default=True, description="True if service is ready to accept requests")
    checks: Dict[str, Any] = Field(default_factory=dict, description="Detailed status of readiness checks")
