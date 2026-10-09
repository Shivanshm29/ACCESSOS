from fastapi import APIRouter
from app.api.v1.endpoints import health, analyze, guided, explain, interaction, document, preferences, security, completion

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(analyze.router, tags=["AI Analysis"])
api_router.include_router(guided.router, tags=["Guided Mode"])
api_router.include_router(explain.router, tags=["Explain Anything"])
api_router.include_router(interaction.router, tags=["Safe Interaction"])
api_router.include_router(document.router, tags=["Document Intelligence"])
api_router.include_router(preferences.router, tags=["User Preferences"])
api_router.include_router(security.router, tags=["Security & Privacy"])
api_router.include_router(completion.router, prefix="/completion", tags=["Completion Checker"])
