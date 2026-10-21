"""
Public Event Crowd & Venue Congestion Pack — SimPy Model
=========================================================
Models arena crowd ingress surges, security screening lane queues,
digital turnstile throughput, concession kiosk delays, and
overcrowding hazard risks before stadium event start.
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


class SocialCrowdModel(SimPyModel):
    """SimPy simulation model for event crowd ingress and venue safety."""

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

        self.security_lanes = simpy.Resource(env, capacity=params["num_security_lanes"])
        self.turnstiles = simpy.Resource(env, capacity=params["num_turnstiles"])
        self.concessions = simpy.Resource(env, capacity=params["num_concession_stands"])

        self._ingress_wait_seconds: list[float] = []
        self._concession_wait_seconds: list[float] = []
        self._security_utilization_samples: list[float] = []
        self._turnstile_passes = 0
        self._max_queue_depth = 0

    def run(self) -> Generator[Any, Any, None]:
        attendance = self.params["event_attendance"]
        window_minutes = float(self.params["arrival_window_minutes"])
        window_seconds = window_minutes * 60.0

        # Periodic monitor for queue depth and security lane utilization
        self.env.process(self._monitor_concurrency())

        # Crowd arrival distribution follows a bell-shaped surge peak near the middle/late window
        peak_time = window_seconds * 0.65
        std_time = window_seconds * 0.18

        for i in range(attendance):
            # Arrival time drawn from clipped normal distribution
            arrival_sec = float(np.clip(self.rng.normal(peak_time, std_time), 0.0, window_seconds))
            self.env.process(self._attendee_journey(i, arrival_sec))

        yield self.env.timeout(window_seconds + 1800.0)  # allow tail clearance

    def _monitor_concurrency(self) -> Generator[Any, Any, None]:
        while True:
            yield self.env.timeout(30.0)  # every 30 seconds
            active_queue = len(self.security_lanes.queue) + len(self.turnstiles.queue)
            if active_queue > self._max_queue_depth:
                self._max_queue_depth = active_queue
            sec_cap = max(1, self.security_lanes.capacity)
            self._security_utilization_samples.append(self.security_lanes.count / sec_cap)

    def _attendee_journey(self, attendee_id: int, arrival_sec: float) -> Generator[Any, Any, None]:
        if self.env.now < arrival_sec:
            yield self.env.timeout(arrival_sec - self.env.now)

        t_start = self.env.now

        # 1. Security Screening Lane
        with self.security_lanes.request() as req:
            yield req
            base_sec = self.data["security"]["base_screening_seconds"]
            bag_time = 0.0
            if self.rng.random() < self.data["security"]["bag_check_prob"]:
                bag_time = float(self.rng.exponential(self.data["security"]["bag_search_mean_seconds"]))
            yield self.env.timeout(base_sec + bag_time)

        # 2. Digital Turnstile Entry
        with self.turnstiles.request() as req:
            yield req
            scan_time = float(max(1.0, self.rng.normal(
                self.data["turnstile"]["mean_scan_seconds"],
                self.data["turnstile"]["scan_sigma"]
            )))
            if self.rng.random() < self.data["turnstile"]["scan_retry_prob"]:
                scan_time += self.data["turnstile"]["retry_penalty_seconds"]
            yield self.env.timeout(scan_time)
            self._turnstile_passes += 1

        total_ingress_sec = self.env.now - t_start
        self._ingress_wait_seconds.append(total_ingress_sec)

        # 3. Concession Stand (Optional)
        if self.rng.random() < self.data["concessions"]["concession_visit_prob"]:
            with self.concessions.request() as req:
                yield req
                conc_sec = float(self.rng.lognormal(
                    self.data["concessions"]["service_lognormal_mu"],
                    self.data["concessions"]["service_lognormal_sigma"]
                ))
                yield self.env.timeout(conc_sec)

    def collect_metrics(self) -> dict[str, float]:
        window_minutes = float(self.params["arrival_window_minutes"])
        duration_hours = (window_minutes + 30.0) / 60.0
        attendance = max(1, self.params["event_attendance"])

        max_wait_mins = (float(np.max(self._ingress_wait_seconds)) / 60.0) if self._ingress_wait_seconds else 0.0
        throughput_per_min = self._turnstile_passes / max(1.0, window_minutes)

        # Overcrowding hazard index: composite scale from 0 to 100 based on peak queue crowding
        # Relative to total security + turnstile entry capacity
        total_gate_capacity = self.params["num_security_lanes"] + self.params["num_turnstiles"]
        density_ratio = self._max_queue_depth / max(1, total_gate_capacity * 5)
        hazard_index = min(100.0, density_ratio * 100.0)

        sec_cost = self.params["num_security_lanes"] * self.data["costs"]["security_guard_hourly_rate"] * duration_hours
        gate_cost = self.params["num_turnstiles"] * self.data["costs"]["turnstile_steward_hourly_rate"] * duration_hours
        conc_cost = self.params["num_concession_stands"] * self.data["costs"]["concession_worker_hourly_rate"] * duration_hours
        power_cost = self.data["costs"]["venue_power_overhead_hourly"] * duration_hours
        total_cost = sec_cost + gate_cost + conc_cost + power_cost
        cost_per_attendee = total_cost / attendance

        sec_util = (float(np.mean(self._security_utilization_samples)) * 100.0) if self._security_utilization_samples else 0.0

        return {
            "max_ingress_wait_minutes": round(max_wait_mins, 2),
            "overcrowding_hazard_index": round(hazard_index, 2),
            "turnstile_throughput_per_min": round(throughput_per_min, 1),
            "security_lane_utilization": round(sec_util, 2),
            "operational_cost_per_attendee": round(cost_per_attendee, 2),
        }


class SocialPack(BasePack):
    """WorldSim Public Event Crowd & Venue Congestion Pack."""

    @property
    def manifest(self) -> PackManifest:
        return PackManifest(
            id="social",
            name="Public Event Crowd & Venue Congestion",
            version="1.0.0",
            modelling_type=ModellingType.DISCRETE_EVENT,
            required_engine_version=">=0.1.0",
            description="Simulates arena crowd arrival surges, security screening checkpoints, digital turnstiles, and overcrowding hazard risk.",
            author="Ankit Kumar Singh",
        )

    @property
    def schema(self) -> PackSchema:
        return PackSchema(
            parameters=[
                ParameterField(
                    name="num_security_lanes",
                    type="int",
                    default=12,
                    description="Active metal detector and bag search checkpoints",
                    unit="lanes",
                    min_value=2,
                    max_value=60,
                ),
                ParameterField(
                    name="num_turnstiles",
                    type="int",
                    default=16,
                    description="Automated barcode and RFID access turnstile gates",
                    unit="turnstiles",
                    min_value=4,
                    max_value=80,
                ),
                ParameterField(
                    name="num_concession_stands",
                    type="int",
                    default=8,
                    description="Food, beverage, and merchandise transaction kiosks",
                    unit="stands",
                    min_value=2,
                    max_value=50,
                ),
                ParameterField(
                    name="event_attendance",
                    type="int",
                    default=1800,
                    description="Total ticketholders arriving during the event ingress window",
                    unit="attendees",
                    min_value=100,
                    max_value=25000,
                ),
                ParameterField(
                    name="arrival_window_minutes",
                    type="float",
                    default=90.0,
                    description="Duration of crowd arrival window prior to event start",
                    unit="minutes",
                    min_value=30.0,
                    max_value=240.0,
                ),
            ],
            objectives=[
                "Minimize maximum ingress queue wait time before kickoff",
                "Keep overcrowding hazard index below 25",
                "Maximize turnstile ticket scan throughput",
            ],
            constraints=[
                "Turnstiles must be >= security lanes",
                "Security lanes must be >= 2",
            ],
        )

    @property
    def metric_definitions(self) -> list[MetricDefinition]:
        return [
            MetricDefinition(key="max_ingress_wait_minutes", label="Max Ingress Wait", axis=MetricAxis.TIME, unit="minutes", lower_is_better=True),
            MetricDefinition(key="overcrowding_hazard_index", label="Hazard Index", axis=MetricAxis.RISK, unit="hazard score", lower_is_better=True),
            MetricDefinition(key="turnstile_throughput_per_min", label="Turnstile Rate", axis=MetricAxis.EFFICIENCY, unit="attendees/min", lower_is_better=False),
            MetricDefinition(key="security_lane_utilization", label="Security Utilization", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
            MetricDefinition(key="operational_cost_per_attendee", label="Cost / Attendee", axis=MetricAxis.COST, unit="USD", lower_is_better=True),
        ]

    @property
    def metrics(self) -> list[MetricDefinition]:
        return self.metric_definitions

    @property
    def prompt_pack(self) -> dict[str, Any]:
        return {
            "guidance": (
                "Crowd safety and venue operations depend on synchronizing security screening rates "
                "with automated turnstiles to prevent deadly crowd surges outside stadium perimeters. "
                "Key levers include opening additional bag-check lanes, reallocating attendants, and "
                "staggering early-bird arrival incentives."
            )
        }

    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment | None = None) -> SocialCrowdModel:
        if env is None:
            env = simpy.Environment()
        rng = np.random.default_rng(seed)
        return SocialCrowdModel(env=env, rng=rng, params=params, data=_DATA)

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        sec = params.get("num_security_lanes", 0)
        turnstiles = params.get("num_turnstiles", 0)
        if sec <= 0:
            errors.append("num_security_lanes must be greater than 0")
        if turnstiles <= 0:
            errors.append("num_turnstiles must be greater than 0")
        if turnstiles < sec:
            errors.append("num_turnstiles should be greater than or equal to num_security_lanes to prevent bottlenecking")
        return errors

    def validation_tests(self) -> list[KnownResultTest]:
        return [
            KnownResultTest(
                name="Sufficient security lanes prevent extreme congestion",
                params={
                    "num_security_lanes": 20,
                    "num_turnstiles": 25,
                    "num_concession_stands": 10,
                    "event_attendance": 200,
                    "arrival_window_minutes": 90.0,
                },
                seed=42,
                expected_metrics={
                    "overcrowding_hazard_index": 0.0,
                },
                tolerance_fraction=1.0,
            )
        ]
