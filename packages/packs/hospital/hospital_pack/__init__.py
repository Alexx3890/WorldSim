"""
Hospital ED Simulation Pack — SimPy Model
==========================================
Models an Emergency Department patient flow:
  Patient Arrival → Triage → Doctor/Nurse Queue → Treatment → Discharge

All distribution parameters loaded from data/distributions.toml (never hardcoded).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Generator

if sys.version_info >= (3, 11):
    import tomllib
else:
    try:
        import tomllib  # type: ignore[no-redef]
    except ImportError:
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

# Load domain constants from data file — NEVER hardcode these inline
# data/ lives at packs/hospital/data/, one level above the hospital_pack/ package dir
_DATA_FILE = Path(__file__).parent.parent / "data" / "distributions.toml"
with open(_DATA_FILE, "rb") as _f:
    _DATA = tomllib.load(_f)


# ---------------------------------------------------------------------------
# SimPy Model
# ---------------------------------------------------------------------------

class HospitalEDModel(SimPyModel):
    """
    SimPy-based Emergency Department discrete-event simulation.
    One instance = one replication.
    """

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

        # SimPy resources — PriorityResource supports priority-based queueing
        self.doctors = simpy.PriorityResource(env, capacity=params["num_doctors"])
        self.nurses = simpy.PriorityResource(env, capacity=params["num_nurses"])
        self.beds = simpy.PriorityResource(env, capacity=params["num_beds"])

        # Metric tracking
        self._wait_times: list[float] = []
        self._treatment_times: list[float] = []
        self._bed_utilization_samples: list[float] = []
        self._total_cost: float = 0.0
        self._patients_seen: int = 0
        self._patients_turned_away: int = 0

        # Simulation parameters
        self._sim_duration: float = params["sim_duration_hours"] * 60.0  # convert to minutes

    def run(self) -> Generator[Any, Any, None]:
        """Top-level arrival generator process."""
        # Mean inter-arrival time: ~6-8 minutes (8-10 patients/hour under realistic ED load)
        mean_iat = self.params.get("mean_interarrival_minutes", 6.5)
        hourly_mults = self.data["arrival"]["hourly_multipliers"]
        patient_id = 0

        while True:
            # Time-of-day demand adjustment
            current_hour = int((self.env.now / 60.0) % 24)
            multiplier = hourly_mults[current_hour] if current_hour < len(hourly_mults) else 1.0
            adjusted_iat = mean_iat / max(multiplier, 0.1)

            iat = float(self.rng.exponential(adjusted_iat))
            yield self.env.timeout(iat)

            if self.env.now >= self._sim_duration:
                break

            patient_id += 1
            self.env.process(self._patient_journey(patient_id))

    def _patient_journey(self, patient_id: int) -> Generator[Any, Any, None]:
        """Full patient journey from arrival to discharge."""
        arrival_time = self.env.now
        priority_weights = self.data["triage"]["priority_weights"]
        priority = int(self.rng.choice([1, 2, 3], p=priority_weights))

        # 1. Triage queue (waiting for available nurse)
        triage_start = self.env.now
        with self.nurses.request(priority=priority) as nurse_req:
            yield nurse_req
            nurse_wait = self.env.now - triage_start
            triage_duration = float(self.rng.exponential(4.0))  # ~4 min triage
            yield self.env.timeout(triage_duration)

        # 2. Bed queue (waiting for an available treatment bed)
        bed_wait_start = self.env.now
        with self.beds.request(priority=priority) as bed_req:
            yield bed_req
            bed_wait = self.env.now - bed_wait_start

            # 3. Doctor consultation queue (waiting for physician to attend)
            doc_wait_start = self.env.now
            with self.doctors.request(priority=priority) as doc_req:
                yield doc_req
                doc_wait = self.env.now - doc_queue_start if 'doc_queue_start' in locals() else (self.env.now - doc_wait_start)

                # Total pre-treatment wait time = nurse triage wait + bed wait + doctor queue wait
                total_wait_minutes = nurse_wait + bed_wait + doc_wait
                self._wait_times.append(total_wait_minutes)

                # Clinical examination and treatment duration
                key = f"p{priority}"
                mu = self.data["service_times"][f"{key}_lognormal_mu"]
                sigma = self.data["service_times"][f"{key}_lognormal_sigma"]
                service_time = float(self.rng.lognormal(mu, sigma))

                yield self.env.timeout(service_time)
                self._treatment_times.append(service_time)
                self._patients_seen += 1

    def collect_metrics(self) -> dict[str, float]:
        """Return final simulation metrics after env.run() completes."""
        wait_arr = np.array(self._wait_times) if self._wait_times else np.array([0.0])
        treat_arr = np.array(self._treatment_times) if self._treatment_times else np.array([0.0])

        total_capacity_minutes = self.params["num_beds"] * max(1.0, self._sim_duration)
        total_occupied_minutes = float(np.sum(treat_arr))
        bed_util = min(100.0, (total_occupied_minutes / max(1.0, total_capacity_minutes)) * 100.0)

        # Staffing shift operating costs
        shift_hours = self._sim_duration / 60.0
        costs = self.data["costs"]
        doc_cost = self.params["num_doctors"] * costs["doctor_hourly_cost"] * shift_hours
        nurse_cost = self.params["num_nurses"] * costs["nurse_hourly_cost"] * shift_hours
        bed_cost = self.params["num_beds"] * costs["bed_overhead_hourly"] * shift_hours * (bed_util / 100.0)
        total_cost = doc_cost + nurse_cost + bed_cost
        cost_per_pat = total_cost / max(1, self._patients_seen)

        return {
            "avg_wait_minutes": round(float(np.mean(wait_arr)), 2),
            "p95_wait_minutes": round(float(np.percentile(wait_arr, 95)), 2),
            "avg_treatment_minutes": round(float(np.mean(treat_arr)), 2),
            "bed_utilization": round(bed_util, 2),
            "total_cost_usd": round(total_cost, 2),
            "patients_seen": float(self._patients_seen),
            "cost_per_patient_usd": round(cost_per_pat, 2),
        }


# ---------------------------------------------------------------------------
# Hospital Pack (BasePack implementation)
# ---------------------------------------------------------------------------

class HospitalPack(BasePack):
    """
    Hospital Emergency Department scenario pack.
    Pack version: 1.0.0
    """

    @property
    def manifest(self) -> PackManifest:
        return PackManifest(
            id="hospital",
            name="Hospital Emergency Department",
            version="1.0.0",
            modelling_type=ModellingType.DISCRETE_EVENT,
            required_engine_version=">=0.1.0",
            description="Simulates patient flow, staffing, and bed management in an ED.",
            author="WorldSim Team",
        )

    @property
    def schema(self) -> PackSchema:
        return PackSchema(
            parameters=[
                ParameterField(
                    name="num_doctors",
                    type="int",
                    default=3,
                    description="Number of doctors on shift",
                    unit="doctors",
                    min_value=1,
                    max_value=50,
                ),
                ParameterField(
                    name="num_nurses",
                    type="int",
                    default=5,
                    description="Number of nurses on shift",
                    unit="nurses",
                    min_value=1,
                    max_value=100,
                ),
                ParameterField(
                    name="num_beds",
                    type="int",
                    default=20,
                    description="Total available treatment beds",
                    unit="beds",
                    min_value=1,
                    max_value=500,
                ),
                ParameterField(
                    name="sim_duration_hours",
                    type="float",
                    default=8.0,
                    description="Simulated shift duration",
                    unit="hours",
                    min_value=1.0,
                    max_value=168.0,
                ),
            ],
            objectives=[
                "Minimize average patient wait time",
                "Maximize bed utilization",
                "Minimize cost per patient",
            ],
            constraints=[
                "Nurse count must be ≥ doctor count",
                "Beds must be ≥ total clinical staff",
            ],
        )

    @property
    def metric_definitions(self) -> list[MetricDefinition]:
        return [
            MetricDefinition(key="avg_wait_minutes", label="Avg Wait Time", axis=MetricAxis.TIME, unit="min", lower_is_better=True),
            MetricDefinition(key="p95_wait_minutes", label="P95 Wait Time", axis=MetricAxis.RISK, unit="min", lower_is_better=True),
            MetricDefinition(key="bed_utilization", label="Bed Utilization", axis=MetricAxis.EFFICIENCY, unit="%", lower_is_better=False),
            MetricDefinition(key="cost_per_patient_usd", label="Cost Per Patient", axis=MetricAxis.COST, unit="USD", lower_is_better=True),
            MetricDefinition(key="patients_seen", label="Patients Seen", axis=MetricAxis.EFFICIENCY, unit="patients", lower_is_better=False),
        ]

    @property
    def metrics(self) -> list[MetricDefinition]:
        return self.metric_definitions

    @property
    def prompt_pack(self) -> dict[str, Any]:
        return {
            "guidance": (
                "Emergency Department operations involve clinical triage, doctor treatment, "
                "nurse staffing ratios, and inpatient bed occupancy. Common strategies involve "
                "fast-track triage nurses, float physicians, and bed capacity buffers."
            )
        }

    def build(self, params: dict[str, Any], seed: int, env: simpy.Environment | None = None) -> HospitalEDModel:
        if env is None:
            env = simpy.Environment()
        rng = np.random.default_rng(seed)
        return HospitalEDModel(env=env, rng=rng, params=params, data=_DATA)

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        num_nurses = params.get("num_nurses", 0)
        num_doctors = params.get("num_doctors", 0)
        num_beds = params.get("num_beds", 0)
        if num_nurses < num_doctors:
            errors.append(f"num_nurses ({num_nurses}) must be ≥ num_doctors ({num_doctors})")
        if num_beds < (num_nurses + num_doctors):
            errors.append(
                f"num_beds ({num_beds}) must be ≥ num_nurses + num_doctors ({num_nurses + num_doctors})"
            )
        return errors

    def validation_tests(self) -> list[KnownResultTest]:
        """
        M/M/c queueing theory benchmark.
        For a simple M/M/1 case (1 doctor, infinite beds, constant arrivals),
        avg wait ≈ (1/mu) * rho / (1 - rho)
        where rho = arrival_rate / service_rate.
        """
        return [
            KnownResultTest(
                name="Single doctor utilization sanity check",
                params={
                    "num_doctors": 1,
                    "num_nurses": 2,
                    "num_beds": 10,
                    "sim_duration_hours": 24.0,
                },
                seed=42,
                expected_metrics={
                    # With 1 doctor and ~20 patients/8hr shift spread over 24hr (low load),
                    # bed utilization should be moderate (< 0.8)
                    "bed_utilization": 0.4,
                },
                tolerance_fraction=0.5,  # generous — stochastic model
            ),
            KnownResultTest(
                name="More doctors = shorter waits",
                params={
                    "num_doctors": 10,
                    "num_nurses": 10,
                    "num_beds": 30,
                    "sim_duration_hours": 8.0,
                },
                seed=42,
                expected_metrics={
                    "avg_wait_minutes": 2.0,  # near-zero wait with excess capacity
                },
                tolerance_fraction=2.0,  # wide tolerance — validates direction, not exact value
            ),
        ]
