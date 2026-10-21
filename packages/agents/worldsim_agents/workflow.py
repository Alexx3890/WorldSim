"""
WorldSim Agents — LangGraph Multi-Agent Orchestration Workflow
==============================================================
Wires Router → ScenarioBuilder → StrategyGenerator → SimulationRunner → Evaluator → Reporter → Critic
into a robust state machine with checkpointing and degradation tracking.
"""
from __future__ import annotations

import logging
from typing import Any, cast
from typing_extensions import TypedDict
from uuid import uuid4

from langgraph.graph import END, StateGraph

from worldsim_shared.config import Settings, get_settings
from worldsim_shared.schemas import DegradationType, PackManifest, StrategyScore
from worldsim_engine.runner import MonteCarloRunner
from worldsim_engine.scorer import score_strategies
from worldsim_llm_gateway.gateway import GeminiGateway
from worldsim_agents.agents import (
    CriticAgent,
    ReporterAgent,
    RouterAgent,
    ScenarioBuilderAgent,
    StrategyGeneratorAgent,
)
from worldsim_agents.schemas import CriticOutput, ReportOutput, StrategyItem

logger = logging.getLogger(__name__)


class PipelineState(TypedDict):
    user_input: str
    available_packs: list[PackManifest]
    pack_registry: Any  # PackRegistry instance or dict
    selected_pack_id: str
    pack_manifest: PackManifest | None
    scenario_parameters: dict[str, Any]
    objectives: list[str]
    constraints: list[str]
    assumptions: list[str]
    strategies: list[dict[str, Any]]
    run_results: list[dict[str, Any]]
    strategy_scores: list[StrategyScore]
    report: ReportOutput | None
    critic_verdict: CriticOutput | None
    degradations: list[str]
    status: str
    error: str | None


