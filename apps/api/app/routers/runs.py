"""
Runs router — Phase 1b vertical slice endpoint.
Accepts hospital simulation parameters, runs Monte Carlo, returns results.
No auth, no queue yet (direct execution for the vertical slice).
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from worldsim_shared.config import get_settings
from worldsim_shared.schemas import AggregateStats, DegradationType, ReplicationMetrics, RunStatus

router = APIRouter()


class RunRequest(BaseModel):
    pack_id: str = "hospital"
    parameters: dict[str, Any] = Field(default_factory=dict)
    n_replications: int = Field(default=10, ge=1, le=50)
    master_seed: int = Field(default=42, ge=0)


class RunResponse(BaseModel):
    run_id: str
    status: RunStatus
    pack_id: str
    parameters: dict[str, Any]
    n_successful: int
    n_failed: int
    aggregate: list[AggregateStats]
    degradations: list[DegradationType]


def hospital_pack_factory() -> Any:
    from hospital_pack import HospitalPack
    return HospitalPack()


def college_pack_factory() -> Any:
    from college_pack import CollegePack
    return CollegePack()


def office_pack_factory() -> Any:
    from office_pack import OfficePack
    return OfficePack()


def policy_pack_factory() -> Any:
    from policy_pack import PolicyPack
    return PolicyPack()


def social_pack_factory() -> Any:
    from social_pack import SocialPack
    return SocialPack()


PACK_FACTORIES = {
    "hospital": hospital_pack_factory,
    "college": college_pack_factory,
    "office": office_pack_factory,
    "policy": policy_pack_factory,
    "social": social_pack_factory,
}


@router.post("/runs", response_model=RunResponse)
async def start_run(request: RunRequest) -> RunResponse:
    """
    Phase 1b — synchronous run endpoint.
    Directly executes Monte Carlo replications in ProcessPoolExecutor.
    Returns when all replications complete.
    """
    from app.services.pack_registry import registry

    settings = get_settings()

    # Resolve pack
    try:
        pack = registry.get(request.pack_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Pack '{request.pack_id}' not found")

    factory = PACK_FACTORIES.get(request.pack_id, hospital_pack_factory)

    # Merge user params with pack defaults
    params = pack.default_params()
    params.update(request.parameters)

    # Domain validation
    errors = pack.validate_params(params)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    # Run Monte Carlo
    from worldsim_engine.runner import MonteCarloRunner, compute_run_status

    sim_cfg = settings.simulation
    runner = MonteCarloRunner(
        worker_pool_size=sim_cfg.worker_pool_size,
        min_replications=sim_cfg.min_replications,
        max_replications=min(request.n_replications, sim_cfg.max_replications),
        convergence_ci_width=sim_cfg.convergence_ci_width,
        replication_timeout_seconds=sim_cfg.replication_timeout_seconds,
        warmup_fraction=sim_cfg.warmup_fraction,
    )

    replications, degradations = runner.run(
        pack_factory=factory,
        params=params,
        master_seed=request.master_seed,
        n_replications=request.n_replications,
        sim_duration=params.get("sim_duration_hours", 8.0) * 60.0,
    )

    successful = [r for r in replications if not r.failed]
    failed_count = len([r for r in replications if r.failed])

    aggregate = pack.aggregate_metrics(replications)
    status = compute_run_status(
        n_requested=request.n_replications,
        n_successful=len(successful),
        min_replications=sim_cfg.min_replications,
    )

    run_id = str(uuid.uuid4())

    return RunResponse(
        run_id=run_id,
        status=status,
        pack_id=request.pack_id,
        parameters=params,
        n_successful=len(successful),
        n_failed=failed_count,
        aggregate=aggregate,
        degradations=degradations,
    )
