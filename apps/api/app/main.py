"""
WorldSim API — FastAPI Application Entry Point
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from worldsim_shared.config import get_settings
from worldsim_shared.schemas import APIError

from app.routers import health, packs, runs


settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle."""
    # Startup: validate settings (already done by get_settings), register packs
    from app.services.pack_registry import registry
    registry.discover()
    yield
    # Shutdown: nothing special needed for Phase 1b (no persistent workers yet)


app = FastAPI(
    title=settings.app.name,
    version=settings.app.version,
    description="WorldSim AI — Simulation Engine for Testing Decisions Before Reality",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS — origins from config, plus regex support for Vercel deployments & localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api.cors_origins or ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error = APIError(
        code="INTERNAL_SERVER_ERROR",
        message=str(exc),
        request_id=request.headers.get("X-Request-ID", ""),
        retryable=False,
    )
    return JSONResponse(status_code=500, content=error.model_dump())


from app.routers import agent_simulation, health, packs, runs

# Routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(packs.router, prefix="/api/v1", tags=["Packs"])
app.include_router(runs.router, prefix="/api/v1", tags=["Runs"])
app.include_router(agent_simulation.router, prefix="/api/v1", tags=["Agent Simulations"])
