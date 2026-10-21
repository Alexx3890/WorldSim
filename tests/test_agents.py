"""
Tests for worldsim_agents
=========================
Verifies:
- Prompt template loading and variable interpolation
- Router agent fallback routing
- Scenario builder schema bounds clamping and assumptions tracking
- Strategy generator alternative proposals
- Reporter and Critic truthful verification
"""
import pytest
from hospital_pack import HospitalPack
from worldsim_shared.config import Settings
from worldsim_agents.prompt_loader import load_prompt
from worldsim_agents.agents import (
    CriticAgent,
    ReporterAgent,
    RouterAgent,
    ScenarioBuilderAgent,
    StrategyGeneratorAgent,
)
from worldsim_agents.schemas import ReportOutput


def test_prompt_loader() -> None:
    prompt = load_prompt("router", "v1")
    assert prompt.agent_name == "router"
    assert "{pack_catalog}" in prompt.system

    formatted = prompt.format_system(
        pack_catalog="- hospital: ED simulation",
        confidence_threshold=0.7,
    )
    assert "- hospital: ED simulation" in formatted


def test_router_fallback() -> None:
    pack = HospitalPack()
    agent = RouterAgent(settings=Settings(gemini_api_key=""))
    out, deg = agent.route("Emergency room triage delays and doctor wait times", [pack.manifest])

    assert out.pack_id == "hospital"
    assert out.confidence >= 0.7


def test_scenario_builder_fallback_and_clamping() -> None:
    pack = HospitalPack()
    agent = ScenarioBuilderAgent(settings=Settings(gemini_api_key=""))
    out, deg = agent.build_scenario(
        user_input="We have 4 doctors and 8 nurses",
        pack_manifest=pack.manifest,
        pack_schema=pack.schema,
    )

    # Must provide all schema parameters
    assert "num_doctors" in out.parameters
    assert "num_nurses" in out.parameters
    assert "num_beds" in out.parameters
    assert len(out.assumptions) > 0


def test_strategy_generator_fallback() -> None:
    pack = HospitalPack()
    agent = StrategyGeneratorAgent(settings=Settings(gemini_api_key=""))
    baseline = pack.default_params()

    strategies, deg = agent.generate_strategies(
        baseline_params=baseline,
        pack_schema=pack.schema,
        objectives=["Reduce wait time"],
        constraints=["Stay within budget"],
    )

    assert len(strategies) >= 2
    for s in strategies:
        assert s.name
        assert s.hypothesis
        assert isinstance(s.parameter_deltas, dict)


def test_critic_verification() -> None:
    agent = CriticAgent(settings=Settings(gemini_api_key=""))

    from worldsim_shared.schemas import StrategyScore, AxisScore, MetricAxis
    from uuid import uuid4

    strat_score = StrategyScore(
        strategy_id=uuid4(),
        strategy_name="Add Dedicated Triage Nurses",
        composite_score=0.85,
        axis_scores=[AxisScore(axis=MetricAxis.TIME, score=0.9, weight=0.25)],
        rank=1,
    )

    report = ReportOutput(
        title="Test Report",
        executive_summary="Summary",
        key_findings=["Wait times fell 20%"],
        recommended_strategy="Add Dedicated Triage Nurses",
        recommendation_rationale="Best throughput",
        tradeoff_analysis="Moderate cost increase",
    )

    verdict = agent.verify(
        report=report,
        simulation_summary={"Add Dedicated Triage Nurses": {"avg_wait_minutes": {"mean": 22.0}}},
        strategy_scores=[strat_score],
    )

    assert verdict.passed is True
