"""Health check router."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str


@router.get("/health/live", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    from worldsim_shared.config import get_settings
    s = get_settings()
    return HealthResponse(status="ok", version=s.app.version)


@router.get("/health/ready", response_model=HealthResponse)
async def readiness() -> HealthResponse:
    from app.services.pack_registry import registry
    packs = registry.list_all()
    if not packs:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="No packs loaded")
    from worldsim_shared.config import get_settings
    return HealthResponse(status="ready", version=get_settings().app.version)
