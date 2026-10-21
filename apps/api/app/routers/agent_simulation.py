"""
Agent Simulation Router
=======================
Exposes the end-to-end AI-driven simulation pipeline:
  NL input → Pack Routing → Parameter Extraction → Strategy Generation
  → Monte Carlo Simulations → Pareto Scoring → Executive Report → Critic Check
"""
from __future__ import annotations

import logging
import random
from typing import Any, cast
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from worldsim_shared.config import get_settings
from worldsim_shared.schemas import DegradationType, PackManifest, StrategyScore
from worldsim_agents.agents import (
    CriticAgent,
    ReporterAgent,
    RouterAgent,
    ScenarioBuilderAgent,
    StrategyGeneratorAgent,
)
from worldsim_agents.schemas import CriticOutput, ReportOutput, StrategyItem
from worldsim_engine.runner import MonteCarloRunner, compute_run_status
from worldsim_engine.scorer import score_strategies
from worldsim_llm_gateway.gateway import GeminiGateway

logger = logging.getLogger(__name__)

router = APIRouter()

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


class AISimulationRequest(BaseModel):
    prompt: str = Field(..., min_length=5, description="Natural language decision description")
    pack_id: str | None = Field(default=None, description="Optional manual pack selection override")
    strategy_count: int = Field(default=3, ge=1, le=5, description="Number of alternative strategies to generate")
    replications_per_strategy: int = Field(default=10, ge=3, le=50, description="Monte Carlo replications per strategy")
    seed: int | None = Field(default=None, description="Optional random seed for reproducibility")


class AISimulationResponse(BaseModel):
    pack_id: str
    pack_name: str
    objectives: list[str]
    constraints: list[str]
    assumptions: list[str]
    strategies: list[dict[str, Any]]
    strategy_scores: list[StrategyScore]
    simulation_results: dict[str, dict[str, Any]]
    report: ReportOutput
    critic: CriticOutput
    degradations: list[str]