def build_worldsim_graph(
    gateway: GeminiGateway | None = None,
    settings: Settings | None = None,
) -> Any:
    """Builds and compiles the LangGraph Multi-Agent state machine."""
    app_settings = settings or get_settings()
    llm_gw = gateway or GeminiGateway(app_settings)

    router_agent = RouterAgent(llm_gw, app_settings)
    builder_agent = ScenarioBuilderAgent(llm_gw, app_settings)
    strategy_agent = StrategyGeneratorAgent(llm_gw, app_settings)
    reporter_agent = ReporterAgent(llm_gw, app_settings)
    critic_agent = CriticAgent(llm_gw, app_settings)

    # --- Node functions ---

    def route_node(state: PipelineState) -> dict[str, Any]:
        packs = state["available_packs"]
        router_out, deg = router_agent.route(state["user_input"], packs)
        degradations = list(state.get("degradations", []))
        degradations.extend([d.value for d in deg])

        selected_pack = next((p for p in packs if p.id == router_out.pack_id), packs[0] if packs else None)
        return {
            "selected_pack_id": router_out.pack_id,
            "pack_manifest": selected_pack,
            "degradations": list(set(degradations)),
            "status": "routed",
        }

    def build_scenario_node(state: PipelineState) -> dict[str, Any]:
        registry = state["pack_registry"]
        pack_id = state["selected_pack_id"]
        pack = registry.get(pack_id)
        if not pack:
            return {"error": f"Pack '{pack_id}' not found in registry", "status": "failed"}

        builder_out, deg = builder_agent.build_scenario(
            user_input=state["user_input"],
            pack_manifest=pack.manifest,
            pack_schema=pack.schema,
            pack_guidance=pack.prompt_pack.get("guidance", ""),
        )
        degradations = list(state.get("degradations", []))
        degradations.extend([d.value for d in deg])

        return {
            "scenario_parameters": builder_out.parameters,
            "objectives": builder_out.objectives,
            "constraints": builder_out.constraints,
            "assumptions": builder_out.assumptions,
            "degradations": list(set(degradations)),
            "status": "scenario_built",
        }

    def generate_strategies_node(state: PipelineState) -> dict[str, Any]:
        registry = state["pack_registry"]
        pack = registry.get(state["selected_pack_id"])
        baseline_params = state["scenario_parameters"]

        # Always include baseline as Strategy 0
        empty_deltas: dict[str, Any] = cast(dict[str, Any], dict())
        strategies_data: list[dict[str, Any]] = [
            {
                "strategy_id": str(uuid4()),
                "name": "Baseline (Current State)",
                "description": "Current unmodified operational parameters.",
                "parameter_deltas": empty_deltas,
                "parameters": dict(baseline_params),
                "is_baseline": True,
            }
        ]

        proposals, deg = strategy_agent.generate_strategies(
            baseline_params=baseline_params,
            pack_schema=pack.schema,
            objectives=state["objectives"],
            constraints=state["constraints"],
            pack_guidance=pack.prompt_pack.get("guidance", ""),
        )
        degradations = list(state.get("degradations", []))
        degradations.extend([d.value for d in deg])

        for p in proposals:
            merged_params = dict(baseline_params)
            merged_params.update(p.parameter_deltas)
            strategies_data.append(
                {
                    "strategy_id": str(uuid4()),
                    "name": p.name,
                    "description": p.description,
                    "parameter_deltas": p.parameter_deltas,
                    "parameters": merged_params,
                    "hypothesis": p.hypothesis,
                    "is_baseline": False,
                }
            )

        return {
            "strategies": strategies_data,
            "degradations": list(set(degradations)),
            "status": "strategies_generated",
        }

    def run_simulation_node(state: PipelineState) -> dict[str, Any]:
        """Runs the deterministic Monte Carlo simulation engine for all strategies."""
        registry = state["pack_registry"]
        pack = registry.get(state["selected_pack_id"])
        sim_cfg = app_settings.simulation
        runner = MonteCarloRunner(
            worker_pool_size=sim_cfg.worker_pool_size,
            min_replications=sim_cfg.min_replications,
            max_replications=sim_cfg.max_replications,
            convergence_ci_width=sim_cfg.convergence_ci_width,
            replication_timeout_seconds=sim_cfg.replication_timeout_seconds,
            warmup_fraction=sim_cfg.warmup_fraction,
        )

        results: list[dict[str, Any]] = []
        for s in state["strategies"]:
            replications, _ = runner.run(
                pack_factory=lambda: pack,
                params=s["parameters"],
                master_seed=42,
                n_replications=sim_cfg.default_replications,
                sim_duration=float(s["parameters"].get("sim_duration_hours", 8.0)) * 60.0,
            )
            agg = pack.aggregate_metrics(replications)
            results.append(
                {
                    "strategy_id": s["strategy_id"],
                    "strategy_name": s["name"],
                    "parameters": s["parameters"],
                    "aggregate": agg,
                }
            )

        return {
            "run_results": results,
            "status": "simulations_completed",
        }

    def evaluate_node(state: PipelineState) -> dict[str, Any]:
        """Scores strategies and calculates the Pareto frontier."""
        registry = state["pack_registry"]
        pack = registry.get(state["selected_pack_id"])

        scoring_inputs: list[dict[str, Any]] = [
            {
                "strategy_id": r["strategy_id"],
                "strategy_name": r["strategy_name"],
                "aggregate": r["aggregate"],
            }
            for r in state["run_results"]
        ]
        scores = score_strategies(scoring_inputs, pack.metric_definitions)
        return {
            "strategy_scores": scores,
            "status": "evaluated",
        }

    def report_node(state: PipelineState) -> dict[str, Any]:
        """Generates the executive narrative report."""
        sim_summary = {
            r["strategy_name"]: {
                stat.metric_key: {
                    "mean": stat.mean,
                    "ci_lower": stat.ci_lower,
                    "ci_upper": stat.ci_upper,
                }
                for stat in r["aggregate"]
            }
            for r in state["run_results"]
        }
        deg_enums = [DegradationType(d) for d in state.get("degradations", []) if d in DegradationType._value2member_map_]
        report_out, deg = reporter_agent.generate_report(
            strategy_scores=state["strategy_scores"],
            simulation_summary=sim_summary,
            degradations=deg_enums,
        )
        degradations = list(state.get("degradations", []))
        degradations.extend([d.value for d in deg])

        return {
            "report": report_out,
            "degradations": list(set(degradations)),
            "status": "reported",
        }

    def critic_node(state: PipelineState) -> dict[str, Any]:
        """Validates report numerical veracity against ground truth."""
        sim_summary = {
            r["strategy_name"]: {
                stat.metric_key: {
                    "mean": stat.mean,
                    "ci_lower": stat.ci_lower,
                    "ci_upper": stat.ci_upper,
                }
                for stat in r["aggregate"]
            }
            for r in state["run_results"]
        }
        report = state.get("report")
        if report is None:
            top_name = state["strategy_scores"][0].strategy_name if state.get("strategy_scores") else "Baseline"
            empty_findings: list[str] = cast(list[str], list())
            report = ReportOutput(
                title="WorldSim Executive Simulation Brief",
                executive_summary="Simulation completed.",
                key_findings=empty_findings,
                recommended_strategy=top_name,
                recommendation_rationale="Evaluated based on simulation output.",
                tradeoff_analysis="",
            )
        verdict = critic_agent.verify(
            report=report,
            simulation_summary=sim_summary,
            strategy_scores=state["strategy_scores"],
        )
        return {
            "critic_verdict": verdict,
            "status": "completed",
        }

    # --- Build graph ---
    workflow: Any = StateGraph(PipelineState)  # type: ignore[type-var, arg-type]

    workflow.add_node("router", route_node)
    workflow.add_node("scenario_builder", build_scenario_node)
    workflow.add_node("strategy_generator", generate_strategies_node)
    workflow.add_node("simulation_runner", run_simulation_node)
    workflow.add_node("evaluator", evaluate_node)
    workflow.add_node("reporter", report_node)
    workflow.add_node("critic", critic_node)

    workflow.set_entry_point("router")
    workflow.add_edge("router", "scenario_builder")
    workflow.add_edge("scenario_builder", "strategy_generator")
    workflow.add_edge("strategy_generator", "simulation_runner")
    workflow.add_edge("simulation_runner", "evaluator")
    workflow.add_edge("evaluator", "reporter")
    workflow.add_edge("reporter", "critic")
    workflow.add_edge("critic", END)

    return workflow.compile()
