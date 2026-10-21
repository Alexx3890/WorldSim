"""Packs router — list available packs and their schemas."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from worldsim_shared.schemas import MetricDefinition, PackManifest, PackSchema

router = APIRouter()


class PackSummary(BaseModel):
    manifest: PackManifest
    schema_: PackSchema
    metrics: list[MetricDefinition]

    model_config = {"populate_by_name": True}


@router.get("/packs", response_model=list[PackManifest])
async def list_packs() -> list[PackManifest]:
    """List all available scenario packs."""
    from app.services.pack_registry import registry
    return [p.manifest for p in registry.list_all()]


@router.get("/packs/{pack_id}", response_model=PackSummary)
async def get_pack(pack_id: str) -> PackSummary:
    """Get full schema and metric definitions for a pack."""
    from app.services.pack_registry import registry
    try:
        pack = registry.get(pack_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Pack '{pack_id}' not found")
    return PackSummary(
        manifest=pack.manifest,
        schema_=pack.schema,
        metrics=pack.metric_definitions,
    )