@router.post("/simulations/ai-plan", response_model=AISimulationResponse)
async def run_ai_simulation_plan(request: AISimulationRequest) -> AISimulationResponse:
    from app.services.pack_registry import registry

    settings = get_settings()
    gateway = GeminiGateway(settings)

    # 1. Routing
    available_manifests = [p.manifest for p in registry.all()]
    all_degradations: list[str] = []

    if request.pack_id:
        try:
            pack = registry.get(request.pack_id)
            selected_pack_id = request.pack_id
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Pack '{request.pack_id}' not found")
    else:
        router_agent = RouterAgent(gateway, settings)
        routing_out, deg = router_agent.route(request.prompt, available_manifests)
        selected_pack_id = routing_out.pack_id
        all_degradations.extend([d.value for d in deg])
        try:
            pack = registry.get(selected_pack_id)
        except KeyError:
            pack = registry.all()[0]
            selected_pack_id = pack.manifest.id

    # 2. Scenario Building
    builder = ScenarioBuilderAgent(gateway, settings)
    scenario_out, deg = builder.build_scenario(
        user_input=request.prompt,
        pack_manifest=pack.manifest,
        pack_schema=pack.schema,
        pack_guidance=getattr(pack, "prompt_pack", {}).get("guidance", ""),
    )
    all_degradations.extend([d.value for d in deg])

    # Validate parameters against pack
    baseline_params = pack.default_params()
    baseline_params.update(scenario_out.parameters)
    val_errs = pack.validate_params(baseline_params)
    if val_errs:
        # Clamp or fix defaults if invalid
        baseline_params = pack.default_params()
        scenario_out.assumptions.append("Reset invalid parameters to validated domain defaults.")

    # 3. Strategy Generation
    strategy_agent = StrategyGeneratorAgent(gateway, settings)
    strategies_out, deg = strategy_agent.generate_strategies(
        baseline_params=baseline_params,
        pack_schema=pack.schema,
        objectives=scenario_out.objectives,
        constraints=scenario_out.constraints,
        pack_guidance=getattr(pack, "prompt_pack", {}).get("guidance", ""),
        strategy_count=request.strategy_count,
    )
    all_degradations.extend([d.value for d in deg])

    # Assemble all strategies to run: Baseline + Alternatives
    empty_deltas: dict[str, Any] = cast(dict[str, Any], dict())
    strategies_to_simulate: list[dict[str, Any]] = [
        {
            "strategy_id": str(uuid4()),
            "name": "Baseline (Current Operation)",
            "description": "Current baseline configuration without interventions.",
            "parameter_deltas": empty_deltas,
            "parameters": dict(baseline_params),
            "hypothesis": "Benchmark existing status quo performance.",
            "is_baseline": True,
        }
    ]

    for idx, s in enumerate(strategies_out):
        strat_params = dict(baseline_params)
        strat_params.update(s.parameter_deltas)
        # Validate each strategy's params
        errors = pack.validate_params(strat_params)
        if errors:
            strat_params = dict(baseline_params)
        strategies_to_simulate.append(
            {
                "strategy_id": str(uuid4()),
                "name": s.name,
                "description": s.description,
                "parameter_deltas": s.parameter_deltas,
                "parameters": strat_params,
                "hypothesis": s.hypothesis,
                "expected_tradeoff": s.expected_tradeoff,
                "is_baseline": False,
            }
        )

    # 4. Simulation Execution (ProcessPoolExecutor via MonteCarloRunner)
    sim_cfg = settings.simulation
    runner = MonteCarloRunner(
        worker_pool_size=sim_cfg.worker_pool_size,
        min_replications=sim_cfg.min_replications,
        max_replications=min(request.replications_per_strategy, sim_cfg.max_replications),
        convergence_ci_width=sim_cfg.convergence_ci_width,
        replication_timeout_seconds=sim_cfg.replication_timeout_seconds,
        warmup_fraction=sim_cfg.warmup_fraction,
    )

    sim_results_by_strat: dict[str, dict[str, Any]] = {}
    scoring_inputs: list[dict[str, Any]] = []
    base_seed = request.seed if (request.seed is not None) else random.randint(100, 999999)

    for strat in strategies_to_simulate:
        replications, degs = runner.run(
            pack_factory=PACK_FACTORIES.get(selected_pack_id, hospital_pack_factory),
            params=strat["parameters"],
            master_seed=base_seed,
            n_replications=request.replications_per_strategy,
            sim_duration=strat["parameters"].get("sim_duration_hours", 8.0) * 60.0,
        )
        all_degradations.extend([d.value for d in degs])
        successful = [r for r in replications if not r.failed]
        aggregate = pack.aggregate_metrics(replications)
        strat_status = compute_run_status(
            n_requested=request.replications_per_strategy,
            n_successful=len(successful),
            min_replications=sim_cfg.min_replications,
        )

        scoring_inputs.append({
            "strategy_id": strat["strategy_id"],
            "strategy_name": strat["name"],
            "aggregate": aggregate,
        })

        sim_results_by_strat[strat["name"]] = {
            stat.metric_key: {
                "mean": round(stat.mean, 2),
                "median": round(stat.median, 2),
                "std_dev": round(stat.std_dev, 2),
                "ci_lower": round(stat.ci_lower, 2),
                "ci_upper": round(stat.ci_upper, 2),
                "p5": round(stat.p5, 2),
                "p95": round(stat.p95, 2),
            }
            for stat in aggregate
        }

    # 5. Scoring & Pareto Frontier
    scores = score_strategies(scoring_inputs, pack.metric_definitions)

    # 6. Executive Reporting
    reporter = ReporterAgent(gateway, settings)
    deg_enums = [
        DegradationType(d)
        for d in all_degradations
        if d in DegradationType._value2member_map_
    ]
    report_out, rep_degs = reporter.generate_report(
        strategy_scores=scores,
        simulation_summary=sim_results_by_strat,
        degradations=deg_enums,
    )
    all_degradations.extend([d.value for d in rep_degs])

    # 7. Critic Verification
    critic = CriticAgent(gateway, settings)
    critic_verdict = critic.verify(
        report=report_out,
        simulation_summary=sim_results_by_strat,
        strategy_scores=scores,
    )

    return AISimulationResponse(
        pack_id=pack.manifest.id,
        pack_name=pack.manifest.name,
        objectives=scenario_out.objectives,
        constraints=scenario_out.constraints,
        assumptions=scenario_out.assumptions,
        strategies=strategies_to_simulate,
        strategy_scores=scores,
        simulation_results=sim_results_by_strat,
        report=report_out,
        critic=critic_verdict,
        degradations=list(set(all_degradations)),
    )


class LLMStatusResponse(BaseModel):
    models_chain: list[str]
    configured_keys_count: int
    recent_calls: list[dict[str, Any]]


@router.get("/llm/status", response_model=LLMStatusResponse)
async def get_llm_status() -> dict[str, Any]:
    """Returns active Gemini model chain, registered keys count, and recent logs."""
    settings = get_settings()
    gateway = GeminiGateway(settings)
    keys = settings.get_gemini_api_keys()

    return {
        "models_chain": gateway.model_priority_chain,
        "configured_keys_count": len(keys),
        "recent_calls": [log.model_dump() for log in gateway.get_recent_logs(20)],
    }
