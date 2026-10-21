"""
Municipal Permitting & Regulatory Bureau Pack — SimPy Model
============================================================
Models citizen and commercial construction permit filings, intake screening,
senior zoning and structural engineering reviews, environmental impact assessments,
processing backlog accumulation, and fee economics.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Generator

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib  # type: ignore[no-redef]

import numpy as np
import simpy

from worldsim_engine.pack_interface import BasePack, KnownResultTest, SimPyModel
from worldsim_shared.schemas import (
    MetricAxis,
    MetricDefinition,
    ModellingType,
    PackManifest,
    PackSchema,
    ParameterField,
)

_DATA_FILE = Path(__file__).parent.parent / "data" / "distributions.toml"
with open(_DATA_FILE, "rb") as _f:
    _DATA = tomllib.load(_f)


class PolicyPermitModel(SimPyModel):
    """SimPy simulation model for municipal permit reviews and backlogs."""

    def __init__(
        self,
        env: simpy.Environment,
        rng: np.random.Generator,
        params: dict[str, Any],
        data: dict[str, Any],
    ) -> None:
        super().__init__(env, rng)
        self.params = params
        self.data = data

        self.intake_officers = simpy.Resource(env, capacity=params["num_intake_officers"])
        self.zoning_inspectors = simpy.PriorityResource(env, capacity=params["num_zoning_inspectors"])
        self.specialists = simpy.Resource(env, capacity=params["num_environmental_specialists"])

        self._lead_times_days: list[float] = []
        self._first_pass_approvals = 0
        self._total_completed = 0
        self._intake_utilization_samples: list[float] = []
        self._zoning_utilization_samples: list[float] = []
        self._expedited_revenue = 0.0

    def run(self) -> Generator[Any, Any, None]:
        sim_days = float(self.params.get("sim_duration_days", 30.0))
        daily_apps = self.params["daily_permit_applications"]
        expedited_prob = float(self.params["expedited_review_ratio"])

        # Periodic monitor for resource utilization
        self.env.process(self._monitor_utilization())

        # Generate arrivals over simulation period (assuming 8 operating hours per work day)
        for day in range(int(sim_days)):
            for app_num in range(daily_apps):
                # Stagger filings throughout the 8-hour workday (480 minutes)
                filing_time = (day * 480.0) + float(self.rng.uniform(0.0, 480.0))
                # Schedule filing
                self.env.process(self._permit_process(filing_time, expedited_prob))

        # Advance to end of simulation
        yield self.env.timeout(sim_days * 480.0)

    def _monitor_utilization(self) -> Generator[Any, Any, None]:
        while True:
            yield self.env.timeout(60.0)  # sample every hour
            intake_cap = max(1, self.intake_officers.capacity)
            zoning_cap = max(1, self.zoning_inspectors.capacity)
            self._intake_utilization_samples.append(self.intake_officers.count / intake_cap)
            self._zoning_utilization_samples.append(self.zoning_inspectors.count / zoning_cap)

    def _permit_process(self, scheduled_start: float, expedited_prob: float) -> Generator[Any, Any, None]:
        if self.env.now < scheduled_start:
            yield self.env.timeout(scheduled_start - self.env.now)

        entry_time = self.env.now
        is_expedited = self.rng.random() < expedited_prob
        priority_level = 0 if is_expedited else 1  # 0 is higher priority in SimPy PriorityResource

        if is_expedited:
            self._expedited_revenue += self.data["costs"]["expedited_fee_revenue_credit"]

        # 1. Intake review
        with self.intake_officers.request() as req:
            yield req
            intake_mins = float(self.rng.exponential(self.data["intake"]["mean_intake_minutes"]))
            yield self.env.timeout(intake_mins)

        # Intake screening failure check
        if self.rng.random() < self.data["intake"]["screening_rejection_prob"]:
            # Rejected at gate, fast turnaround of 0.5 days
            lead_time = (self.env.now - entry_time) / 480.0
            self._lead_times_days.append(max(0.5, lead_time))
            self._total_completed += 1
            return

        # 2. Zoning / Structural Review (Primary bottleneck)
        has_revisions = False
        with self.zoning_inspectors.request(priority=priority_level) as req:
            yield req
            mean_hrs = self.data["zoning"]["mean_zoning_hours"]
            sigma_hrs = self.data["zoning"]["zoning_sigma"]
            zoning_mins = float(max(1.0, self.rng.normal(mean_hrs, sigma_hrs))) * 60.0
            yield self.env.timeout(zoning_mins)

        if self.rng.random() < self.data["zoning"]["revision_required_prob"]:
            has_revisions = True
            # Secondary revision review
            with self.zoning_inspectors.request(priority=priority_level) as req:
                yield req
                recheck_mins = float(max(0.5, self.rng.normal(mean_hrs * 0.4, sigma_hrs * 0.4))) * 60.0
                yield self.env.timeout(recheck_mins)

        # 3. Environmental Review (if applicable)
        if self.rng.random() < self.data["environmental"]["requires_environmental_prob"]:
            with self.specialists.request() as req:
                yield req
                env_hrs = self.data["environmental"]["mean_environmental_hours"]
                env_sigma = self.data["environmental"]["environmental_sigma"]
                env_mins = float(max(1.0, self.rng.normal(env_hrs, env_sigma))) * 60.0
                yield self.env.timeout(env_mins)

        if not has_revisions:
            self._first_pass_approvals += 1

        total_days = (self.env.now - entry_time) / 480.0
        self._lead_times_days.append(total_days)
        self._total_completed += 1

    def collect_metrics(self) -> dict[str, float]:
        sim_days = float(self.params.get("sim_duration_days", 30.0))
        total_filed = max(1, self.params["daily_permit_applications"] * int(sim_days))
        completed = max(1, self._total_completed)

        avg_lead_days = float(np.mean(self._lead_times_days)) if self._lead_times_days else 1.0
        first_pass_pct = (self._first_pass_approvals / completed) * 100.0

        # Backlog growth: percentage of applications filed that remain unfinished
        unprocessed = max(0, total_filed - self._total_completed)
        backlog_pct = (unprocessed / total_filed) * 100.0

        operating_hours = sim_days * 8.0
        intake_cost = self.params["num_intake_officers"] * self.data["costs"]["intake_officer_hourly_wage"] * operating_hours
        zoning_cost = self.params["num_zoning_inspectors"] * self.data["costs"]["zoning_inspector_hourly_wage"] * operating_hours
        specialist_cost = self.params["num_environmental_specialists"] * self.data["costs"]["specialist_hourly_wage"] * operating_hours
        overhead = self.data["costs"]["operating_overhead_hourly"] * operating_hours
        net_cost = max(0.0, (intake_cost + zoning_cost + specialist_cost + overhead) - self._expedited_revenue)
        cost_per_permit = net_cost / completed

        zoning_util = (float(np.mean(self._zoning_utilization_samples)) * 100.0) if self._zoning_utilization_samples else 0.0

        return {
            "avg_permit_processing_days": round(avg_lead_days, 2),
            "backlog_growth_pct": round(backlog_pct, 2),
            "inspection_cost_per_permit": round(cost_per_permit, 2),
            "first_pass_approval_pct": round(first_pass_pct, 2),
            "inspector_utilization": round(zoning_util, 2),
        }


class PolicyPack(BasePack):
    """WorldSim Municipal Permitting & Regulatory Bureau Pack."""

    @property
    def manifest(self) -> PackManifest:
        return PackManifest(
            id="policy",
            name="Municipal Permitting & Regulatory Bureau",
            version="1.0.0",
            modelling_type=ModellingType.DISCRETE_EVENT,
            required_engine_version=">=0.1.0",
            description="Simulates municipal zoning, architectural reviews, environmental clearances, backlogs, and permit turnaround times.",
            author="Ankit Kumar Singh",
        )

    @property
    def schema(self) -> PackSchema:
        return PackSchema(
            parameters=[
                ParameterField(
                    name="num_intake_officers",
                    type="int",
                    default=4,
                    description="Frontline triage and document intake officers",
                    unit="officers",
                    min_value=1,
                    max_value=30,
                ),
                ParameterField(
                    name="num_zoning_inspectors",
                    type="int",
                    default=8,
                    description="Senior structural and municipal zoning plan examiners",
                    unit="inspectors",
                    min_value=2,
                    max_value=50,
                ),
                ParameterField(
                    name="num_environmental_specialists",
                    type="int",
                    default=3,
                    description="Environmental impact and storm water compliance reviewers",
                    unit="specialists",
                    min_value=1,
                    max_value=20,
                ),
                ParameterField(
                    name="daily_permit_applications",
                    type="int",
                    default=40,
                    description="Average new permit applications submitted per business day",
                    unit="permits/day",
                    min_value=5,
                    max_value=300,
                ),
                ParameterField(
                    name="expedited_review_ratio",
                    type="float",
                    default=0.20,
                    description="Proportion of applicants purchasing priority fast-track review",
                    unit="ratio",
                    min_value=0.0,
                    max_value=0.80,
                ),
                ParameterField(
                    name="sim_duration_days",
                    type="float",
                    default=30.0,
                    description="Duration of municipal operational period simulated",
                    unit="days",
                    min_value=5.0,
                    max_value=120.0,
                ),
            ],
            objectives=[
                "Minimize average permit processing turnaround days",
                "Keep backlog growth below 10%",
                "Maximize first-pass approval and plan compliance",
            ],
            constraints=[
                "Zoning inspectors must be at least 1.5x intake officers",
                "Environmental specialists must be >= 1",
            ],
        )

    @property
    def metric_definitions(self) -> list[MetricDefinition]:
        return [
            MetricDefinition(key="avg_permit_processing_days", label="Avg Turnaround", axis=MetricAxis.TIME, unit="days", lower_is_better=True),
            MetricDefinition(key="backlog_growth_pct", label="Backlog Growth", axis=MetricAxis.RISK, unit="%", lower_is_better=True),
            MetricDefinition(key="inspection_cost_per_permit", label="Cost / Permit", axis=MetricAxis.COST, unit="USD", lower_is_better=True),
            MetricDefinition(key="first_pass_approval_pct", label="First-Pass Approved", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
            MetricDefinition(key="inspector_utilization", label="Inspector Utilization", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
        ]

    @property
    def metrics(self) -> list[MetricDefinition]:
        return self.metric_definitions

    @property
    def prompt_pack(self) -> dict[str, Any]:
        return {
            "guidance": (
                "Municipal permitting operations balance plan examiner capacity against filing volume. "
                "Bottlenecks occur in zoning review when revision cycles surge. Levers include hiring "
                "additional inspectors, adjusting expedited filing fees, or expanding intake triage screening."
            )
        }

    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment | None = None) -> PolicyPermitModel:
        if env is None:
            env = simpy.Environment()
        rng = np.random.default_rng(seed)
        return PolicyPermitModel(env=env, rng=rng, params=params, data=_DATA)

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        intake = params.get("num_intake_officers", 0)
        inspectors = params.get("num_zoning_inspectors", 0)
        if intake <= 0:
            errors.append("num_intake_officers must be greater than 0")
        if inspectors <= 0:
            errors.append("num_zoning_inspectors must be greater than 0")
        if params.get("daily_permit_applications", 0) <= 0:
            errors.append("daily_permit_applications must be greater than 0")
        return errors

    def validation_tests(self) -> list[KnownResultTest]:
        return [
            KnownResultTest(
                name="Sufficient examiners prevent runaway backlog",
                params={
                    "num_intake_officers": 8,
                    "num_zoning_inspectors": 18,
                    "num_environmental_specialists": 6,
                    "daily_permit_applications": 15,
                    "expedited_review_ratio": 0.20,
                    "sim_duration_days": 10.0,
                },
                seed=42,
                expected_metrics={
                    "backlog_growth_pct": 0.0,
                },
                tolerance_fraction=1.0,
            )
        ]
