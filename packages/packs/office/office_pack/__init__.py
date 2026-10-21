"""
Office Hybrid Workspace Simulation Pack — SimPy Model
=====================================================
Models hybrid worker arrivals, hot-desking capacity contention,
conference room booking conflicts, and facility cost efficiency.
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


class OfficeWorkspaceModel(SimPyModel):
    """SimPy simulation model for office workplace and hot-desking operations."""

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

        self.desks = simpy.Resource(env, capacity=params["num_desks"])
        self.meeting_rooms = simpy.Resource(env, capacity=params["num_meeting_rooms"])
        self.phone_booths = simpy.Resource(env, capacity=params["num_phone_booths"])

        self._desk_search_delays: list[float] = []
        self._meeting_rejections = 0
        self._total_meeting_requests = 0
        self._total_desk_requests = 0
        self._desk_utilization_samples: list[float] = []
        self._collaboration_hours = 0.0

        self._sim_duration = params["sim_duration_days"] * 480.0  # 8hr workdays in minutes

    def run(self) -> Generator[Any, Any, None]:
        headcount = self.params["headcount"]
        attendance_prob = self.data["attendance"]["hybrid_attendance_probability"]

        # Morning arrival wave
        for emp_id in range(headcount):
            if self.rng.random() < attendance_prob:
                arrival_delay = self.rng.uniform(0.0, 90.0)  # arrive between 8:30-10:00
                self.env.process(self._employee_day(emp_id, arrival_delay))

        # Periodic utilization sampling
        while self.env.now < self._sim_duration:
            yield self.env.timeout(60.0)
            self._desk_utilization_samples.append(self.desks.count / max(1, self.desks.capacity))

    def _employee_day(self, emp_id: int, arrival_delay: float) -> Generator[Any, Any, None]:
        yield self.env.timeout(arrival_delay)
        self._total_desk_requests += 1

        # Request desk
        desk_start = self.env.now
        with self.desks.request() as req:
            res = yield req | self.env.timeout(30.0)  # timeout if cannot find desk in 30 min
            if req in res:
                search_delay = self.env.now - desk_start
                self._desk_search_delays.append(search_delay)

                # Attempt to book a meeting during the day
                if self.rng.random() < self.data["meetings"]["meeting_request_probability"]:
                    self._total_meeting_requests += 1
                    with self.meeting_rooms.request() as m_req:
                        m_res = yield m_req | self.env.timeout(10.0)
                        if m_req in m_res:
                            duration = max(15.0, self.rng.normal(45.0, 15.0))
                            self._collaboration_hours += duration / 60.0
                            yield self.env.timeout(duration)
                        else:
                            self._meeting_rejections += 1

                # Rest of workday
                remaining_time = max(0.0, 480.0 - (self.env.now - desk_start))
                yield self.env.timeout(remaining_time)
            else:
                self._desk_search_delays.append(30.0)  # max search penalty

    def collect_metrics(self) -> dict[str, float]:
        avg_desk_delay = float(np.mean(self._desk_search_delays)) if self._desk_search_delays else 0.0
        avg_desk_util = (float(np.mean(self._desk_utilization_samples)) * 100.0) if self._desk_utilization_samples else 0.0

        total_reqs = max(1, self._total_meeting_requests)
        rejection_pct = (self._meeting_rejections / total_reqs) * 100.0

        desk_cost = self.params["num_desks"] * self.data["costs"]["desk_lease_monthly_cost"]
        room_cost = self.params["num_meeting_rooms"] * self.data["costs"]["meeting_room_overhead_monthly"]
        booth_cost = self.params["num_phone_booths"] * self.data["costs"]["phone_booth_overhead_monthly"]
        total_monthly_facility = desk_cost + room_cost + booth_cost
        cost_per_desk = total_monthly_facility / max(1, self.params["num_desks"])

        return {
            "desk_contention_minutes": round(avg_desk_delay, 2),
            "meeting_room_rejection_pct": round(rejection_pct, 2),
            "desk_utilization": round(avg_desk_util, 2),
            "facility_cost_per_desk": round(cost_per_desk, 2),
            "collaboration_hours_logged": round(self._collaboration_hours, 1),
        }


class OfficePack(BasePack):
    """WorldSim Office Hybrid Workspace & Meeting Room Operations Pack."""

    @property
    def manifest(self) -> PackManifest:
        return PackManifest(
            id="office",
            name="Office Hybrid Workspace & Meeting Rooms",
            version="1.0.0",
            modelling_type=ModellingType.DISCRETE_EVENT,
            required_engine_version=">=0.1.0",
            description="Simulates hot-desking, hybrid worker arrivals, meeting room contention, and facility costs.",
            author="Ankit Kumar Singh",
        )

    @property
    def schema(self) -> PackSchema:
        return PackSchema(
            parameters=[
                ParameterField(
                    name="num_desks",
                    type="int",
                    default=60,
                    description="Total hot-desks and shared workstations on the floor",
                    unit="desks",
                    min_value=10,
                    max_value=500,
                ),
                ParameterField(
                    name="num_meeting_rooms",
                    type="int",
                    default=6,
                    description="Bookable conference and collaboration rooms",
                    unit="rooms",
                    min_value=1,
                    max_value=40,
                ),
                ParameterField(
                    name="num_phone_booths",
                    type="int",
                    default=4,
                    description="Soundproof single-occupancy focus phone booths",
                    unit="booths",
                    min_value=1,
                    max_value=30,
                ),
                ParameterField(
                    name="headcount",
                    type="int",
                    default=100,
                    description="Total assigned office workforce headcount",
                    unit="employees",
                    min_value=20,
                    max_value=1000,
                ),
                ParameterField(
                    name="sim_duration_days",
                    type="float",
                    default=5.0,
                    description="Simulated work week duration in business days",
                    unit="days",
                    min_value=1.0,
                    max_value=30.0,
                ),
            ],
            objectives=[
                "Minimize desk contention and search times during peak arrival hours",
                "Minimize meeting room booking rejection rate",
                "Maximize square footage efficiency and cost per desk",
            ],
            constraints=[
                "Desks must be at least 30% of total workforce headcount",
                "Meeting rooms must be >= 1 per 15 desks",
            ],
        )

    @property
    def metric_definitions(self) -> list[MetricDefinition]:
        return [
            MetricDefinition(key="desk_contention_minutes", label="Desk Search Delay", axis=MetricAxis.TIME, unit="min", lower_is_better=True),
            MetricDefinition(key="meeting_room_rejection_pct", label="Room Rejection %", axis=MetricAxis.RISK, unit="%", lower_is_better=True),
            MetricDefinition(key="desk_utilization", label="Desk Utilization", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
            MetricDefinition(key="facility_cost_per_desk", label="Cost / Desk", axis=MetricAxis.COST, unit="USD", lower_is_better=True),
            MetricDefinition(key="collaboration_hours_logged", label="Collab Hours", axis=MetricAxis.EFFICIENCY, unit="hours", lower_is_better=False),
        ]

    @property
    def metrics(self) -> list[MetricDefinition]:
        return self.metric_definitions

    @property
    def prompt_pack(self) -> dict[str, Any]:
        return {
            "guidance": (
                "Office facility operations involve hybrid desk-sharing ratios, conference room booking "
                "friction, and square footage leasing costs. Common interventions test desk sharing ratios "
                "(e.g. 1.5 employees per desk), converting open spaces to phone booths, or staggered arrival schedules."
            )
        }

    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment | None = None) -> OfficeWorkspaceModel:
        if env is None:
            env = simpy.Environment()
        rng = np.random.default_rng(seed)
        return OfficeWorkspaceModel(env=env, rng=rng, params=params, data=_DATA)

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        desks = params.get("num_desks", 0)
        headcount = params.get("headcount", 0)
        if desks <= 0:
            errors.append("num_desks must be greater than 0")
        if headcount < desks:
            errors.append(f"headcount ({headcount}) cannot be fewer than desks ({desks})")
        return errors

    def validation_tests(self) -> list[KnownResultTest]:
        return [
            KnownResultTest(
                name="Sufficient desks yields zero contention delay",
                params={
                    "num_desks": 100,
                    "num_meeting_rooms": 10,
                    "num_phone_booths": 10,
                    "headcount": 50,
                    "sim_duration_days": 1.0,
                },
                seed=42,
                expected_metrics={
                    "desk_contention_minutes": 0.0,
                },
                tolerance_fraction=1.0,
            )
        ]
