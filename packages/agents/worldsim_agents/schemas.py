"""
WorldSim Agents — Pydantic Schemas for Multi-Agent Pipeline
=============================================================
Defines typed structured inputs and outputs for every agent.
"""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class RouterOutput(BaseModel):
    """Output from RouterAgent matching user text to a scenario pack."""
    pack_id: str = Field(..., description="ID of the matching pack")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Routing confidence score")
    rationale: str = Field(..., description="Explanation of why this pack matches")
    alternatives: list[str] = Field(default_factory=list, description="Alternative pack candidates if low confidence")


class ScenarioBuilderOutput(BaseModel):
    """Output from ScenarioBuilderAgent extracting concrete pack parameters."""
    parameters: dict[str, Any] = Field(..., description="Parsed simulation parameters matching pack schema")
    objectives: list[str] = Field(default_factory=list, description="User goals extracted from description")
    constraints: list[str] = Field(default_factory=list, description="Explicit boundaries and constraints")
    assumptions: list[str] = Field(default_factory=list, description="Defaults and assumptions explicitly flagged")


class StrategyItem(BaseModel):
    """A proposed simulation decision strategy."""
    name: str = Field(..., description="Short name of strategy")
    description: str = Field(..., description="Detailed description of what changes")
    parameter_deltas: dict[str, Any] = Field(..., description="Parameter overrides vs baseline")
    hypothesis: str = Field(..., description="Why this strategy is expected to succeed")
    expected_tradeoff: str = Field(..., description="Expected trade-offs (cost, time, risk)")


class StrategyGeneratorOutput(BaseModel):
    """Output from StrategyGeneratorAgent proposing alternatives."""
    strategies: list[StrategyItem] = Field(..., description="List of proposed alternative strategies")


class ReportOutput(BaseModel):
    """Output from ReporterAgent presenting an executive brief."""
    title: str = Field(..., description="Report title")
    executive_summary: str = Field(..., description="High-level narrative summary")
    key_findings: list[str] = Field(..., description="Bulleted findings citing concrete metrics")
    recommended_strategy: str = Field(..., description="Name of the top-ranked strategy")
    recommendation_rationale: str = Field(..., description="Evidence-backed reasoning for recommendation")
    tradeoff_analysis: str = Field(..., description="Analysis of cost vs risk vs time vs efficiency")
    degradations_and_limitations: str | None = Field(
        default=None,
        description="Explicit disclosure of any degraded modes, missing data, or simulation assumptions"
    )


class CriticOutput(BaseModel):
    """Output from CriticAgent assessing factual and numerical truthfulness."""
    passed: bool = Field(..., description="True if report is factually faithful to simulation data")
    score: float = Field(..., ge=0.0, le=1.0, description="Faithfulness score")
    discrepancies: list[str] = Field(default_factory=list, description="List of any mismatched numbers or unsupported claims")
    notes: str = Field(..., description="Critic comments and verification summary")
