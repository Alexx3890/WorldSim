"""
WorldSim Shared — Core Domain Schemas
======================================
These are the locked contracts that every pack, engine, and API must conform to.
Only Run, RunResult, and Pack interface schemas are locked here.
Other DB tables evolve in apps/api as needed.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ModellingType(str, Enum):
    DISCRETE_EVENT = "discrete_event"
    AGENT_BASED = "agent_based"
    HYBRID = "hybrid"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"   # some replications failed but minimum count met


class Origin(str, Enum):
    AI = "ai"
    USER = "user"
    TEMPLATE = "template"


class DegradationType(str, Enum):
    BACKUP_LLM_MODEL = "backup_llm_model"
    MANUAL_MODE = "manual_mode"
    TEMPLATE_REPORT = "template_report"
    PARTIAL_REPLICATIONS = "partial_replications"
    LOW_CONFIDENCE = "low_confidence"
    PARTIAL_EXTRACTION = "partial_extraction"
    FALLBACK_STRATEGY = "fallback_strategy"


# ---------------------------------------------------------------------------
# Pack interface types (locked — Phase 0)
# ---------------------------------------------------------------------------

class PackManifest(BaseModel):
    """Identity and compatibility metadata every pack must declare."""
    id: str = Field(..., pattern=r"^[a-z][a-z0-9_]*$", description="Snake-case unique pack identifier")
    name: str
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$", description="SemVer e.g. 1.0.0")
    modelling_type: ModellingType
    required_engine_version: str = Field(..., description="SemVer range e.g. >=0.1.0,<1.0.0")
    description: str = ""
    author: str = ""


class ParameterField(BaseModel):
    """Schema descriptor for a single pack parameter."""
    name: str
    type: str                           # "int" | "float" | "str" | "bool"
    default: Any
    description: str = ""
    unit: str = ""
    min_value: float | None = None
    max_value: float | None = None
    choices: list[Any] | None = None    # for enum-style parameters


class PackSchema(BaseModel):
    """Describes all configurable parameters of a pack."""
    parameters: list[ParameterField]
    objectives: list[str] = []
    constraints: list[str] = []


# ---------------------------------------------------------------------------
# Metric types
# ---------------------------------------------------------------------------

class MetricAxis(str, Enum):
    COST = "cost"
    RISK = "risk"
    TIME = "time"
    EFFICIENCY = "efficiency"


class MetricDefinition(BaseModel):
    key: str                        # e.g. "avg_wait_minutes"
    label: str                      # human-readable
    axis: MetricAxis
    unit: str = ""
    lower_is_better: bool = True


class ReplicationMetrics(BaseModel):
    """Raw metric values from a single simulation replication."""
    replication_index: int
    seed: int
    metrics: dict[str, float]       # key → value
    duration_seconds: float
    failed: bool = False
    error: str | None = None


class AggregateStats(BaseModel):
    """Statistical summary across all successful replications."""
    metric_key: str
    mean: float
    median: float
    std_dev: float
    p5: float
    p95: float
    ci_lower: float                 # 95% confidence interval
    ci_upper: float
    n_successful: int


class AxisScore(BaseModel):
    axis: MetricAxis
    score: float = Field(..., ge=0.0, le=1.0)   # 0 = worst, 1 = best
    weight: float = Field(default=0.25, ge=0.0, le=1.0)


class StrategyScore(BaseModel):
    strategy_id: UUID
    strategy_name: str
    composite_score: float
    axis_scores: list[AxisScore]
    is_pareto_optimal: bool = False
    rank: int


# ---------------------------------------------------------------------------
# Run types (locked — Phase 0)
# ---------------------------------------------------------------------------

class RunSpec(BaseModel):
    """Everything needed to reproduce a run exactly."""
    run_id: UUID = Field(default_factory=uuid4)
    strategy_id: UUID
    pack_id: str
    pack_version: str
    engine_version: str
    parameters: dict[str, Any]
    seeds: list[int]
    config_snapshot: dict[str, Any]     # full Settings dict at run time
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RunResult(BaseModel):
    """Complete result of a run across all replications."""
    run_id: UUID
    status: RunStatus
    replications: list[ReplicationMetrics]
    aggregate: list[AggregateStats]
    scores: list[StrategyScore] = []
    degradations: list[DegradationType] = []
    n_requested: int
    n_successful: int
    n_failed: int
    completed_at: datetime | None = None
    error: str | None = None

    @property
    def is_degraded(self) -> bool:
        return len(self.degradations) > 0

    @property
    def success_rate(self) -> float:
        if self.n_requested == 0:
            return 0.0
        return self.n_successful / self.n_requested


# ---------------------------------------------------------------------------
# API envelope types
# ---------------------------------------------------------------------------

class APIError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}
    request_id: str = ""
    retryable: bool = False


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    has_next: bool
